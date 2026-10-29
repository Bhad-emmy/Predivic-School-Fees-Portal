import { useState } from "react";
import "../styles/ModuleWorkspace.css";

export default function ModuleWorkspace({ eyebrow, title, subtitle, tabs, status = "Setup in progress" }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id || "");
  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];

  return (
    <div className="meka-module">
      <header className="meka-module-header">
        <div>
          <p className="meka-module-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="meka-module-subtitle">{subtitle}</p>
        </div>
        <span className="meka-module-status"><span aria-hidden="true">●</span> {status}</span>
      </header>

      <div className="meka-module-notice" role="status">
        <strong>Foundation only:</strong> This module is now available in the admin navigation. Student access,
        question or score storage, publishing, and live workflows are not enabled yet. Existing school records
        have not been changed.
      </div>

      <nav className="meka-module-tabs" aria-label={title + " sections"}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={"meka-module-tab" + (activeTab?.id === tab.id ? " is-active" : "")}
            aria-current={activeTab?.id === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab && (
        <section className="meka-module-panel" aria-labelledby="meka-module-section-heading">
          <div className="meka-module-panel-heading">
            <div>
              <h2 id="meka-module-section-heading">{activeTab.title}</h2>
              <p>{activeTab.description}</p>
            </div>
            <span className="meka-module-pending">Not yet enabled</span>
          </div>
          <div className="meka-module-grid">
            {activeTab.items.map((item) => (
              <article className="meka-module-feature" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
          {activeTab.note && <p className="meka-module-note">{activeTab.note}</p>}
        </section>
      )}
    </div>
  );
}
