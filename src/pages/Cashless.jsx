import { useState } from "react";

const tabs = ["Overview", "Student Wallets", "Top-ups", "Products", "Sales"];

const styles = {
  page: { display: "grid", gap: 24, color: "var(--text-primary, #172033)" },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  eyebrow: { margin: "0 0 6px", color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800 },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary, #64748b)", lineHeight: 1.6, maxWidth: 680 },
  status: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #f5d38b", background: "#fff8e7", color: "#855b08", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700 },
  banner: { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 14, padding: 16, color: "#1e40af", lineHeight: 1.6 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: 12 },
  tab: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", color: "var(--text-primary, #172033)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  activeTab: { border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 },
  card: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", borderRadius: 14, padding: 18 },
  cardLabel: { color: "var(--text-secondary, #64748b)", fontSize: 13, margin: 0 },
  cardValue: { fontSize: 25, fontWeight: 800, margin: "10px 0 4px" },
  cardNote: { color: "var(--text-secondary, #64748b)", fontSize: 12, margin: 0, lineHeight: 1.5 },
  panel: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", borderRadius: 14, padding: 22 },
  panelTitle: { margin: "0 0 8px", fontSize: 17, fontWeight: 800 },
  panelText: { margin: 0, color: "var(--text-secondary, #64748b)", lineHeight: 1.65 },
  checklist: { display: "grid", gap: 12, marginTop: 18 },
  item: { display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.5, fontSize: 14 },
  dot: { flex: "0 0 22px", height: 22, borderRadius: 7, background: "#dbeafe", color: "#1d4ed8", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 },
};

function StatCard({ label, value, note }) {
  return (
    <section style={styles.card}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
      <p style={styles.cardNote}>{note}</p>
    </section>
  );
}

export default function Cashless() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div style={styles.page}>
      <header style={styles.heading}>
        <div>
          <p style={styles.eyebrow}>MEKA School • Predivic pilot</p>
          <h1 style={styles.title}>School Cashless</h1>
          <p style={styles.subtitle}>
            Manage student wallets and canteen purchases using QR wristbands.
            School-fee payments remain separate from Cashless wallet transactions.
          </p>
        </div>
        <span style={styles.status}><span aria-hidden="true">●</span> Setup in progress</span>
      </header>

      <div style={styles.banner} role="status">
        <strong>Development mode:</strong> this screen is now part of the app's navigation, but wallet data and transactions are not connected yet. No balances can be credited or spent from this screen until the secured database functions are implemented and tested.
      </div>

      <nav style={styles.tabs} aria-label="Cashless sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab ? "page" : undefined}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div style={styles.cards}>
        <StatCard label="Student wallets" value="—" note="Available after wallet setup" />
        <StatCard label="Total wallet balance" value="₦—" note="Calculated from verified ledger entries" />
        <StatCard label="Today's sales" value="₦—" note="Recorded after checkout is enabled" />
        <StatCard label="Pending top-ups" value="—" note="Transfers awaiting staff verification" />
      </div>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>{activeTab}</h2>
        {activeTab === "Overview" ? (
          <>
            <p style={styles.panelText}>
              The Cashless workspace is in place. The next implementation step is the database migration and role-protected wallet functions. After those are tested, this overview will show live balances, funding activity, and canteen sales.
            </p>
            <div style={styles.checklist}>
              {[
                "Wallets linked to existing student records — pending database migration",
                "Manual transfer verification and cash top-ups — pending secure credit function",
                "QR wristband issue and revocation — pending token storage and validation",
                "Canteen checkout with balance and stock checks — pending atomic sale function",
              ].map((item, index) => (
                <div key={item} style={styles.item}>
                  <span style={styles.dot}>{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={styles.panelText}>
              {activeTab} will be enabled after the Cashless database and permission checks are ready. This preview intentionally does not display sample student data or allow financial changes.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
