import {
  flattenChromeTree,
  organizeBookmarks,
  loadRulesConfig,
  buildFolderTreeHtml,
  emitNetscapeHtml,
  buildReportMarkdown,
  parseBookmarksHtml,
} from "./lib/organizer.js";
import { applyAiAssist } from "./lib/ai-categorize.js";
import { loadSettings, saveSettings, loadApiKeys, loadImportHtml, aiReady } from "./lib/settings.js";
import { getProvider } from "./lib/ai-providers.js";
import { downloadText, sessionSet } from "./lib/utils.js";
import {
  organizeBookmarksOffThread,
  shouldUseOrganizeWorker,
} from "./lib/organize-client.js";

/** @type {Awaited<ReturnType<typeof organizeBookmarks>>|null} */
let lastResult = null;
let analysisGeneration = 0;
/** @type {'live'|'import'} */
let sourceMode = "live";
/** @type {string|null} */
let importedHtml = null;

const $ = (id) => document.getElementById(id);

function showStatus(msg, kind = "info") {
  const el = $("status");
  el.hidden = false;
  el.className = `status ${kind}`;
  el.textContent = msg;
}

function setProgress(on) {
  $("progress").hidden = !on;
  $("progress").setAttribute("aria-hidden", on ? "false" : "true");
}

function setBusy(busy) {
  $("btn-analyze").disabled = busy;
  $("btn-export").disabled = busy || !lastResult;
  $("btn-report").disabled = busy || !lastResult;
  $("fuzzy-dedupe").disabled = busy;
  $("tab-live").disabled = busy;
  $("tab-import").disabled = busy;
}

function hidePanels() {
  $("results").hidden = true;
  $("empty").hidden = true;
}

function updateModeBadge(settings) {
  const badge = $("mode-badge");
  if (!badge) return;
  badge.hidden = false;
  if (settings.aiMode === "on") {
    const provider = getProvider(settings.aiProvider).label;
    badge.textContent = "Online";
    badge.classList.remove("offline");
    badge.classList.add("online");
    badge.title = `Cloud assist on — uncertain links may be sent to ${provider} (title + URL only).`;
    badge.setAttribute("aria-label", `Online mode. AI provider: ${provider}.`);
  } else {
    badge.textContent = "Offline";
    badge.classList.remove("online");
    badge.classList.add("offline");
    badge.title = "Offline mode — all sorting runs on this device. Nothing is sent to the internet.";
    badge.setAttribute("aria-label", "Offline mode. No data sent to the internet.");
  }
}

function renderResults(result) {
  $("results").hidden = false;
  $("empty").hidden = true;
  $("stat-input").textContent = String(result.stats.inputCount);
  $("stat-kept").textContent = String(result.stats.outputCount);
  $("stat-dupes").textContent = String(
    result.stats.exactDuplicatesRemoved + result.stats.fuzzyDuplicatesRemoved
  );

  const list = $("category-list");
  list.replaceChildren();
  for (const [cat, n] of result.stats.categories.slice(0, 14)) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = cat;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(` · ${n}`));
    list.appendChild(li);
  }

  const logItems = [
    ...result.exactRemoved.slice(0, 8).map((r) => `exact: ${r.removedTitle}`),
    ...result.fuzzyLog.slice(0, 8).map((r) => `fuzzy: ${r.removed}`),
  ];
  $("log-count").textContent = String(
    result.stats.exactDuplicatesRemoved + result.stats.fuzzyDuplicatesRemoved
  );
  const logList = $("log-list");
  logList.replaceChildren();
  if (!logItems.length) {
    const li = document.createElement("li");
    li.textContent = "no duplicates removed";
    logList.appendChild(li);
  } else {
    for (const line of logItems) {
      const li = document.createElement("li");
      li.textContent = line;
      logList.appendChild(li);
    }
  }
}

async function loadBookmarkRecords() {
  if (sourceMode === "import") {
    if (!importedHtml) {
      const stored = await loadImportHtml();
      importedHtml = stored.html;
      if (stored.name) {
        $("import-filename").hidden = false;
        $("import-filename").textContent = stored.name;
        $("drop-zone").classList.add("has-file");
      }
    }
    if (!importedHtml) throw new Error("Import HTML in Settings or drop a file here.");
    const records = parseBookmarksHtml(importedHtml);
    if (!records.length) throw new Error("No bookmarks found in HTML file.");
    return records;
  }
  const tree = await chrome.bookmarks.getTree();
  const flat = flattenChromeTree(tree);
  if (!flat.length) throw new Error("No bookmarks found in this browser.");
  return flat;
}

