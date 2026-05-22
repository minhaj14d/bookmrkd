import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookmarkEntry } from "../lib/types/bookmark";
import { normalizeTags } from "../lib/url";
import {
  deleteBookmark,
  exportLibraryJson,
  getAllTags,
  importLibraryJson,
  listBookmarks,
  putBookmark,
  searchBookmarks,
} from "../storage/idb";

export default function LibraryTab() {
  const [all, setAll] = useState<BookmarkEntry[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [domainFilter, setDomainFilter] = useState("");
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    const bookmarks = await listBookmarks();
    setAll(bookmarks);
    setVocabulary(await getAllTags());
    if (selectedId && !bookmarks.find((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const domains = useMemo(() => {
    const s = new Set<string>();
    for (const b of all) if (b.domain) s.add(b.domain);
    return [...s].sort();
  }, [all]);

  const filtered = useMemo(
    () => searchBookmarks(all, query, tagFilter, domainFilter),
    [all, query, tagFilter, domainFilter]
  );

  const selected = filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected) setEditTags(selected.tags.join(", "));
  }, [selected?.id, selected?.tags.join(",")]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const onSaveTags = async () => {
    if (!selected) return;
    const tags = normalizeTags(editTags.split(/[,\s]+/));
    await putBookmark({ ...selected, tags, updatedAt: Date.now() });
    showToast("Tags updated");
    await refresh();
  };

  const onDelete = async () => {
    if (!selected || !confirm(`Delete "${selected.title}"?`)) return;
    await deleteBookmark(selected.id);
    setSelectedId(null);
    showToast("Deleted");
    await refresh();
  };

  const onExport = async () => {
    const json = await exportLibraryJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    chrome.downloads.download(
      { url, filename: `bookmrkd-library-${stamp}.json`, saveAs: true },
      () => URL.revokeObjectURL(url)
    );
    showToast("Export started");
  };

  const onImport = async (file: File, mode: "merge" | "replace") => {
    const text = await file.text();
    const n = await importLibraryJson(text, mode);
    showToast(`Imported ${n} bookmarks (${mode})`);
    await refresh();
  };

  return (
    <div className="library-tab">
      <div className="library-toolbar">
        <input
          className="input search-input"
          placeholder="Search title, URL, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="select"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button type="button" className="btn standard" onClick={onExport}>
          Export JSON
        </button>
        <label className="btn standard file-btn">
          Import merge
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f, "merge");
              e.target.value = "";
            }}
          />
        </label>
        <label className="btn standard file-btn">
          Import replace
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && confirm("Replace entire library with this file?")) onImport(f, "replace");
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {vocabulary.length > 0 ? (
        <div className="tag-filters">
          {vocabulary.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${tagFilter.includes(t) ? "active" : ""}`}
              onClick={() => toggleTagFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <p className="help">
        {filtered.length} of {all.length} bookmarks · local IndexedDB · no cloud sync in v1.1
      </p>

      <div className="library-split">
        <ul className="library-list">
          {filtered.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={`library-item ${selected?.id === b.id ? "active" : ""}`}
                onClick={() => setSelectedId(b.id)}
              >
                <strong>{b.title}</strong>
                <span>
                  {b.domain} · {b.tags.slice(0, 4).join(", ") || "no tags"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <aside className="library-detail">
            <h3>{selected.title}</h3>
            <a href={selected.url} target="_blank" rel="noopener noreferrer">
              {selected.url}
            </a>
            <label className="label">Tags (comma-separated)</label>
            <input
              className="input"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
            />
            <div className="actions">
              <button type="button" className="btn primary" onClick={onSaveTags}>
                Save tags
              </button>
              <button type="button" className="btn standard" onClick={onDelete}>
                Delete
              </button>
            </div>
          </aside>
        ) : (
          <aside className="library-detail empty-detail">
            <p>Select a bookmark or save from the popup.</p>
          </aside>
        )}
      </div>

      {toast ? <div className="toast-bar">{toast}</div> : null}
    </div>
  );
}
