import { TransformersProvider } from "../smart-collection/providers/TransformersProvider";
import type { ProviderConfig } from "../smart-collection/types";

let shared: TransformersProvider | null = null;

export function getEmbeddingTagger(): TransformersProvider {
  if (!shared) shared = new TransformersProvider();
  return shared;
}

export async function initEmbeddingTagger(
  onStatus?: (message: string) => void
): Promise<TransformersProvider> {
  const p = getEmbeddingTagger();
  p.setStatusCallback(onStatus || (() => {}));
  const config: ProviderConfig = {
    settings: {
      scaProvider: "transformers",
      scaFallbackProvider: "rule",
      scaAutoRun: false,
      scaSemanticThreshold: 0.82,
      scaNewFolderMinConfidence: 92,
      scaMaxSuggestionsPerKind: 200,
      fuzzyDedupe: true,
    },
  };
  await p.init(config);
  return p;
}

export async function disposeEmbeddingTagger(): Promise<void> {
  if (shared) {
    await shared.dispose();
    shared = null;
  }
}
