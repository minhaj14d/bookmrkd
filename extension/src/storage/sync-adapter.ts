import type { BookmarkEntry } from "../lib/types/bookmark";

export interface SyncAdapter {
  pull(): Promise<BookmarkEntry[]>;
  push(entries: BookmarkEntry[]): Promise<void>;
}

export class SyncNotImplemented implements SyncAdapter {
  async pull(): Promise<BookmarkEntry[]> {
    throw new Error("Cloud sync is not available.");
  }

  async push(_entries: BookmarkEntry[]): Promise<void> {
    throw new Error("Cloud sync is not available.");
  }
}
