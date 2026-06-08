import { AI_PROVIDER_IDS, defaultModelFor, getProvider } from "../features/organize/ai-providers.js";

/** @typedef {import('./ai-providers.js').AiProviderId} AiProviderId */
/** @typedef {'off'|'on'} AiMode */
/** @typedef {'browser'|'html'|'raindrop'} DataSource */

/** @typedef {'rule'|'transformers'|'gemini'|'openai'|'desktop'} ScaProviderId */

/** @typedef {object} BookmrkdSettings
 * @property {AiMode} aiMode
 * @property {AiProviderId} aiProvider
 * @property {string} aiModel
 * @property {DataSource} dataSource
 * @property {boolean} fuzzyDedupe
 * @property {ScaProviderId} scaProvider
 * @property {ScaProviderId} scaFallbackProvider
 * @property {boolean} scaAutoRun
 * @property {number} scaSemanticThreshold
 * @property {number} scaNewFolderMinConfidence
 * @property {number} scaMaxSuggestionsPerKind
 * @property {number} autoTagMaxTags
 * @property {boolean} autoTagUntaggedOnly
 * @property {number} autoTagMaxBookmarks
 * @property {'local'|'gemini'|'auto'} autoTagProvider
 */

const DEFAULTS = /** @type {BookmrkdSettings} */ ({
  aiMode: "off",
  aiProvider: "gemini",
  aiModel: "gemini-2.0-flash",
  dataSource: "browser",
  fuzzyDedupe: true,
  scaProvider: "rule",
  scaFallbackProvider: "rule",
  scaAutoRun: false,
  scaSemanticThreshold: 0.82,
  scaNewFolderMinConfidence: 92,
  scaMaxSuggestionsPerKind: 200,
  autoTagMaxTags: 5,
  autoTagUntaggedOnly: true,
  autoTagMaxBookmarks: 200,
  autoTagProvider: "local",
});

/**
 * @param {Record<string, unknown>} raw
 */
function migrateSettings(raw) {
  const s = { ...DEFAULTS, ...raw };
  /** @type {AiProviderId} */
  let provider = AI_PROVIDER_IDS.includes(s.aiProvider) ? s.aiProvider : "gemini";
  let model = String(s.aiModel || "");
  if (!model && raw.geminiModel) model = String(raw.geminiModel);
  if (!AI_PROVIDER_IDS.includes(/** @type {string} */ (raw.aiProvider))) provider = "gemini";
  s.aiProvider = provider;
  s.aiModel = defaultModelFor(provider, model);
  if (typeof s.fuzzyDedupe !== "boolean") s.fuzzyDedupe = true;
  const ds = String(s.dataSource || "browser");
  s.dataSource = ds === "html" || ds === "raindrop" ? ds : "browser";
  const scaIds = ["rule", "transformers", "gemini", "openai", "desktop"];
  if (!scaIds.includes(s.scaProvider) || s.scaProvider === "desktop") s.scaProvider = "rule";
  if (!scaIds.includes(s.scaFallbackProvider) || s.scaFallbackProvider === "desktop") {
    s.scaFallbackProvider = "rule";
  }
  if (typeof s.scaAutoRun !== "boolean") s.scaAutoRun = false;
  if (typeof s.scaSemanticThreshold !== "number") s.scaSemanticThreshold = 0.82;
  if (typeof s.scaNewFolderMinConfidence !== "number") s.scaNewFolderMinConfidence = 92;
  if (typeof s.scaMaxSuggestionsPerKind !== "number") s.scaMaxSuggestionsPerKind = 200;
  if (typeof s.autoTagMaxTags !== "number") s.autoTagMaxTags = 5;
  if (typeof s.autoTagUntaggedOnly !== "boolean") s.autoTagUntaggedOnly = true;
  if (typeof s.autoTagMaxBookmarks !== "number") s.autoTagMaxBookmarks = 200;
  const atp = String(s.autoTagProvider || "local");
  s.autoTagProvider = atp === "gemini" || atp === "auto" ? atp : "local";
  return s;
}

/**
 * @returns {Promise<BookmrkdSettings>}
 */
export async function loadSettings() {
  const sync = await chrome.storage.sync.get(["bookmrkd_settings", "customRules"]);
  return migrateSettings(sync.bookmrkd_settings || {});
}

