import { saveBookmark } from "../storage/idb";
import type { BookmarkEntry } from "./types/bookmark";

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export async function saveCurrentTab(tags: string[] = []): Promise<BookmarkEntry> {
  const tab = await getActiveTab();
  if (!tab?.url) throw new Error("No active tab with a URL to save.");
  const url = tab.url;
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    throw new Error("Cannot save internal browser pages.");
  }
  return saveBookmark({
    url,
    title: tab.title || url,
    tags,
    faviconUrl: tab.favIconUrl,
    source: "tab",
  });
}

export async function saveTabById(
  tabId: number,
  tags: string[] = []
): Promise<BookmarkEntry> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) throw new Error("Tab has no URL.");
  return saveBookmark({
    url: tab.url,
    title: tab.title || tab.url,
    tags,
    faviconUrl: tab.favIconUrl,
    source: "tab",
  });
}
