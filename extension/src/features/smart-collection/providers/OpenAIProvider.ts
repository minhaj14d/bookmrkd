import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

export class OpenAIProvider implements BookmarkClassifierProvider {
  readonly id = "openai";
  readonly label = "OpenAI (optional)";
  readonly capabilities = { embeddings: false, batchSize: 20, requiresNetwork: true };

  private config: ProviderConfig | null = null;
  private fallback = new RuleBasedProvider();

  async init(config: ProviderConfig): Promise<void> {
    this.config = config;
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
    const key = this.config?.apiKeys?.openai;
    if (!key?.trim()) return rule;

    try {
      const folderName = folder.segments[folder.segments.length - 1] || "";
      const model = this.config?.openaiModel || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 128,
          messages: [
            {
              role: "user",
              content: `Rate 0.0-1.0 fit for folder "${folderName}". JSON only {"score":number,"reason":"..."}\nTitle: ${bookmark.title}\nURL: ${bookmark.href}`,
            },
          ],
        }),
      });
      if (!res.ok) return rule;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return rule;
      const parsed = JSON.parse(m[0]) as { score?: number; reason?: string };
      const score = Math.min(1, Math.max(0, Number(parsed.score) || 0));
      return {
        score: score * 0.6 + rule.score * 0.4,
        reasoning: parsed.reason || rule.reasoning,
      };
    } catch {
      return rule;
    }
  }

  async dispose(): Promise<void> {
    await this.fallback.dispose();
  }
}
