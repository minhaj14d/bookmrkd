import { useState } from "react";
import LibraryTab from "./LibraryTab";
import AdvancedTab from "./AdvancedTab";
import SuggestionsTab from "./SuggestionsTab";

type Tab = "library" | "suggestions" | "advanced" | "about";

export default function App() {
  const [tab, setTab] = useState<Tab>("library");
  const version = chrome.runtime.getManifest().version;
  const privacyUrl = chrome.runtime.getURL("src/privacy/privacy.html");

  return (
    <div className="options-shell">
      <header className="top">
        <img src="/icons/conversion.png" width={40} height={40} alt="" className="logo" />
        <div>
          <h1>bookmrkd</h1>
          <p className="sub">Bookmark library &amp; maintenance</p>
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
          className={tab === "suggestions" ? "active" : ""}
          onClick={() => setTab("suggestions")}
        >
          AI Suggestions
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
        {tab === "suggestions" ? <SuggestionsTab /> : null}
        {tab === "advanced" ? <AdvancedTab /> : null}
        {tab === "about" ? (
          <section className="block about-tab">
            <p className="about-version">bookmrkd v{version}</p>
            <p className="help">
              Save, tag, and search bookmarks locally. AI suggestions help tidy folders — you approve every
              change.
            </p>

            <div className="about-credits">
              <p className="about-name">Minhajul Abedin</p>
              <p className="help">Copyright © 2026 Minhajul Abedin</p>
              <p className="help">
                Licensed under{" "}
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GNU General Public License v3.0
                </a>
              </p>
              <p className="help">
                <a
                  href="https://github.com/minhaj14d/bookmrkd"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/minhaj14d/bookmrkd
                </a>
              </p>
            </div>

            <ul className="about-links">
              <li>
                <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
                  Privacy policy
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/minhaj14d/bookmrkd/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report an issue
                </a>
              </li>
            </ul>

            <p className="help about-meta">No analytics · No telemetry · Data stays on your device by default</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
