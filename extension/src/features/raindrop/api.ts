import type { RaindropCollection, RaindropItem, RaindropOAuthTokens } from "./types";
import { getRaindropTestToken } from "./env-config";
import { loadRaindropCredentials, loadRaindropTokens, saveRaindropTokens } from "./storage";
import { raindropTokenExchangeError } from "./oauth-errors";

const API = "https://api.raindrop.io/rest/v1";
const TOKEN_URL = "https://raindrop.io/oauth/access_token";

/** Access tokens expire after ~2 weeks; refresh using expires_in (seconds). */
function tokenShouldRefresh(tokens: RaindropOAuthTokens): boolean {
  if (!tokens.expires_in || !tokens.obtainedAt) return false;
  const expiresAt = tokens.obtainedAt + tokens.expires_in * 1000;
  return Date.now() >= expiresAt - 5 * 60 * 1000;
}

async function refreshAccessToken(): Promise<string> {
  const creds = await loadRaindropCredentials();
  const tokens = await loadRaindropTokens();
  if (!creds || !tokens?.refresh_token) {
    throw new Error("Raindrop session expired. Click Connect Raindrop again.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: tokens.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(raindropTokenExchangeError(data) || "Could not refresh Raindrop token. Connect again.");
  }

  await saveRaindropTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  });

  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const testToken = getRaindropTestToken();
  if (testToken) return testToken;

  const tokens = await loadRaindropTokens();
  if (!tokens?.access_token) throw new Error("Not connected to Raindrop.");
  if (tokens.refresh_token && tokenShouldRefresh(tokens)) {
    return refreshAccessToken();
  }
  return tokens.access_token;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  let res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string>),
      },
    });
  }

  return res;
}

export async function fetchAllCollections(): Promise<RaindropCollection[]> {
  const [rootRes, childRes] = await Promise.all([
    apiFetch("/collections"),
    apiFetch("/collections/childrens"),
  ]);

  if (!rootRes.ok) throw new Error(`Raindrop collections failed (${rootRes.status})`);
  if (!childRes.ok) throw new Error(`Raindrop child collections failed (${childRes.status})`);

  const rootJson = await rootRes.json();
  const childJson = await childRes.json();
  const items = [...(rootJson.items || []), ...(childJson.items || [])] as RaindropCollection[];
  const byId = new Map<number, RaindropCollection>();
  for (const c of items) byId.set(c._id, c);
  return [...byId.values()];
}

export function buildCollectionPathMap(
  collections: RaindropCollection[]
): { pathToCollectionId: Record<string, number>; pathForId: (id: number) => string[] } {
  const byId = new Map(collections.map((c) => [c._id, c]));

  function pathForId(id: number): string[] {
    const c = byId.get(id);
    if (!c) return [];
    const parentId = c.parent?.$id;
    if (parentId != null && parentId > 0 && byId.has(parentId)) {
      return [...pathForId(parentId), c.title];
    }
    return [c.title];
  }

  const pathToCollectionId: Record<string, number> = {};
  for (const c of collections) {
    const path = pathForId(c._id);
    if (path.length) pathToCollectionId[path.join(" > ")] = c._id;
  }

  return { pathToCollectionId, pathForId };
}

/** Raindrop: `0` = all except Unsorted/Trash; `-1` = Unsorted only. */
async function fetchRaindropsInCollection(
  collectionId: number,
  onProgress?: (loaded: number, collectionId: number) => void
): Promise<RaindropItem[]> {
  const all: RaindropItem[] = [];
  let page = 0;
  const perpage = 50;

  while (true) {
    const res = await apiFetch(`/raindrops/${collectionId}?perpage=${perpage}&page=${page}`);
    if (!res.ok) {
      throw new Error(`Raindrop bookmarks failed for collection ${collectionId} (${res.status})`);
    }
    const json = await res.json();
    const items = (json.items || []) as RaindropItem[];
    if (!items.length) break;
    all.push(...items);
    onProgress?.(all.length, collectionId);
    if (items.length < perpage) break;
    page++;
    if (page > 200) break;
  }

  return all;
}

export async function fetchAllRaindrops(
  onProgress?: (loaded: number) => void
): Promise<RaindropItem[]> {
  const byId = new Map<number, RaindropItem>();

  const main = await fetchRaindropsInCollection(0, (n) => onProgress?.(byId.size + n));
  for (const item of main) byId.set(item._id, item);

  const unsorted = await fetchRaindropsInCollection(-1, (n) => onProgress?.(byId.size + n));
  for (const item of unsorted) byId.set(item._id, item);

  return [...byId.values()];
}

/** Raindrop built-in suggest (may require Pro on some accounts). */
export async function fetchRaindropSuggest(
  itemId: number
): Promise<{ collectionId: number | null; tags: string[] }> {
  const res = await apiFetch(`/raindrop/${itemId}/suggest`);
  if (!res.ok) return { collectionId: null, tags: [] };
  const json = await res.json();
  const col =
    json?.item?.collection?.$id ??
    json?.collection?.$id ??
    json?.result?.collection?.$id ??
    null;
  const collectionId =
    typeof col === "number" && col > 0 ? col : null;
  const tags = Array.isArray(json?.tags)
    ? json.tags.map((t: unknown) => String(t))
    : Array.isArray(json?.item?.tags)
      ? json.item.tags.map((t: unknown) => String(t))
      : [];
  return { collectionId, tags };
}

export async function updateRaindropTags(id: number, tags: string[]): Promise<void> {
  const res = await apiFetch(`/raindrop/${id}`, {
    method: "PUT",
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not update tags (${res.status}): ${text.slice(0, 120)}`);
  }
}

export async function moveRaindrop(id: number, collectionId: number): Promise<void> {
  const res = await apiFetch(`/raindrop/${id}`, {
    method: "PUT",
    body: JSON.stringify({ collection: { $id: collectionId } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not move bookmark (${res.status}): ${text.slice(0, 120)}`);
  }
}

export async function deleteRaindrop(id: number): Promise<void> {
  const res = await apiFetch(`/raindrop/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not delete bookmark (${res.status})`);
}

/** https://developer.raindrop.io/v1/collections/methods — merge into `to`, sources in `ids`. */
export async function mergeRaindropCollections(toId: number, fromId: number): Promise<void> {
  if (toId === fromId) return;
  const res = await apiFetch("/collections/merge", {
    method: "PUT",
    body: JSON.stringify({
      to: toId,
      ids: [fromId],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Collection merge failed (${res.status}): ${text.slice(0, 120)}`);
  }
}

export async function deleteRaindropCollection(id: number): Promise<void> {
  const res = await apiFetch(`/collection/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not delete collection (${res.status})`);
}

export async function countRaindropsInCollection(collectionId: number): Promise<number> {
  const res = await apiFetch(`/raindrops/${collectionId}?perpage=1`);
  if (!res.ok) return -1;
  const json = await res.json();
  return Number(json.count) || 0;
}