async function runAnalysis() {
  const gen = ++analysisGeneration;
  setBusy(true);
  setProgress(true);
  hidePanels();

  try {
    const settings = await loadSettings();
    const keys = await loadApiKeys();
    updateModeBadge(settings);

    showStatus("loading bookmarks…", "info");
    const raw = await loadBookmarkRecords();
    if (gen !== analysisGeneration) return;

    const useWorker = shouldUseOrganizeWorker(raw.length);
    showStatus(
      useWorker
        ? `organizing ${raw.length} links (background worker)…`
        : `organizing ${raw.length} links…`,
      "info"
    );
    const config = await loadRulesConfig();
    if (gen !== analysisGeneration) return;

    const fuzzy = $("fuzzy-dedupe").checked;
    const opts = { fuzzyDedupe: fuzzy };
    lastResult = useWorker
      ? await organizeBookmarksOffThread(raw, config, opts)
      : await organizeBookmarks(raw, config, opts);
    if (gen !== analysisGeneration) return;

    if (settings.aiMode === "on") {
      if (!aiReady(settings, keys)) {
        showStatus("AI enabled but no API key — add one in Settings", "error");
      } else {
        showStatus("running AI categorization…", "info");
        const { errors } = await applyAiAssist(lastResult.bookmarks, settings, keys, (m) => showStatus(m, "info"));
        if (gen !== analysisGeneration) return;
        if (errors.length) console.warn("[bookmrkd] AI:", errors);
      }
    }

    renderResults(lastResult);
    const aiNote = settings.aiMode === "on" ? " · ai" : "";
    showStatus(
      `ok — ${lastResult.stats.outputCount} kept${aiNote}`,
      "success"
    );
  } catch (err) {
    if (gen !== analysisGeneration) return;
    console.error("[bookmrkd]", err);
    lastResult = null;
    $("empty").hidden = false;
    $("results").hidden = true;
    showStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    if (gen === analysisGeneration) {
      setBusy(false);
      setProgress(false);
    }
  }
}

async function exportHtml() {
  if (!lastResult) return;
  try {
    const nowTs = String(Math.floor(Date.now() / 1000));
    const inner = buildFolderTreeHtml(lastResult.bookmarks, nowTs);
    const html = emitNetscapeHtml(inner, nowTs);
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadText(`bookmrkd_${stamp}.html`, "text/html;charset=utf-8", html);
    showStatus("export started — import in Bookmark Manager", "success");
  } catch (err) {
    showStatus(err instanceof Error ? err.message : String(err), "error");
  }
}

function openReport() {
  if (!lastResult) return;
  const md = buildReportMarkdown(lastResult);
  if (!sessionSet("bookmrkd_report", md)) {
    showStatus("report too large for session storage", "error");
    return;
  }
  chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
}

function setSourceMode(mode) {
  sourceMode = mode;
  const live = mode === "live";
  $("tab-live").classList.toggle("active", live);
  $("tab-import").classList.toggle("active", !live);
  $("tab-live").setAttribute("aria-selected", live ? "true" : "false");
  $("tab-import").setAttribute("aria-selected", live ? "false" : "true");
  $("panel-live").hidden = !live;
  $("panel-live").classList.toggle("hidden", !live);
  $("panel-import").hidden = live;
  $("panel-import").classList.toggle("hidden", live);
}

async function handleImportFile(file) {
  if (!file) return;
  importedHtml = await file.text();
  $("import-filename").hidden = false;
  $("import-filename").textContent = file.name;
  $("drop-zone").classList.add("has-file");
}

function initTabs() {
  $("tab-live").addEventListener("click", () => setSourceMode("live"));
  $("tab-import").addEventListener("click", () => setSourceMode("import"));
}

function initImport() {
  const zone = $("drop-zone");
  const input = $("file-input");
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) handleImportFile(file);
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImportFile(file);
  });
}

async function initFromSettings() {
  const settings = await loadSettings();
  updateModeBadge(settings);
  setSourceMode(settings.dataSource === "html" ? "import" : "live");
  if (settings.dataSource === "html") {
    const { html, name } = await loadImportHtml();
    if (html) {
      importedHtml = html;
      if (name) {
        $("import-filename").hidden = false;
        $("import-filename").textContent = name;
        $("drop-zone").classList.add("has-file");
      }
    }
  }
  const manifest = chrome.runtime.getManifest();
  $("version").textContent = `v${manifest.version}`;
  $("fuzzy-dedupe").checked = settings.fuzzyDedupe;
}

$("btn-analyze").addEventListener("click", runAnalysis);
$("btn-export").addEventListener("click", exportHtml);
$("btn-report").addEventListener("click", openReport);
$("btn-retry-empty").addEventListener("click", runAnalysis);
$("btn-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("fuzzy-dedupe").addEventListener("change", async () => {
  await saveSettings({ fuzzyDedupe: $("fuzzy-dedupe").checked });
  if (lastResult) runAnalysis();
});

initTabs();
initImport();
initFromSettings().then(() => showStatus('configure in ⚙ or press "run analysis"', "info"));
