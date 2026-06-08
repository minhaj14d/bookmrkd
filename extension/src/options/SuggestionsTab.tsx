import { useCallback, useEffect, useMemo, useState } from "react";
import { runAnalysisAuto } from "../features/smart-collection/sca-client";
import { applySuggestion } from "../features/smart-collection/apply-suggestion";
import { applyTagSuggestion } from "../features/auto-tag/apply-tag";
import AutoTagPanel from "./components/AutoTagPanel";
import { recordFeedback } from "../features/smart-collection/feedback-store";
import { updateSuggestion, getLatestJob } from "../storage/sca-idb";
import {
  loadSettings,
  saveSettings,
  loadApiKeys,
  toScaProviderConfig,
} from "../lib/settings.js";
import type { AnalysisJob, Suggestion, SuggestionKind } from "../features/smart-collection/types";
import HealthScoreCard from "./components/HealthScoreCard";
import SuggestionSection from "./components/SuggestionSection";
import ProviderSettingsPanel from "./components/ProviderSettingsPanel";
import RaindropConnectPanel from "./components/RaindropConnectPanel";
import { isRaindropFeatureAvailable } from "../features/raindrop/env-config";
import { isRaindropConnected } from "../features/raindrop/storage";
import "./suggestions.css";

const KIND_ORDER: SuggestionKind[] = [
  "tag",
  "move",
  "duplicate",
  "folder_merge",
  "folder_cleanup",
  "folder_split",
  "uncategorized",
];

