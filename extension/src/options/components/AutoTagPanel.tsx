import { useState } from "react";
import { runAutoTagSuggestions } from "../../features/auto-tag/run-auto-tag";
import type { AutoTagProviderId, TagTargetSource } from "../../features/auto-tag/types";
import { saveSuggestions } from "../../storage/sca-idb";
import { isRaindropFeatureAvailable } from "../../features/raindrop/env-config";
import { hasApiKey, keyHelpUrl, loadApiKeys, saveSettings } from "../../lib/settings.js";
import type { Suggestion } from "../../features/smart-collection/types";

interface Props {
  settings: Awaited<ReturnType<typeof import("../../lib/settings.js").loadSettings>>;
  onSettingsChange: (s: Awaited<ReturnType<typeof import("../../lib/settings.js").loadSettings>>) => void;
  dataSource: "browser" | "html" | "raindrop";
  raindropConnected: boolean;
  onSuggestions: (suggestions: Suggestion[]) => void;
  onStatus: (message: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}

const PROVIDER_OPTIONS: { id: AutoTagProviderId; label: string; hint: string }[] = [
  {
    id: "local",
    label: "Local (MiniLM)",
    hint: "Runs on your device — no API quota. Uses embeddings + your existing tags.",
  },
  {
    id: "auto",
    label: "Auto (Gemini → local)",
    hint: "Tries Gemini first; on 429 rate limit, finishes with local MiniLM.",
  },
  {
    id: "gemini",
    label: "Gemini only",
    hint: "Best quality when you have API quota. Requires key in Advanced.",
  },
];

export default function AutoTagPanel({
  settings,
  onSettingsChange,
  dataSource,
  raindropConnected,
  onSuggestions,
  onStatus,
  busy,
  setBusy,
}: Props) {
  const [tagTarget, setTagTarget] = useState<TagTargetSource>(
    dataSource === "raindrop" ? "raindrop" : "library"
  );

  const runSuggestTags = async (source: TagTargetSource) => {
    setBusy(true);
    onStatus("Preparing auto-tag…");
    try {
      const provider = settings.autoTagProvider || "local";
      const keys = await loadApiKeys();

      if (provider === "gemini" && !hasApiKey("gemini", keys)) {
        onStatus("Add your Gemini API key in Advanced, or switch tagging engine to Local (MiniLM).");
        return;
      }
      if (source === "raindrop" && !raindropConnected) {
        onStatus("Connect Raindrop first.");
        return;
      }

      const { suggestions, usedLocalFallback } = await runAutoTagSuggestions(
        source,
        {
          provider,
          apiKey: keys.gemini,
          geminiModel: settings.aiModel,
          maxTags: settings.autoTagMaxTags,
          untaggedOnly: settings.autoTagUntaggedOnly,
          maxBookmarks: settings.autoTagMaxBookmarks,
        },
        (p) => {
          onStatus(p.total > 0 ? `${p.phase} (${p.done}/${p.total})` : p.phase);
        }
      );

      await saveSuggestions(suggestions);
      onSuggestions(suggestions);
      const base =
        suggestions.length > 0
          ? `${suggestions.length} tag suggestions ready — review and approve below.`
          : "No new tags suggested (try turning off “only untagged” or raise the bookmark limit).";
      onStatus(
        usedLocalFallback
          ? `${base} (Gemini hit rate limit 429 — rest tagged with local MiniLM.)`
          : base
      );
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const raindropAvailable = isRaindropFeatureAvailable();
  const canRaindrop = raindropAvailable && raindropConnected;
  const showRaindrop = raindropAvailable && (dataSource === "raindrop" || canRaindrop);
  const provider = settings.autoTagProvider || "local";
  const selectedHint = PROVIDER_OPTIONS.find((o) => o.id === provider)?.hint;

  return (
    <section className="sca-autotag-panel block">
      <h3 className="block-title">Auto-tag</h3>
      <p className="help">
        Suggests tags for search and filtering. Nothing is written until you approve each suggestion.
      </p>

      <fieldset className="sca-data-source sca-data-source--compact">
        <legend className="label">Tagging engine</legend>
        {PROVIDER_OPTIONS.map((opt) => (
          <label key={opt.id} className="sca-radio">
            <input
              type="radio"
              name="auto-tag-provider"
              checked={provider === opt.id}
              onChange={async () => {
                const next = await saveSettings({ autoTagProvider: opt.id });
                onSettingsChange(next);
              }}
            />
            {opt.label}
          </label>
        ))}
        {selectedHint ? <p className="help sca-provider-hint">{selectedHint}</p> : null}
      </fieldset>

      <div className="sca-autotag-options">
        <label className="field sca-field-inline">
          <span>Max new tags per bookmark</span>
          <input
            type="number"
            min={1}
            max={12}
            value={settings.autoTagMaxTags}
            onChange={async (e) => {
              const autoTagMaxTags = Math.min(12, Math.max(1, Number(e.target.value) || 5));
              const next = await saveSettings({ autoTagMaxTags });
              onSettingsChange(next);
            }}
          />
        </label>
        <label className="field sca-field-inline">
          <span>Max bookmarks per run</span>
          <input
            type="number"
            min={10}
            max={500}
            step={10}
            value={settings.autoTagMaxBookmarks}
            onChange={async (e) => {
              const autoTagMaxBookmarks = Math.min(500, Math.max(10, Number(e.target.value) || 200));
              const next = await saveSettings({ autoTagMaxBookmarks });
              onSettingsChange(next);
            }}
          />
        </label>
        <label className="sca-checkbox">
          <input
            type="checkbox"
            checked={settings.autoTagUntaggedOnly}
            onChange={async (e) => {
              const next = await saveSettings({ autoTagUntaggedOnly: e.target.checked });
              onSettingsChange(next);
            }}
          />
          Only bookmarks with no tags yet
        </label>
      </div>

      {showRaindrop ? (
        <fieldset className="sca-data-source sca-data-source--compact">
          <legend className="label">Tag target</legend>
          <label className="sca-radio">
            <input
              type="radio"
              name="tag-target"
              checked={tagTarget === "raindrop"}
              onChange={() => setTagTarget("raindrop")}
            />
            Raindrop.io
          </label>
          <label className="sca-radio">
            <input
              type="radio"
              name="tag-target"
              checked={tagTarget === "library"}
              onChange={() => setTagTarget("library")}
            />
            bookmrkd Library
          </label>
        </fieldset>
      ) : null}

      <div className="sca-raindrop-actions">
        <button
          type="button"
          className="btn primary"
          disabled={busy || (tagTarget === "raindrop" && !canRaindrop)}
          onClick={() => runSuggestTags(tagTarget)}
        >
          {provider === "local" ? "Suggest tags (local)" : "Suggest tags"}
        </button>
        {showRaindrop && tagTarget === "library" ? null : (
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => runSuggestTags("library")}
          >
            Tag library only
          </button>
        )}
      </div>

      {provider !== "local" ? (
        <p className="help">
          Gemini key (optional for Auto): <strong>Advanced</strong> → Online AI (
          <a href={keyHelpUrl("gemini")} target="_blank" rel="noopener noreferrer">
            get key
          </a>
          ).
        </p>
      ) : (
        <p className="help">
          First run downloads MiniLM (~25 MB). Keep this tab open until tagging finishes.
        </p>
      )}
    </section>
  );
}
