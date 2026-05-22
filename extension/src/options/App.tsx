import { useState } from "react";
import LibraryTab from "./LibraryTab";
import AdvancedTab from "./AdvancedTab";

type Tab = "library" | "advanced" | "about";

export default function App() {
  const [tab, setTab] = useState<Tab>("library");
  const version = chrome.runtime.getManifest().version;

  return (
    <div className="shell">
      <header className="top">
        <img src="/icons/conversion.png" width={40} height={40} alt="" className="logo" />
        <div>
          <h1>bookmrkd</h1>
          <p className="sub">Privacy-first bookmark library</p>
        </div>
      </header>

      <nav className="options-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === "library" ? "active" : ""}
          onClick={() => setTab("library")}
        >
          Library
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "advanced" ? "active" : ""}
          onClick={() => setTab("advanced")}
        >
          Advanced
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "about" ? "active" : ""}
          onClick={() => setTab("about")}
        >
          About
        </button>
      </nav>

      <main className="options-main">
        {tab === "library" ? <LibraryTab /> : null}
        {tab === "advanced" ? <AdvancedTab /> : null}
        {tab === "about" ? (
          <section className="block about-tab">
            <p className="help">
              bookmrkd v{version} — local IndexedDB library with tagging and search. No analytics, no
              telemetry, no data selling.
            </p>
            <div className="sync-placeholder">
              <strong>Cloud sync</strong>
              <p>Coming in v1.2 (Supabase auth + Postgres). Your library stays on-device until you opt in.</p>
            </div>
            <p>
              <a
                href={chrome.runtime.getURL("src/privacy/privacy.html")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy policy
              </a>
            </p>
            <p className="help">GPL-3.0 · Minhajul Abedin · github.com/minhaj14d/bookmrkd</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
