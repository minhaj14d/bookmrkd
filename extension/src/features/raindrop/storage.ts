import type { RaindropAppCredentials, RaindropOAuthTokens } from "./types";
import { getRaindropEnvCredentials, getRaindropTestToken } from "./env-config";

const TOKENS_KEY = "bookmrkd_raindropTokens";
const MAP_SESSION_KEY = "bookmrkd_raindropCollectionMap";
const MAP_LOCAL_KEY = "bookmrkd_raindropCollectionMap";

export async function loadRaindropCredentials(): Promise<RaindropAppCredentials | null> {
  return getRaindropEnvCredentials();
}

export async function loadRaindropTokens(): Promise<RaindropOAuthTokens | null> {
  const { [TOKENS_KEY]: raw } = await chrome.storage.local.get([TOKENS_KEY]);
  if (!raw?.access_token) return null;
  return raw as RaindropOAuthTokens;
}

export async function saveRaindropTokens(tokens: Omit<RaindropOAuthTokens, "obtainedAt">): Promise<void> {
  await chrome.storage.local.set({
    [TOKENS_KEY]: {
      ...tokens,
      obtainedAt: Date.now(),
    },
  });
}

export async function clearRaindropAuth(): Promise<void> {
  await chrome.storage.local.remove([TOKENS_KEY]);
}

export async function isRaindropConnected(): Promise<boolean> {
  if (getRaindropTestToken()) return true;
  const t = await loadRaindropTokens();
  return Boolean(t?.access_token);
}

export async function saveRaindropCollectionMap(pathToCollectionId: Record<string, number>): Promise<void> {
  await chrome.storage.session.set({ [MAP_SESSION_KEY]: pathToCollectionId });
  await chrome.storage.local.set({ [MAP_LOCAL_KEY]: pathToCollectionId });
}

export async function loadRaindropCollectionMap(): Promise<Record<string, number>> {
  const session = await chrome.storage.session.get([MAP_SESSION_KEY]);
  const fromSession = session[MAP_SESSION_KEY] as Record<string, number> | undefined;
  if (fromSession && Object.keys(fromSession).length > 0) return fromSession;

  const local = await chrome.storage.local.get([MAP_LOCAL_KEY]);
  const fromLocal = local[MAP_LOCAL_KEY] as Record<string, number> | undefined;
  return fromLocal || {};
}

export function raindropBookmarkId(recordId: number): string {
  return `rd:${recordId}`;
}

export function parseRaindropBookmarkId(chromeId: string | null | undefined): number | null {
  if (!chromeId?.startsWith("rd:")) return null;
  const n = Number(chromeId.slice(3));
  return Number.isFinite(n) ? n : null;
}
