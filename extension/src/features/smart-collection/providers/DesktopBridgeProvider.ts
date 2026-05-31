import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

const NATIVE_HOST = "io.bookmrkd.llm_bridge";

/** Optional native messaging to a local GGUF / llama.cpp server. */
export class DesktopBridgeProvider implements BookmarkClassifierProvider {
  readonly id = "desktop";
  readonly label = "Desktop bridge (GGUF)";
  readonly capabilities = { embeddings: false, batchSize: 8, requiresNetwork: false };

  private fallback = new RuleBasedProvider();

  async init(config: ProviderConfig): Promise<void> {
    await this.fallback.init(config);
  }

  async embedTexts(texts: string[]): Promise<Float32Array[]> {
    return this.fallback.embedTexts(texts);
  }

  async scoreBookmarkFolder(
    bookmark: BookmarkRecord,
    folder: FolderProfile,
    neighbors: BookmarkRecord[]
  ): Promise<FolderScoreResult> {
    const rule = await this.fallback.scoreBookmarkFolder(bookmark, folder, neighbors);
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST);
      const folderName = folder.segments[folder.segments.length - 1] || "";
      const score = await new Promise<number>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout")), 8000);
        port.onMessage.addListener((msg: { score?: number }) => {
          clearTimeout(t);
          port.disconnect();
          resolve(Math.min(1, Math.max(0, Number(msg.score) || 0)));
        });
        port.onDisconnect.addListener(() => {
          clearTimeout(t);
          reject(new Error("disconnected"));
        });
        port.postMessage({
          type: "score",
          bookmark: { title: bookmark.title, href: bookmark.href },
          folder: folderName,
        });
      });
      return {
        score: score * 0.65 + rule.score * 0.35,
        reasoning: `desktop bridge score ${(score * 100).toFixed(0)}%; ${rule.reasoning}`,
      };
    } catch {
      return rule;
    }
  }

  async dispose(): Promise<void> {
    await this.fallback.dispose();
  }
}
