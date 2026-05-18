/** @typedef {{ version?: number, settings?: Record<string, unknown>, rules?: unknown[] }} RulesConfig */

const DEFAULT_CONFIG = {
  version: 1,
  settings: { fuzzy_duplicate_title_ratio: 0.88 },
  rules: [],
};

/**
 * @returns {Promise<RulesConfig>}
 */
async function fetchBuiltinRules() {
  const url = chrome.runtime.getURL("lib/rules.json");
  const res = await fetch(url);
  if (!res.ok) {
    console.warn("[bookmrkd] rules.json fetch failed:", res.status);
    return { ...DEFAULT_CONFIG };
  }
  const data = await res.json();
  return data && typeof data === "object" ? /** @type {RulesConfig} */ (data) : { ...DEFAULT_CONFIG };
}

/**
 * Custom rules in storage are merged on top of built-in rules (higher `priority` wins at match time).
 * @returns {Promise<RulesConfig>}
 */
export async function loadRulesConfig() {
  const builtIn = await fetchBuiltinRules();

  try {
    const stored = await chrome.storage.sync.get(["customRules"]);
    const raw = stored.customRules;
    if (typeof raw === "string" && raw.trim()) {
      const custom = JSON.parse(raw);
      if (custom && typeof custom === "object") {
        const customRules = Array.isArray(custom.rules) ? custom.rules : [];
        const builtInRules = Array.isArray(builtIn.rules) ? builtIn.rules : [];
        return {
          version: custom.version ?? builtIn.version ?? 1,
          settings: { ...builtIn.settings, ...(custom.settings || {}) },
          rules: [...customRules, ...builtInRules],
        };
      }
    }
  } catch (e) {
    console.warn("[bookmrkd] Invalid custom rules in storage:", e);
  }

  return builtIn;
}
