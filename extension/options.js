import {
  loadSettings,
  saveSettings,
  loadApiKeys,
  saveApiKey,
  removeAllApiKeys,
  hasApiKey,
  aiReady,
  keyHelpUrl,
  saveImportHtml,
  loadImportHtml,
  clearImportHtml,
} from "./lib/settings.js";
import { AI_PROVIDERS, defaultModelFor, formatModelLabel, RECOMMENDED_PROVIDER } from "./lib/ai-providers.js";
import { downloadText } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);
let settings;
/** @type {Record<string, string>} */
let apiKeys;
let keyVisible = false;

function toast(msg, ms = 2800) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

function setEyeIcon() {
  const use = $("btn-toggle-key").querySelector("use");
  if (use) use.setAttribute("href", keyVisible ? "icons/sprites.svg#icon-eye-off" : "icons/sprites.svg#icon-eye");
}

function fillModelSelect() {
  const prov = /** @type {keyof typeof AI_PROVIDERS} */ ($("ai-provider").value);
  const sel = $("ai-model");
  const models = AI_PROVIDERS[prov]?.models || [];
  sel.replaceChildren();
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = formatModelLabel(m);
    sel.appendChild(opt);
  }
  sel.value = defaultModelFor(prov, settings.aiModel);
}

function updateKeyHelpLink() {
  const prov = /** @type {keyof typeof AI_PROVIDERS} */ ($("ai-provider").value);
  const link = $("key-help-link");
  if (link) {
    link.href = keyHelpUrl(prov);
    link.textContent = AI_PROVIDERS[prov]?.label || "your provider";
  }
}

function updateApiStatus() {
  const prov = /** @type {keyof typeof AI_PROVIDERS} */ ($("ai-provider").value);
  const card = $("api-status");
  const ok = hasApiKey(prov, apiKeys);
  card.dataset.state = ok ? "ok" : "missing";
  $("api-status-title").textContent = ok ? "API key configured" : "API key required";
  $("api-status-sub").textContent = ok ? "You're all set." : "Paste a key and save.";
}

function updateAiPanel() {
  const on = settings.aiMode === "on";
  $("ai-panel").hidden = !on;
  $("mode-off").classList.toggle("active", !on);
  $("mode-on").classList.toggle("active", on);
  $("mode-off").setAttribute("aria-pressed", on ? "false" : "true");
  $("mode-on").setAttribute("aria-pressed", on ? "true" : "false");
}

function wireSegmentedKeyboard() {
  const group = document.querySelector(".segmented");
  if (!group) return;
  group.addEventListener("keydown", (e) => {
    const buttons = /** @type {HTMLButtonElement[]} */ ([...group.querySelectorAll(".seg")]);
    const i = buttons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (i < 0) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      buttons[Math.min(buttons.length - 1, i + 1)]?.focus();
    }
  });
}

function updateHtmlPanel() {
  $("html-import-panel").hidden = $("data-source").value !== "html";
}

async function refreshImportLabel() {
  const { name } = await loadImportHtml();
  const drop = $("html-drop");
  const label = $("html-drop-label");
  if (name) {
    drop.classList.add("has-file");
    label.textContent = name;
    $("btn-clear-html").hidden = false;
  } else {
    drop.classList.remove("has-file");
    label.textContent = "Choose bookmarks.html or drag here";
    $("btn-clear-html").hidden = true;
  }
}

async function handleHtmlFile(file) {
  if (!file) return;
  await saveImportHtml(await file.text(), file.name);
  await saveSettings({ dataSource: "html" });
  settings.dataSource = "html";
  $("data-source").value = "html";
  updateHtmlPanel();
  await refreshImportLabel();
  toast(`Imported ${file.name}`);
}

async function load() {
  settings = await loadSettings();
  apiKeys = await loadApiKeys();

  $("data-source").value = settings.dataSource;
  settings.aiProvider = RECOMMENDED_PROVIDER;
  $("ai-provider").value = RECOMMENDED_PROVIDER;
  fillModelSelect();
  $("fuzzy-dedupe-default").checked = settings.fuzzyDedupe;

  const sync = await chrome.storage.sync.get(["customRules"]);
  $("custom-rules").value = sync.customRules || "";

  $("api-key-input").value = apiKeys[settings.aiProvider] || "";
  $("api-key-input").type = "password";
  keyVisible = false;
  setEyeIcon();
  updateKeyHelpLink();

  updateAiPanel();
  updateApiStatus();
  updateHtmlPanel();
  await refreshImportLabel();

  $("version").textContent = `bookmrkd v${chrome.runtime.getManifest().version}`;
  const privacyLink = $("privacy-policy-link");
  if (privacyLink) privacyLink.href = chrome.runtime.getURL("privacy.html");
}

$("mode-off").addEventListener("click", async () => {
  settings.aiMode = "off";
  await saveSettings({ aiMode: "off" });
  updateAiPanel();
});

