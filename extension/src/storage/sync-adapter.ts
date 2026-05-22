import type { BookmarkEntry } from "../lib/types/bookmark";

export interface SyncAdapter {
  pull(): Promise<BookmarkEntry[]>;
  push(entries: BookmarkEntry[]): Promise<void>;
}

export class SyncNotImplemented implements SyncAdapter {
  async pull(): Promise<BookmarkEntry[]> {
    throw new Error("Cloud sync is planned for v1.2 (Supabase).");
  }

  async push(_entries: BookmarkEntry[]): Promise<void> {
    throw new Error("Cloud sync is planned for v1.2 (Supabase).");
  }
}
