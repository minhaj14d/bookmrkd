/**

 * AI provider registry — free-tier models only (Google Gemini API).

 * @typedef {'gemini'} AiProviderId

 * @typedef {'gemini'} AiBackend

 * @typedef {{ id: string, label: string, recommended?: boolean }} AiModel

 */



/** @type {AiProviderId} */

export const RECOMMENDED_PROVIDER = "gemini";



/** @type {Record<AiProviderId, { label: string, recommended?: boolean, keyHelp: string, backend: AiBackend, models: AiModel[] }>} */

export const AI_PROVIDERS = {

  gemini: {

    label: "Google Gemini",

    recommended: true,

    keyHelp: "https://aistudio.google.com/apikey",

    backend: "gemini",

    models: [

      {

        id: "gemini-2.0-flash",

        label: "Gemini 2.0 Flash",

        recommended: true,

      },

      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },

      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },

    ],

  },

};



/** @type {AiProviderId[]} */

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS);



/**

 * @param {AiProviderId} id

 */

export function getProvider(id) {

  return AI_PROVIDERS[id] || AI_PROVIDERS.gemini;

}



/**

 * @param {AiModel} model

 */

export function formatModelLabel(model) {

  return model.recommended ? `${model.label} — recommended` : model.label;

}



/**

 * @param {AiProviderId} provider

 * @param {string} modelId

 */

export function defaultModelFor(provider, modelId) {

  const p = getProvider(provider);

  const recommended = p.models.find((m) => m.recommended);

  if (modelId && p.models.some((m) => m.id === modelId)) return modelId;

  return recommended?.id || p.models[0]?.id || "";

}