export default function SuggestionsTab() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadSettings>> | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const raindropAvailable = isRaindropFeatureAvailable();
  const [raindropConnected, setRaindropConnected] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<Suggestion[]>([]);

  const load = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
    const last = await getLatestJob();
    if (last?.state === "done") setJob(last);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    if (!settings || raindropAvailable || settings.dataSource !== "raindrop") return;
    saveSettings({ dataSource: "browser" }).then(setSettings).catch(console.error);
  }, [settings, raindropAvailable]);

  const allSuggestions = useMemo(() => {
    const chrome = job?.suggestions || [];
    return [...tagSuggestions, ...chrome];
  }, [job, tagSuggestions]);

  const byKind = useMemo(() => {
    const map = new Map<SuggestionKind, Suggestion[]>();
    for (const k of KIND_ORDER) map.set(k, []);
    for (const s of allSuggestions) {
      if (s.kind === "leave_unchanged") continue;
      const list = map.get(s.kind) || [];
      list.push(s);
      map.set(s.kind, list);
    }
    return map;
  }, [allSuggestions]);

  const networkWarning =
    settings?.scaProvider === "gemini" ||
    settings?.scaProvider === "openai";

  const dataSource = settings?.dataSource || "browser";

  const runAnalyze = async () => {
    if (!settings) return;
    if (settings.dataSource === "raindrop") {
      if (!raindropAvailable) {
        setStatus("Raindrop is not enabled in this build.");
        return;
      }
      if (!(await isRaindropConnected())) {
        setStatus("Connect Raindrop first.");
        return;
      }
    }
    setBusy(true);
    setStatus(
      settings.dataSource === "raindrop"
        ? "Loading Raindrop collections…"
        : "Analyzing bookmark folders…"
    );
    try {
      const keys = await loadApiKeys();
      const openaiKeys = await chrome.storage.local.get(["bookmrkd_openaiKey"]);
      const merged = {
        ...keys,
        openai: (openaiKeys.bookmrkd_openaiKey as string) || keys.openai || "",
      };
      const config = toScaProviderConfig(settings, merged);
      const result = await runAnalysisAuto(config, settings.dataSource, (j) => {
        setJob({ ...j });
        setStatus(
          j.state === "running"
            ? j.statusMessage ||
              `Progress ${Math.round(j.progress * 100)}% — ${j.bookmarkCount} bookmarks`
            : j.state === "done"
              ? `Done — ${j.suggestions.length} suggestions`
              : j.error || j.state
        );
      });
      setJob(result);
      setStatus(`Done — ${result.suggestions.length} suggestions`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setJob((prev) =>
        prev
          ? { ...prev, state: "error", error: msg, finishedAt: Date.now() }
          : {
              id: "failed",
              state: "error",
              bookmarkCount: 0,
              progress: 0,
              suggestions: [],
              startedAt: Date.now(),
              error: msg,
            }
      );
    } finally {
      setBusy(false);
    }
  };

  const patchSuggestion = async (s: Suggestion, status: Suggestion["status"]) => {
    const next = { ...s, status };
    await updateSuggestion(next);
    if (s.kind === "tag") {
      setTagSuggestions((prev) => prev.map((x) => (x.id === s.id ? next : x)));
      return;
    }
    setJob((prev) =>
      prev
        ? {
            ...prev,
            suggestions: prev.suggestions.map((x) => (x.id === s.id ? next : x)),
          }
        : prev
    );
  };

  const handleApprove = async (s: Suggestion) => {
    setBusy(true);
    try {
      if (s.kind === "tag") {
        await applyTagSuggestion(s);
      } else if (s.preview.fromPath[0] !== "library") {
        await applySuggestion(s);
      }
      await recordFeedback(s, "accept");
      await patchSuggestion(s, "approved");
      setStatus(
        s.kind === "tag"
          ? `Tagged: ${s.preview.title} (+${(s.preview.suggestedTags || []).join(", ")})`
          : `Applied: ${s.preview.title}`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (s: Suggestion) => {
    await recordFeedback(s, "reject");
    await patchSuggestion(s, "rejected");
  };

  const handleIgnore = async (s: Suggestion) => {
    await recordFeedback(s, "ignore");
    await patchSuggestion(s, "ignored");
  };

  const handleBulkApprove = async (items: Suggestion[]) => {
    setBusy(true);
    let ok = 0;
    let failed = 0;
    let lastError = "";
    for (const s of items) {
      try {
        if (s.kind === "tag") await applyTagSuggestion(s);
        else if (s.preview.fromPath[0] !== "library") await applySuggestion(s);
        await recordFeedback(s, "accept");
        await patchSuggestion(s, "approved");
        ok++;
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : String(e);
        await patchSuggestion(s, "rejected");
      }
    }
    setBusy(false);
    setStatus(
      failed
        ? `Applied ${ok}, failed ${failed}${lastError ? `: ${lastError}` : ""}`
        : `Bulk approved ${ok} items`
    );
  };

  const handleBulkReject = async (items: Suggestion[]) => {
    for (const s of items) {
      await recordFeedback(s, "reject");
      await patchSuggestion(s, "rejected");
    }
  };

  if (!settings) return <p className="help">Loading suggestions…</p>;

  return (
    <div className="sca-tab">
      <p className="help sca-intro">
        Analyzes your bookmark folders and suggests improvements. Nothing changes until you approve.
      </p>

      {job?.healthScore != null ? (
        <HealthScoreCard score={job.healthScore} factors={job.healthFactors} />
      ) : null}

      <RaindropConnectPanel onConnectionChange={setRaindropConnected} />

      <ProviderSettingsPanel
        scaProvider={settings.scaProvider}
        onProviderChange={async (id) => {
          const next = await saveSettings({
            scaProvider: id as typeof settings.scaProvider,
          });
          setSettings(next);
        }}
        networkWarning={networkWarning}
      />

      <AutoTagPanel
        settings={settings}
        onSettingsChange={setSettings}
        dataSource={dataSource}
        raindropConnected={raindropConnected}
        onSuggestions={setTagSuggestions}
        onStatus={setStatus}
        busy={busy}
        setBusy={setBusy}
      />

      <fieldset className="sca-data-source block">
        <legend className="block-title">Data source</legend>
        <label className="sca-radio">
          <input
            type="radio"
            name="sca-source"
            checked={dataSource === "browser"}
            onChange={async () => {
              const next = await saveSettings({ dataSource: "browser" });
              setSettings(next);
            }}
          />
          Browser bookmarks
        </label>
        {raindropAvailable ? (
          <label className="sca-radio">
            <input
              type="radio"
              name="sca-source"
              checked={dataSource === "raindrop"}
              onChange={async () => {
                const next = await saveSettings({ dataSource: "raindrop" });
                setSettings(next);
              }}
            />
            Raindrop.io
            {!raindropConnected && dataSource === "raindrop" ? (
              <span className="sca-source-warn"> — connect above first</span>
            ) : null}
          </label>
        ) : null}
        <label className="sca-radio">
          <input
            type="radio"
            name="sca-source"
            checked={dataSource === "html"}
            onChange={async () => {
              const next = await saveSettings({ dataSource: "html" });
              setSettings(next);
            }}
          />
          Imported HTML (Advanced tab)
        </label>
      </fieldset>

      <div className="sca-toolbar">
        <button
          type="button"
          className="btn primary"
          onClick={runAnalyze}
          disabled={busy || (dataSource === "raindrop" && !raindropConnected)}
        >
          {dataSource === "raindrop"
            ? "Analyze Raindrop"
            : dataSource === "html"
              ? "Analyze import"
              : "Analyze bookmarks"}
        </button>
      </div>

      {job?.state === "running" ? (
        <p className="sca-progress" role="status">
          Progress {Math.round((job.progress || 0) * 100)}% — {job.bookmarkCount} bookmarks
        </p>
      ) : null}

      <p className="help" role="status">
        {status}
      </p>

      {KIND_ORDER.map((kind) => (
        <SuggestionSection
          key={kind}
          kind={kind}
          items={byKind.get(kind) || []}
          expandedId={expandedId}
          onTogglePreview={(id) => setExpandedId(expandedId === id ? null : id)}
          onApprove={handleApprove}
          onReject={handleReject}
          onIgnore={handleIgnore}
          onBulkApprove={handleBulkApprove}
          onBulkReject={handleBulkReject}
          busy={busy}
        />
      ))}
    </div>
  );
}
