import type { BookmarkEntry, LibraryExport } from "../lib/types/bookmark";
import { domainFromUrl, normalizeTags, normalizeUrl } from "../lib/url";

const DB_NAME = "bookmrkd_v1";
const DB_VERSION = 1;
const STORE = "bookmarks";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("domain", "domain", { unique: false });
          store.createIndex("urlNorm", "urlNorm", { unique: true });
        }
      };
    });
  }
  return dbPromise;
}

type StoredBookmark = BookmarkEntry & { urlNorm: string };

function toStored(entry: BookmarkEntry): StoredBookmark {
  return {
    ...entry,
    tags: normalizeTags(entry.tags),
    domain: entry.domain || domainFromUrl(entry.url),
    urlNorm: normalizeUrl(entry.url),
  };
}

function fromStored(row: StoredBookmark): BookmarkEntry {
  const { urlNorm: _u, ...rest } = row;
  return rest;
}

export async function ensureSchemaVersion(): Promise<void> {
  const { bookmrkd_schemaVersion } = await chrome.storage.local.get([
    "bookmrkd_schemaVersion",
  ]);
  if (bookmrkd_schemaVersion !== 1) {
    await chrome.storage.local.set({ bookmrkd_schemaVersion: 1 });
  }
}

export async function listBookmarks(): Promise<BookmarkEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as StoredBookmark[]).map(fromStored);
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getBookmarkById(id: string): Promise<BookmarkEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () =>
      resolve(req.result ? fromStored(req.result as StoredBookmark) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function findByNormalizedUrl(url: string): Promise<BookmarkEntry | null> {
  const norm = normalizeUrl(url);
  if (!norm) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .index("urlNorm")
      .get(norm);
    req.onsuccess = () =>
      resolve(req.result ? fromStored(req.result as StoredBookmark) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function putBookmark(entry: BookmarkEntry): Promise<BookmarkEntry> {
  const db = await openDb();
  const stored = toStored(entry);
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(stored);
    req.onsuccess = () => resolve(fromStored(stored));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllTags(): Promise<string[]> {
  const all = await listBookmarks();
  const set = new Set<string>();
  for (const b of all) for (const t of b.tags) set.add(t);
  return [...set].sort();
}

export function searchBookmarks(
  bookmarks: BookmarkEntry[],
  query: string,
  tagFilter: string[],
  domainFilter: string
): BookmarkEntry[] {
  const q = query.trim().toLowerCase();
  return bookmarks.filter((b) => {
    if (domainFilter && b.domain !== domainFilter) return false;
    if (tagFilter.length && !tagFilter.every((t) => b.tags.includes(t))) return false;
    if (!q) return true;
    const hay = `${b.title} ${b.url} ${b.tags.join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}

export async function exportLibraryJson(): Promise<string> {
  const bookmarks = await listBookmarks();
  const payload: LibraryExport = {
    version: 1,
    exportedAt: Date.now(),
    bookmarks,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importLibraryJson(
  json: string,
  mode: "merge" | "replace"
): Promise<number> {
  const parsed = JSON.parse(json) as LibraryExport;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.bookmarks)) {
    throw new Error("Invalid library export (expected version 1).");
  }
  if (mode === "replace") {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const clear = store.clear();
      clear.onsuccess = () => resolve();
      clear.onerror = () => reject(clear.error);
    });
  }
  let count = 0;
  for (const raw of parsed.bookmarks) {
    if (!raw.url || !raw.title) continue;
    await saveBookmark({
      url: raw.url,
      title: raw.title,
      tags: raw.tags || [],
      faviconUrl: raw.faviconUrl,
      source: raw.source || "import",
    });
    count++;
  }
  return count;
}

export interface SaveBookmarkInput {
  url: string;
  title: string;
  tags?: string[];
  faviconUrl?: string;
  source?: BookmarkEntry["source"];
}

export async function saveBookmark(input: SaveBookmarkInput): Promise<BookmarkEntry> {
  await ensureSchemaVersion();
  const existing = await findByNormalizedUrl(input.url);
  const now = Date.now();
  const mergedTags = normalizeTags([
    ...(existing?.tags || []),
    ...(input.tags || []),
  ]);

  if (existing) {
    const updated: BookmarkEntry = {
      ...existing,
      title: input.title.trim() || existing.title,
      tags: mergedTags,
      faviconUrl: input.faviconUrl || existing.faviconUrl,
      updatedAt: now,
      source: input.source || existing.source,
      domain: domainFromUrl(input.url),
    };
    return putBookmark(updated);
  }

  const entry: BookmarkEntry = {
    id: crypto.randomUUID(),
    url: input.url.trim(),
    title: input.title.trim() || input.url,
    tags: mergedTags,
    faviconUrl: input.faviconUrl,
    createdAt: now,
    updatedAt: now,
    source: input.source || "tab",
    domain: domainFromUrl(input.url),
  };
  return putBookmark(entry);
}
