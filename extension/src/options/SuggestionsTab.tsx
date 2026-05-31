import { useCallback, useEffect, useMemo, useState } from "react";
import { runAnalysisAuto } from "../features/smart-collection/sca-client";
import { applySuggestion } from "../features/smart-collection/apply-suggestion";
import { recordFeedback } from "../features/smart-collection/feedback-store";
import { updateSuggestion, getLatestJob } from "../storage/sca-idb";
import { suggestLibraryTagHygiene } from "../features/smart-collection/library-suggestions";
import { listBookmarks } from "../storage/idb";
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
import "./suggestions.css";

const KIND_ORDER: SuggestionKind[] = [
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
  const [librarySuggestions, setLibrarySuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const load = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
    const last = await getLatestJob();
    if (last?.state === "done") setJob(last);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const allSuggestions = useMemo(() => {
    const chrome = job?.suggestions || [];
    return showLibrary ? [...chrome, ...librarySuggestions] : chrome;
  }, [job, librarySuggestions, showLibrary]);

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

  const runAnalyze = async () => {
    if (!settings) return;
    setBusy(true);
    setStatus("Analyzing Chrome bookmarks…");
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
            ? `Progress ${Math.round(j.progress * 100)}% — ${j.bookmarkCount} bookmarks`
            : j.state === "done"
              ? `Done — ${j.suggestions.length} suggestions`
              : j.error || j.state
        );
      });
      setJob(result);
      setStatus(`Done — ${result.suggestions.length} suggestions`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadLibrarySuggestions = async () => {
    setBusy(true);
    try {
      const lib = await listBookmarks();
      const jobId = job?.id || `lib-${Date.now()}`;
      const sugs = suggestLibraryTagHygiene(lib, jobId);
      setLibrarySuggestions(sugs);
      setShowLibrary(true);
      setStatus(`${sugs.length} library tag suggestions (v2.1 preview)`);
    } finally {
      setBusy(false);
    }
  };

  const patchSuggestion = async (s: Suggestion, status: Suggestion["status"]) => {
    const next = { ...s, status };
    await updateSuggestion(next);
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
      if (s.preview.fromPath[0] !== "library") {
        await applySuggestion(s);
      }
      await recordFeedback(s, "accept");
      await patchSuggestion(s, "approved");
      setStatus(`Applied: ${s.preview.title}`);
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
    for (const s of items) {
      try {
        if (s.preview.fromPath[0] !== "library") await applySuggestion(s);
        await recordFeedback(s, "accept");
        await patchSuggestion(s, "approved");
      } catch {
        await patchSuggestion(s, "rejected");
      }
    }
    setBusy(false);
    setStatus(`Bulk approved ${items.length} items`);
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
        Smart Collection Assistant analyzes your existing Chrome folders and suggests improvements.
        Nothing changes until you approve.
      </p>

      {job?.healthScore != null ? (
        <HealthScoreCard score={job.healthScore} factors={job.healthFactors} />
      ) : null}

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

      <div className="sca-toolbar">
        <button type="button" className="btn primary" onClick={runAnalyze} disabled={busy}>
          Analyze library
        </button>
        <button type="button" className="btn secondary" onClick={loadLibrarySuggestions} disabled={busy}>
          Library tag hints
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
