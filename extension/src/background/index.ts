import { ensureSchemaVersion } from "../storage/idb";
import { saveTabById } from "../lib/capture";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureSchemaVersion();
  if (reason === "install") {
    console.info("[bookmrkd] installed — save pages from the popup");
  }
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "bookmrkd-save",
      title: "Save to bookmrkd",
      contexts: ["page", "link"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "bookmrkd-save" || !tab?.id) return;
  try {
    await saveTabById(tab.id);
  } catch (e) {
    console.error("[bookmrkd] context menu save failed:", e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "download") {
    chrome.downloads.download(
      { url: msg.url, filename: msg.filename, saveAs: Boolean(msg.saveAs) },
      () => {
        const err = chrome.runtime.lastError;
        sendResponse(err ? { ok: false, error: err.message } : { ok: true });
      }
    );
    return true;
  }
  if (msg?.type === "saveTab") {
    saveTabById(msg.tabId, msg.tags || [])
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        })
      );
    return true;
  }
  return false;
});
