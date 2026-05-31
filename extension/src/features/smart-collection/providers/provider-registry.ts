import type { ScaProviderId, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

export async function createProvider(
  id: ScaProviderId,
  config: ProviderConfig
): Promise<BookmarkClassifierProvider> {
  let provider: BookmarkClassifierProvider;
  switch (id) {
    case "transformers": {
      const { TransformersProvider } = await import("./TransformersProvider");
      provider = new TransformersProvider();
      break;
    }
    case "gemini": {
      const { GeminiProvider } = await import("./GeminiProvider");
      provider = new GeminiProvider();
      break;
    }
    case "openai": {
      const { OpenAIProvider } = await import("./OpenAIProvider");
      provider = new OpenAIProvider();
      break;
    }
    case "desktop": {
      const { DesktopBridgeProvider } = await import("./DesktopBridgeProvider");
      provider = new DesktopBridgeProvider();
      break;
    }
    case "rule":
    default:
      provider = new RuleBasedProvider();
  }
  await provider.init(config);
  return provider;
}

export async function createProviderStack(
  config: ProviderConfig
): Promise<BookmarkClassifierProvider[]> {
  const primary = await createProvider(config.settings.scaProvider, config);
  const stack: BookmarkClassifierProvider[] = [primary];
  if (config.settings.scaFallbackProvider !== config.settings.scaProvider) {
    stack.push(await createProvider(config.settings.scaFallbackProvider, config));
  } else if (config.settings.scaProvider !== "rule") {
    stack.push(await createProvider("rule", config));
  }
  return stack;
}
