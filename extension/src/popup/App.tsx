import { useCallback, useEffect, useState } from "react";
import { getActiveTab } from "../lib/capture";
import { saveBookmark } from "../storage/idb";
import { suggestTags } from "../lib/tag-suggest";
import { listBookmarks } from "../storage/idb";
import type { BookmarkEntry } from "../lib/types/bookmark";
import { normalizeTags } from "../lib/url";

export default function App() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [recents, setRecents] = useState<BookmarkEntry[]>([]);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listBookmarks();
    setRecents(all.slice(0, 8));
  }, []);

  useEffect(() => {
    (async () => {
      const tab = await getActiveTab();
      if (tab?.url) {
        setUrl(tab.url);
        setTitle(tab.title || tab.url);
        setTags(suggestTags(tab.url, tab.title || ""));
      }
      await refresh();
    })().catch(console.error);
  }, [refresh]);

  const addTag = () => {
    const next = normalizeTags([...tags, ...tagInput.split(/[,\s]+/)]);
    setTags(next);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const show = (msg: string, kind: "info" | "success" | "error" = "info") => {
    setStatus(msg);
    setStatusKind(kind);
  };

  const onSave = async () => {
    setBusy(true);
    try {
      const merged = normalizeTags([...tags, ...tagInput.split(/[,\s]+/)]);
      const tab = await getActiveTab();
      if (!tab?.url) throw new Error("No active tab with a URL to save.");
      const entry = await saveBookmark({
        url: tab.url,
        title: title.trim() || tab.title || tab.url,
        tags: merged,
        faviconUrl: tab.favIconUrl,
        source: "tab",
      });
      setTags(entry.tags);
      setTagInput("");
      show("Saved to library", "success");
      await refresh();
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const version = chrome.runtime.getManifest().version;

  return (
    <div className="popup-shell">
      <header className="header">
        <div className="brand">
          <img className="logo" src="/icons/conversion.png" width={32} height={32} alt="" />
          <div>
            <h1>bookmrkd</h1>
            <span className="mode-badge offline">Library</span>
          </div>
        </div>
        <button
          type="button"
          className="btn-icon"
          title="Settings"
          aria-label="Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <img src="/icons/cogwheel.png" width={18} height={18} alt="" />
        </button>
      </header>

      <main className="main">
        <p className="hint">Save the current tab to your local library. Tags stay on this device.</p>

        <label className="label" htmlFor="title-edit">
          Title
        </label>
        <input
          id="title-edit"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title && url) setTags((t) => (t.length ? t : suggestTags(url, title)));
          }}
        />

        <label className="label" htmlFor="tag-input">
          Tags
        </label>
        <div className="tag-row">
          <input
            id="tag-input"
            className="input"
            placeholder="react, research…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="btn standard" onClick={addTag}>
            Add
          </button>
        </div>
        <div className="chip-list">
          {tags.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => removeTag(t)}>
              {t} ×
            </button>
          ))}
        </div>

        {status ? (
          <div className={`status ${statusKind}`} role="status">
            {status}
          </div>
        ) : null}

        <section className="recents">
          <h2 className="section-title">Recent</h2>
          {recents.length === 0 ? (
            <p className="help">Nothing saved yet — save this page to start.</p>
          ) : (
            <ul className="recent-list">
              {recents.map((b) => (
                <li key={b.id}>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">
                    <strong>{b.title}</strong>
                    <span className="recent-meta">
                      {b.domain}
                      {b.tags.length ? ` · ${b.tags.slice(0, 3).join(", ")}` : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="footer">
        <button type="button" className="btn analyze" disabled={busy} onClick={onSave}>
          Save this page
        </button>
        <span className="version">v{version}</span>
      </footer>

      <p className="footer-link">
        <button type="button" className="link-btn" onClick={() => chrome.runtime.openOptionsPage()}>
          Open full library &amp; search →
        </button>
      </p>
    </div>
  );
}
