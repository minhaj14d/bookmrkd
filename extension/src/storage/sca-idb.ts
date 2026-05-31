import type { AnalysisJob, Suggestion } from "../features/smart-collection/types";

const DB_NAME = "bookmrkd_v2";
const DB_VERSION = 1;

const STORES = {
  suggestions: "sca_suggestions",
  embeddings: "sca_embeddings",
  feedback: "sca_feedback",
  jobs: "sca_jobs",
} as const;

export interface ScaFeedbackEntry {
  patternKey: string;
  action: "accept" | "reject" | "ignore";
  count: number;
  lastAt: number;
}

export interface ScaEmbeddingRow {
  entityKey: string;
  modelId: string;
  vector: number[];
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.suggestions)) {
          const s = db.createObjectStore(STORES.suggestions, { keyPath: "id" });
          s.createIndex("jobId", "jobId", { unique: false });
          s.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.embeddings)) {
          db.createObjectStore(STORES.embeddings, { keyPath: "entityKey" });
        }
        if (!db.objectStoreNames.contains(STORES.feedback)) {
          db.createObjectStore(STORES.feedback, { keyPath: "patternKey" });
        }
        if (!db.objectStoreNames.contains(STORES.jobs)) {
          db.createObjectStore(STORES.jobs, { keyPath: "id" });
        }
      };
    });
  }
  return dbPromise;
}

export async function saveJob(job: AnalysisJob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.jobs, "readwrite");
    tx.objectStore(STORES.jobs).put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getJob(id: string): Promise<AnalysisJob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.jobs, "readonly").objectStore(STORES.jobs).get(id);
    req.onsuccess = () => resolve((req.result as AnalysisJob) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestJob(): Promise<AnalysisJob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.jobs, "readonly").objectStore(STORES.jobs).getAll();
    req.onsuccess = () => {
      const jobs = (req.result as AnalysisJob[]) || [];
      jobs.sort((a, b) => b.startedAt - a.startedAt);
      resolve(jobs[0] || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSuggestions(suggestions: Suggestion[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.suggestions, "readwrite");
    const store = tx.objectStore(STORES.suggestions);
    for (const s of suggestions) store.put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateSuggestion(suggestion: Suggestion): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.suggestions, "readwrite");
    tx.objectStore(STORES.suggestions).put(suggestion);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSuggestionsByJob(jobId: string): Promise<Suggestion[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const idx = db.transaction(STORES.suggestions, "readonly").objectStore(STORES.suggestions).index("jobId");
    const req = idx.getAll(jobId);
    req.onsuccess = () => resolve((req.result as Suggestion[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getFeedbackMap(): Promise<Map<string, ScaFeedbackEntry>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.feedback, "readonly").objectStore(STORES.feedback).getAll();
    req.onsuccess = () => {
      const map = new Map<string, ScaFeedbackEntry>();
      for (const row of (req.result as ScaFeedbackEntry[]) || []) {
        map.set(row.patternKey, row);
      }
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function upsertFeedback(entry: ScaFeedbackEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.feedback, "readwrite");
    tx.objectStore(STORES.feedback).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEmbedding(entityKey: string): Promise<ScaEmbeddingRow | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.embeddings, "readonly").objectStore(STORES.embeddings).get(entityKey);
    req.onsuccess = () => resolve((req.result as ScaEmbeddingRow) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putEmbedding(row: ScaEmbeddingRow): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.embeddings, "readwrite");
    tx.objectStore(STORES.embeddings).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
