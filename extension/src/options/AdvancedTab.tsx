import { useCallback, useEffect, useState } from "react";
import {
  flattenChromeTree,
  organizeBookmarks,
  loadRulesConfig,
  buildFolderTreeHtml,
  emitNetscapeHtml,
  buildReportMarkdown,
  parseBookmarksHtml,
} from "../features/organize/organizer.js";
import { applyAiAssist } from "../features/organize/ai-categorize.js";
import {
  loadSettings,
  saveSettings,
  loadApiKeys,
  saveApiKey,
  removeAllApiKeys,
  hasApiKey,
  aiReady,
  saveImportHtml,
  loadImportHtml,
  clearImportHtml,
} from "../lib/settings.js";
import { AI_PROVIDERS, formatModelLabel, RECOMMENDED_PROVIDER } from "../features/organize/ai-providers.js";
import {
  organizeBookmarksOffThread,
  shouldUseOrganizeWorker,
} from "../features/organize/organize-client.js";
import { downloadText, sessionSet } from "../lib/utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrganizeResult = any;

export default function AdvancedTab() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadSettings>> | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [customRules, setCustomRules] = useState("");
  const [importName, setImportName] = useState<string | null>(null);
  const [fuzzyDedupe, setFuzzyDedupe] = useState(true);
  const [sourceMode, setSourceMode] = useState<"live" | "import">("live");
  const [importedHtml, setImportedHtml] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OrganizeResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const load = useCallback(async () => {
    const s = await loadSettings();
    const keys = await loadApiKeys();
    const sync = await chrome.storage.sync.get(["customRules"]);
    const imp = await loadImportHtml();
    setSettings(s);
    setApiKeys(keys);
    setCustomRules((sync.customRules as string) || "");
    setFuzzyDedupe(s.fuzzyDedupe);
    setSourceMode(s.dataSource === "html" ? "import" : "live");
    setImportedHtml(imp.html);
    setImportName(imp.name);
    setApiKeyInput(keys[s.aiProvider] || "");
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  if (!settings) return <p className="help">Loading advanced settings…</p>;

  const providerId = settings.aiProvider as keyof typeof AI_PROVIDERS;
  const models = AI_PROVIDERS[providerId]?.models || [];

  const runAnalysis = async () => {
    setBusy(true);
    setStatus("loading…");
    try {
      let raw;
      if (sourceMode === "import") {
        const html = importedHtml || (await loadImportHtml()).html;
        if (!html) throw new Error("Import HTML in settings or drop a file.");
        raw = parseBookmarksHtml(html);
      } else {
        const tree = await chrome.bookmarks.getTree();
        raw = flattenChromeTree(tree);
      }
      if (!raw.length) throw new Error("No bookmarks found.");

      const config = await loadRulesConfig();
      const useWorker = shouldUseOrganizeWorker(raw.length);
      setStatus(useWorker ? `organizing ${raw.length} (worker)…` : `organizing ${raw.length}…`);
      const opts = { fuzzyDedupe };
      const result = useWorker
        ? await organizeBookmarksOffThread(raw, config, opts)
        : await organizeBookmarks(raw, config, opts);

      if (settings.aiMode === "on") {
        if (!aiReady(settings, apiKeys)) {
          setStatus("AI on but no API key saved");
        } else {
          setStatus("running AI…");
          await applyAiAssist(result.bookmarks, settings, apiKeys, (m) => setStatus(m));
        }
      }

      setLastResult(result);
      setStatus(`ok — ${result.stats.outputCount} kept`);
    } catch (e) {
      setLastResult(null);
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportHtml = async () => {
    if (!lastResult) return;
    const nowTs = String(Math.floor(Date.now() / 1000));
    const inner = buildFolderTreeHtml(lastResult.bookmarks, nowTs);
    const html = emitNetscapeHtml(inner, nowTs);
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadText(`bookmrkd_${stamp}.html`, "text/html;charset=utf-8", html);
    setStatus("export started");
  };

  const openReport = () => {
    if (!lastResult) return;
    const md = buildReportMarkdown(lastResult);
    if (!sessionSet("bookmrkd_report", md)) {
      setStatus("report too large");
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL("src/report/report.html") });
  };

  const saveRules = async () => {
    if (customRules.trim()) JSON.parse(customRules);
    await chrome.storage.sync.set({ customRules: customRules.trim() });
    setStatus("Rules saved");
  };

  const loadBuiltinRules = async () => {
    const mod = await import("../features/organize/rules.json");
    setCustomRules(`${JSON.stringify(mod.default ?? mod, null, 2)}\n`);
  };

  return (
    <div className="advanced-tab">
      <section className="block">
        <h2 className="block-title">Organize Chrome bookmarks</h2>
        <p className="help">
          Bulk dedupe and categorize your browser bookmark tree or imported HTML. Does not modify live
          bookmarks — export HTML and import manually.
        </p>

        <div className="segmented" role="group">
          <button
            type="button"
            className={`seg ${sourceMode === "live" ? "active" : ""}`}
            onClick={() => {
              setSourceMode("live");
              saveSettings({ dataSource: "browser" });
            }}
          >
            Browser
          </button>
          <button
            type="button"
            className={`seg ${sourceMode === "import" ? "active" : ""}`}
            onClick={() => {
              setSourceMode("import");
              saveSettings({ dataSource: "html" });
            }}
          >
            HTML import
          </button>
        </div>

        {sourceMode === "import" ? (
          <div className="html-panel">
            <input
              type="file"
              accept=".html,.htm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                setImportedHtml(text);
                setImportName(f.name);
                await saveImportHtml(text, f.name);
              }}
            />
            {importName ? <p className="help">Loaded: {importName}</p> : null}
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                await clearImportHtml();
                setImportedHtml(null);
                setImportName(null);
              }}
            >
              Clear import
            </button>
          </div>
        ) : null}

        <label className="toggle">
          <input
            type="checkbox"
            checked={fuzzyDedupe}
            onChange={async (e) => {
              setFuzzyDedupe(e.target.checked);
              await saveSettings({ fuzzyDedupe: e.target.checked });
            }}
          />
          Fuzzy dedupe
        </label>

        <div className="actions">
          <button type="button" className="btn primary" disabled={busy} onClick={runAnalysis}>
            Run analysis
          </button>
          <button type="button" className="btn standard" disabled={!lastResult} onClick={exportHtml}>
            Export HTML
          </button>
          <button type="button" className="btn standard" disabled={!lastResult} onClick={openReport}>
            Report
          </button>
        </div>
        {status ? <p className="status-line">{status}</p> : null}

        {lastResult ? (
          <div className="stat-grid">
            <span>input: {lastResult.stats.inputCount}</span>
            <span>kept: {lastResult.stats.outputCount}</span>
            <span>
              removed:{" "}
              {lastResult.stats.exactDuplicatesRemoved + lastResult.stats.fuzzyDuplicatesRemoved}
            </span>
          </div>
        ) : null}
      </section>

      <section className="block">
        <h2 className="block-title">Organization mode</h2>
        <div className="segmented">
          <button
            type="button"
            className={`seg ${settings.aiMode === "off" ? "active" : ""}`}
            onClick={async () => {
              await saveSettings({ aiMode: "off" });
              setSettings({ ...settings, aiMode: "off" });
            }}
          >
            Offline
          </button>
          <button
            type="button"
            className={`seg ${settings.aiMode === "on" ? "active" : ""}`}
            onClick={async () => {
              await saveSettings({ aiMode: "on", aiProvider: RECOMMENDED_PROVIDER });
              setSettings({ ...settings, aiMode: "on", aiProvider: RECOMMENDED_PROVIDER });
            }}
          >
            Online (Gemini)
          </button>
        </div>

        {settings.aiMode === "on" ? (
          <>
            <label className="label">Model</label>
            <select
              className="select"
              value={settings.aiModel}
              onChange={async (e) => {
                await saveSettings({ aiModel: e.target.value });
                setSettings({ ...settings, aiModel: e.target.value });
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {(formatModelLabel as (x: { id: string; label: string }) => string)({
                    id: m.id,
                    label: m.label ?? m.id,
                  })}
                </option>
              ))}
            </select>
            <label className="label">API key</label>
            <input
              className="input"
              type={keyVisible ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button
              type="button"
              className="btn standard"
              onClick={async () => {
                await saveApiKey(settings.aiProvider, apiKeyInput);
                const keys = await loadApiKeys();
                setApiKeys(keys);
                setStatus("API key saved");
              }}
            >
              Save key
            </button>
            <button type="button" className="link-btn" onClick={() => setKeyVisible(!keyVisible)}>
              {keyVisible ? "Hide" : "Show"} key
            </button>
            <p className="help">
              {hasApiKey(settings.aiProvider, apiKeys) ? "Key configured." : "Key required for Online mode."}
            </p>
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                if (!confirm("Remove all API keys?")) return;
                await removeAllApiKeys();
                setApiKeys(await loadApiKeys());
                setApiKeyInput("");
              }}
            >
              Remove all keys
            </button>
          </>
        ) : null}
      </section>

      <section className="block">
        <h2 className="block-title">Custom rules (JSON)</h2>
        <textarea
          className="textarea"
          rows={8}
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder='{"rules":[...]}'
        />
        <div className="actions">
          <button type="button" className="btn standard" onClick={loadBuiltinRules}>
            Load built-in template
          </button>
          <button type="button" className="btn primary" onClick={saveRules}>
            Save rules
          </button>
        </div>
      </section>
    </div>
  );
}
