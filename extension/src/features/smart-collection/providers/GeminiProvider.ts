import { isGeminiRateLimitError } from "../../../lib/gemini-errors";
import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

export class GeminiProvider implements BookmarkClassifierProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini (optional)";
  readonly capabilities = { embeddings: false, batchSize: 20, requiresNetwork: true };

  private config: ProviderConfig | null = null;
  private fallback = new RuleBasedProvider();
  /** After 429, skip Gemini calls for the rest of this analysis run. */
  private rateLimited = false;

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
    const key = this.config?.apiKeys?.gemini;
    if (!key?.trim() || this.rateLimited) return rule;

    try {
      const folderName = folder.segments[folder.segments.length - 1] || "";
      const prompt = `Rate 0.0-1.0 how well this bookmark fits folder "${folderName}". Reply JSON only: {"score":number,"reason":"..."}
Bookmark: ${bookmark.title}
URL: ${bookmark.href}`;
      const model = this.config?.geminiModel || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
        }),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status === 503) this.rateLimited = true;
        return rule;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return rule;
      const parsed = JSON.parse(m[0]) as { score?: number; reason?: string };
      const score = Math.min(1, Math.max(0, Number(parsed.score) || 0));
      return {
        score: score * 0.6 + rule.score * 0.4,
        reasoning: parsed.reason || rule.reasoning,
      };
    } catch (e) {
      if (isGeminiRateLimitError(e)) this.rateLimited = true;
      return rule;
    }
  }

  async dispose(): Promise<void> {
    this.rateLimited = false;
    await this.fallback.dispose();
  }
}
