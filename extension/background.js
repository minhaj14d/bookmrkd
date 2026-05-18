/** MV3 service worker — install + download bridge. */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.info("[bookmrkd] installed — open popup and run analysis");
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "download") return false;
  chrome.downloads.download(
    { url: msg.url, filename: msg.filename, saveAs: Boolean(msg.saveAs) },
    () => {
      const err = chrome.runtime.lastError;
      sendResponse(err ? { ok: false, error: err.message } : { ok: true });
    }
  );
  return true;
});