/**
 * @param {Partial<BookmrkdSettings>} patch
 */
export async function saveSettings(patch) {
  const cur = await loadSettings();
  const next = migrateSettings({ ...cur, ...patch });
  await chrome.storage.sync.set({
    bookmrkd_settings: {
      aiMode: next.aiMode,
      aiProvider: next.aiProvider,
      aiModel: next.aiModel,
      dataSource: next.dataSource,
      fuzzyDedupe: next.fuzzyDedupe,
      scaProvider: next.scaProvider,
      scaFallbackProvider: next.scaFallbackProvider,
      scaAutoRun: next.scaAutoRun,
      scaSemanticThreshold: next.scaSemanticThreshold,
      scaNewFolderMinConfidence: next.scaNewFolderMinConfidence,
      scaMaxSuggestionsPerKind: next.scaMaxSuggestionsPerKind,
      autoTagMaxTags: next.autoTagMaxTags,
      autoTagUntaggedOnly: next.autoTagUntaggedOnly,
      autoTagMaxBookmarks: next.autoTagMaxBookmarks,
      autoTagProvider: next.autoTagProvider,
    },
  });
  return next;
}

/**
 * @param {BookmrkdSettings} settings
 * @param {Record<AiProviderId, string>} [apiKeys]
 * @returns {import('../features/smart-collection/types').ProviderConfig}
 */
export function toScaProviderConfig(settings, apiKeys) {
  return {
    settings: {
      scaProvider: settings.scaProvider,
      scaFallbackProvider: settings.scaFallbackProvider,
      scaAutoRun: settings.scaAutoRun,
      scaSemanticThreshold: settings.scaSemanticThreshold,
      scaNewFolderMinConfidence: settings.scaNewFolderMinConfidence,
      scaMaxSuggestionsPerKind: settings.scaMaxSuggestionsPerKind,
      fuzzyDedupe: settings.fuzzyDedupe,
    },
    apiKeys: apiKeys || {},
    geminiModel: settings.aiModel,
    openaiModel: "gpt-4o-mini",
  };
}

/**
 * @returns {Promise<Record<AiProviderId, string>>}
 */
export async function loadApiKeys() {
  const { bookmrkd_apiKeys } = await chrome.storage.local.get(["bookmrkd_apiKeys"]);
  const k = bookmrkd_apiKeys || {};
  /** @type {Record<AiProviderId, string>} */
  const out = {};
  for (const id of AI_PROVIDER_IDS) out[id] = k[id] || "";
  return out;
}

/**
 * @param {AiProviderId} provider
 * @param {string} key
 */
export async function saveApiKey(provider, key) {
  const keys = await loadApiKeys();
  keys[provider] = key.trim();
  await chrome.storage.local.set({ bookmrkd_apiKeys: keys });
}

export async function removeAllApiKeys() {
  await chrome.storage.local.remove(["bookmrkd_apiKeys"]);
}

/**
 * @param {AiProviderId} provider
 * @param {Record<AiProviderId, string>} [keys]
 */
export function hasApiKey(provider, keys) {
  const k = keys?.[provider] ?? "";
  return Boolean(String(k).trim());
}

/**
 * @param {BookmrkdSettings} settings
 * @param {Record<AiProviderId, string>} keys
 */
export function aiReady(settings, keys) {
  return settings.aiMode === "on" && hasApiKey(settings.aiProvider, keys);
}

/**
 * @param {AiProviderId} provider
 */
export function keyHelpUrl(provider) {
  return getProvider(provider).keyHelp;
}

export async function saveImportHtml(html, filename) {
  await chrome.storage.local.set({
    bookmrkd_importHtml: html,
    bookmrkd_importName: filename,
  });
}

export async function loadImportHtml() {
  const { bookmrkd_importHtml, bookmrkd_importName } = await chrome.storage.local.get([
    "bookmrkd_importHtml",
    "bookmrkd_importName",
  ]);
  return {
    html: bookmrkd_importHtml || null,
    name: bookmrkd_importName || null,
  };
}

export async function clearImportHtml() {
  await chrome.storage.local.remove(["bookmrkd_importHtml", "bookmrkd_importName"]);
}
