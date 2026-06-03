export interface RaindropOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  obtainedAt: number;
}

export interface RaindropAppCredentials {
  clientId: string;
  clientSecret: string;
}

export interface RaindropCollection {
  _id: number;
  title: string;
  parent?: { $id: number } | null;
  count?: number;
}

export interface RaindropItem {
  _id: number;
  title: string;
  link: string;
  created: string;
  collection?: { $id: number };
  tags?: string[];
}

export interface RaindropLoadResult {
  bookmarks: import("../../lib/bookmarks/types").BookmarkRecord[];
  pathToCollectionId: Record<string, number>;
}
