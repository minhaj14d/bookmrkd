export type BookmarkSource = "manual" | "tab" | "import";

export interface BookmarkEntry {
  id: string;
  url: string;
  title: string;
  tags: string[];
  faviconUrl?: string;
  createdAt: number;
  updatedAt: number;
  source: BookmarkSource;
  domain?: string;
}

export interface LibraryExport {
  version: 1;
  exportedAt: number;
  bookmarks: BookmarkEntry[];
}
