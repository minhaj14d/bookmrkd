import { getFeedbackMap, upsertFeedback, type ScaFeedbackEntry } from "../../storage/sca-idb";
import type { Suggestion, SuggestionKind } from "./types";
import { pathKey } from "./structure-guard";

export function buildPatternKey(
  kind: SuggestionKind,
  fromPath: string[],
  toPath?: string[],
  domain?: string
): string {
  const from = pathKey(fromPath);
  const to = toPath?.length ? pathKey(toPath) : "";
  const dom = domain || "";
  return `${kind}:${from}->${to}:${dom}`;
}

export async function recordFeedback(
  suggestion: Suggestion,
  action: "accept" | "reject" | "ignore"
): Promise<void> {
  const map = await getFeedbackMap();
  const existing = map.get(suggestion.patternKey);
  const entry: ScaFeedbackEntry = {
    patternKey: suggestion.patternKey,
    action,
    count: (existing?.count || 0) + 1,
    lastAt: Date.now(),
  };
  await upsertFeedback(entry);
}

export function adjustConfidence(
  base: number,
  patternKey: string,
  feedback: Map<string, ScaFeedbackEntry>
): number {
  const entry = feedback.get(patternKey);
  if (!entry) return base;
  if (entry.action === "reject" || entry.action === "ignore") {
    const penalty = Math.min(0.5, entry.count * 0.08);
    return Math.max(0, base * (1 - penalty));
  }
  if (entry.action === "accept") {
    return Math.min(100, base + Math.min(5, entry.count));
  }
  return base;
}