$("mode-on").addEventListener("click", async () => {
  settings.aiMode = "on";
  settings.aiProvider = RECOMMENDED_PROVIDER;
  await saveSettings({ aiMode: "on", aiProvider: RECOMMENDED_PROVIDER });
  updateAiPanel();
  updateApiStatus();
});

$("data-source").addEventListener("change", async () => {
  settings.dataSource = /** @type {'browser'|'html'} */ ($("data-source").value);
  await saveSettings({ dataSource: settings.dataSource });
  updateHtmlPanel();
});

$("fuzzy-dedupe-default").addEventListener("change", async () => {
  settings.fuzzyDedupe = $("fuzzy-dedupe-default").checked;
  await saveSettings({ fuzzyDedupe: settings.fuzzyDedupe });
  toast("Default saved for popup");
});

$("ai-model").addEventListener("change", async () => {
  settings.aiModel = $("ai-model").value;
  await saveSettings({ aiModel: settings.aiModel });
});

$("btn-save-key").addEventListener("click", async () => {
  const prov = /** @type {keyof typeof AI_PROVIDERS} */ ($("ai-provider").value);
  const key = $("api-key-input").value.trim();
  if (!key) {
    toast("Enter an API key first");
    return;
  }
  await saveApiKey(prov, key);
  apiKeys = await loadApiKeys();
  updateApiStatus();
  toast("API key saved");
});

$("btn-toggle-key").addEventListener("click", () => {
  keyVisible = !keyVisible;
  $("api-key-input").type = keyVisible ? "text" : "password";
  setEyeIcon();
});

$("btn-remove-keys").addEventListener("click", async () => {
  if (!confirm("Remove all saved API keys for every provider?")) return;
  await removeAllApiKeys();
  apiKeys = await loadApiKeys();
  $("api-key-input").value = "";
  updateApiStatus();
  toast("All API keys removed");
});

const drop = $("html-drop");
const fileIn = $("html-file");
drop.addEventListener("click", () => fileIn.click());
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileIn.click();
  }
});
fileIn.addEventListener("change", () => {
  const f = fileIn.files?.[0];
  if (f) handleHtmlFile(f);
});
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("dragover");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("dragover");
  const f = e.dataTransfer?.files?.[0];
  if (f) handleHtmlFile(f);
});
$("btn-clear-html").addEventListener("click", async () => {
  await clearImportHtml();
  await refreshImportLabel();
  toast("Import cleared");
});

$("btn-start").addEventListener("click", async () => {
  if (settings.dataSource === "html" && !(await loadImportHtml()).html) {
    toast("Import an HTML file first");
    return;
  }
  if (settings.aiMode === "on" && !aiReady(settings, apiKeys)) {
    toast("Save your Gemini API key first");
    return;
  }
  try {
    await chrome.action.openPopup();
  } catch {
    toast("Click the bookmrkd toolbar icon");
  }
});

$("btn-export-rules").addEventListener("click", async () => {
  const text = $("custom-rules").value.trim();
  if (!text) {
    toast("Nothing to export — add rules or load the built-in template");
    return;
  }
  try {
    JSON.parse(text);
  } catch (e) {
    $("rules-error").hidden = false;
    $("rules-error").textContent = `Fix JSON before export: ${e.message}`;
    return;
  }
  $("rules-error").hidden = true;
  const name = `bookmrkd-rules-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    await downloadText(name, "application/json", `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    toast("Rules exported");
  } catch (e) {
    toast(e instanceof Error ? e.message : "Export failed");
  }
});

$("btn-import-rules").addEventListener("click", () => $("rules-file").click());

$("rules-file").addEventListener("change", () => {
  const f = $("rules-file").files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "").trim();
    try {
      JSON.parse(text);
      $("custom-rules").value = text;
      $("rules-error").hidden = true;
      toast(`Loaded ${f.name} — click Save rules to apply`);
    } catch (e) {
      $("rules-error").hidden = false;
      $("rules-error").textContent = `Invalid JSON: ${e.message}`;
    }
    $("rules-file").value = "";
  };
  reader.readAsText(f);
});

$("btn-load-builtin-rules").addEventListener("click", async () => {
  try {
    const res = await fetch(chrome.runtime.getURL("lib/rules.json"));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $("custom-rules").value = `${JSON.stringify(data, null, 2)}\n`;
    $("rules-error").hidden = true;
    toast("Built-in template loaded — edit and Save, or Export a copy");
  } catch (e) {
    toast(e instanceof Error ? e.message : "Could not load template");
  }
});

$("btn-save-rules").addEventListener("click", async () => {
  const rulesText = $("custom-rules").value.trim();
  if (rulesText) {
    try {
      JSON.parse(rulesText);
    } catch (e) {
      $("rules-error").hidden = false;
      $("rules-error").textContent = `Invalid JSON: ${e.message}`;
      return;
    }
  }
  $("rules-error").hidden = true;
  await chrome.storage.sync.set({ customRules: rulesText });
  toast("Rules saved");
});

wireSegmentedKeyboard();
load().catch(() => toast("Failed to load settings"));
