import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const tabs = ["Overview", "Student Wallets", "Top-ups", "Canteen Debit", "Transactions"];
const money = (kobo = 0) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100);
const styles = {
  page: { display: "grid", gap: 20, color: "var(--text-primary, #172033)" },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  eyebrow: { margin: "0 0 6px", color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800 },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary, #64748b)", lineHeight: 1.6, maxWidth: 680 },
  banner: { border: "1px solid #f5d38b", background: "#fff8e7", borderRadius: 12, padding: 14, color: "#855b08", lineHeight: 1.5 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: 12 },
  tab: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", color: "var(--text-primary, #172033)", borderRadius: 10, padding: "10px 13px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  activeTab: { border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 },
  card: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", borderRadius: 14, padding: 16 },
  label: { display: "block", color: "var(--text-secondary, #64748b)", fontSize: 13, marginBottom: 7 },
  value: { fontSize: 23, fontWeight: 800, margin: "8px 0 3px" },
  panel: { border: "1px solid var(--border-color, #e2e8f0)", background: "var(--card-background, #fff)", borderRadius: 14, padding: 18, display: "grid", gap: 14 },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9, fontSize: 16, background: "var(--card-background, #fff)", color: "var(--text-primary, #172033)" },
  button: { padding: "12px 16px", border: 0, borderRadius: 9, background: "#102b42", color: "#fff", fontWeight: 750, fontSize: 15, cursor: "pointer" },
  secondary: { padding: "10px 13px", border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", color: "#172033", fontWeight: 700, cursor: "pointer" },
  muted: { color: "var(--text-secondary, #64748b)", lineHeight: 1.55, margin: 0, fontSize: 13 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 8px", borderBottom: "1px solid #e2e8f0", color: "#64748b", whiteSpace: "nowrap" },
  td: { padding: "12px 8px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top" },
};
const errorText = (error) => {
  const message = error?.message || "Something went wrong.";
  if (/cashless_(create_wallet|resolve_qr|top_up|debit|set_wallet_status)|function .* does not exist|schema cache/i.test(message)) {
    return "Cashless wallet operations are not deployed yet. No transaction was made.";
  }
  return message;
};
const newKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cashless-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function Field({ label, children }) {
  return <label style={{ display: "grid", gap: 7 }}><span style={styles.label}>{label}</span>{children}</label>;
}

export default function Cashless() {
  const { staff, user, isAdmin } = useAuth();
  const role = String(staff?.role || "").toLowerCase();
  const isSchoolManager = isAdmin || role === "secretary";
  const [tab, setTab] = useState("Overview");
  const [students, setStudents] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [createdToken, setCreatedToken] = useState("");
  const [createdWalletStudent, setCreatedWalletStudent] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupReference, setTopupReference] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [studentResult, walletResult, txResult] = await Promise.all([
        supabase.from("students").select("id, school_id, admission_no, first_name, middle_name, last_name, status").order("first_name").limit(1000),
        supabase.from("cashless_wallets").select("id, school_id, student_id, balance_kobo, status, created_at").order("created_at", { ascending: false }),
        supabase.from("cashless_transactions").select("id, wallet_id, type, amount_kobo, balance_after_kobo, reference, note, actor_user_id, created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (studentResult.error) throw studentResult.error;
      if (walletResult.error) throw walletResult.error;
      if (txResult.error) throw txResult.error;
      setStudents(studentResult.data || []);
      setWallets(walletResult.data || []);
      setTransactions(txResult.data || []);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const name = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
      return (!term || name.toLowerCase().includes(term) || String(s.admission_no || "").toLowerCase().includes(term))
        && !wallets.some((w) => w.student_id === s.id);
    }).slice(0, 80);
  }, [students, wallets, search]);
  const totalBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance_kobo || 0), 0);
  const today = new Date().toDateString();
  const todaysSales = transactions.filter((tx) => tx.type === "purchase" && new Date(tx.created_at).toDateString() === today).reduce((sum, tx) => sum + Number(tx.amount_kobo || 0), 0);
  const todayTopups = transactions.filter((tx) => tx.type === "top_up" && new Date(tx.created_at).toDateString() === today).reduce((sum, tx) => sum + Number(tx.amount_kobo || 0), 0);

  const runAction = async (action) => {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); await loadData(); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };

  const createWallet = () => runAction(async () => {
    if (!selectedStudent) throw new Error("Select a student first.");
    const { data, error: rpcError } = await supabase.rpc("cashless_create_wallet", { p_student_id: selectedStudent });
    if (rpcError) throw rpcError;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.qr_token) throw new Error("Wallet was created but no QR token was returned. Contact the administrator before retrying.");
    const student = studentMap.get(selectedStudent);
    setCreatedToken(result.qr_token);
    setCreatedWalletStudent(student ? [student.first_name, student.last_name].filter(Boolean).join(" ") : "Student");
    setSelectedStudent("");
    setSuccess("Wallet created. Copy or securely save the QR token now; it will not be shown again.");
  });

  const topUp = () => runAction(async () => {
    if (!selectedWallet) throw new Error("Select a wallet.");
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) <= 0) throw new Error("Enter a valid top-up amount in naira.");
    const { error: rpcError } = await supabase.rpc("cashless_top_up", {
      p_wallet_id: selectedWallet,
      p_amount_kobo: Math.round(amount * 100),
      p_idempotency_key: newKey(),
      p_reference: topupReference.trim() || null,
      p_note: "Authorized school staff top-up",
    });
    if (rpcError) throw rpcError;
    setTopupAmount(""); setTopupReference("");
    setSuccess("Wallet topped up successfully.");
  });

  const resolveQr = () => runAction(async () => {
    const token = qrToken.trim();
    if (!token) throw new Error("Scan or enter the student's QR token.");
    const { data, error: rpcError } = await supabase.rpc("cashless_resolve_qr", { p_qr_token: token });
    if (rpcError) throw rpcError;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error("No wallet found for this QR token.");
    setResolvedWallet(result); setLastReceipt(null);
  });

  const debit = () => runAction(async () => {
    if (!resolvedWallet || !qrToken.trim()) throw new Error("Resolve the student's QR token first.");
    const amount = Number(purchaseAmount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) <= 0) throw new Error("Enter a valid purchase amount in naira.");
    if (resolvedWallet.wallet_status !== "active") throw new Error("This wallet is suspended.");
    const { data, error: rpcError } = await supabase.rpc("cashless_debit", {
      p_qr_token: qrToken.trim(),
      p_amount_kobo: Math.round(amount * 100),
      p_idempotency_key: newKey(),
      p_note: "Canteen purchase",
    });
    if (rpcError) throw rpcError;
    const result = Array.isArray(data) ? data[0] : data;
    setLastReceipt(result || null);
    setPurchaseAmount("");
    setSuccess(result?.was_duplicate ? "This transaction was already recorded; no second debit was made." : "Payment approved.");
    const { data: refreshed, error: refreshError } = await supabase.rpc("cashless_resolve_qr", { p_qr_token: qrToken.trim() });
    if (refreshError) throw refreshError;
    setResolvedWallet(Array.isArray(refreshed) ? refreshed[0] : refreshed);
  });

  const suspendWallet = (wallet, status) => runAction(async () => {
    const { error: rpcError } = await supabase.rpc("cashless_set_wallet_status", { p_wallet_id: wallet.id, p_status: status });
    if (rpcError) throw rpcError;
    setSuccess(status === "suspended" ? "Wallet suspended." : "Wallet reactivated.");
  });

  const renderTransactions = (rows) => rows.length ? (
    <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Time</th><th style={styles.th}>Student</th><th style={styles.th}>Type</th><th style={styles.th}>Amount</th><th style={styles.th}>Balance after</th></tr></thead><tbody>
      {rows.map((tx) => { const wallet = walletMap.get(tx.wallet_id); const student = wallet ? studentMap.get(wallet.student_id) : null; return <tr key={tx.id}><td style={styles.td}>{new Date(tx.created_at).toLocaleString("en-NG")}</td><td style={styles.td}>{student ? [student.first_name, student.last_name].filter(Boolean).join(" ") : "Student wallet"}</td><td style={styles.td}>{tx.type.replace("_", " ")}</td><td style={styles.td}>{money(tx.amount_kobo)}</td><td style={styles.td}>{money(tx.balance_after_kobo)}</td></tr>; })}
    </tbody></table></div>
  ) : <p style={styles.muted}>No Cashless transactions have been recorded yet.</p>;

  return <div style={styles.page}>
    <header style={styles.heading}><div><p style={styles.eyebrow}>MEKA School • Predivic pilot</p><h1 style={styles.title}>School Cashless</h1><p style={styles.subtitle}>Student wallets and QR-based payments for the physical school canteen. School fees remain separate.</p></div><button type="button" style={styles.secondary} onClick={loadData} disabled={loading || busy}>Refresh</button></header>
    <div style={styles.banner}><strong>Safe rollout:</strong> wallet operations require the secure database functions to be deployed. Do not use real student funds until end-to-end tests pass.</div>
    {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 13, borderRadius: 10 }}>{error}</div>}
    {success && <div role="status" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: 13, borderRadius: 10 }}>{success}</div>}
    <nav style={styles.tabs} aria-label="Cashless sections">{tabs.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setError(""); setSuccess(""); }} aria-current={tab === item ? "page" : undefined} style={{ ...styles.tab, ...(tab === item ? styles.activeTab : {}) }}>{item}</button>)}</nav>
    {loading ? <section style={styles.panel}>Loading Cashless data…</section> : <>
      {tab === "Overview" && <>
        <div style={styles.cards}><section style={styles.card}><span style={styles.label}>Student wallets</span><div style={styles.value}>{wallets.length}</div></section><section style={styles.card}><span style={styles.label}>Total wallet balance</span><div style={styles.value}>{money(totalBalance)}</div></section><section style={styles.card}><span style={styles.label}>Today's sales</span><div style={styles.value}>{money(todaysSales)}</div></section><section style={styles.card}><span style={styles.label}>Today's top-ups</span><div style={styles.value}>{money(todayTopups)}</div></section></div>
        <section style={styles.panel}><h2 style={{ margin: 0 }}>Recent transactions</h2>{renderTransactions(transactions.slice(0, 8))}</section>
      </>}
      {tab === "Student Wallets" && <section style={styles.panel}><h2 style={{ margin: 0 }}>Create a student wallet</h2><p style={styles.muted}>Choose an existing student. A secure QR token is generated once; keep it private and use it to print the student's QR card.</p>
        {isSchoolManager ? <><Field label="Search student"><input style={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or admission number" /></Field><Field label="Student without a wallet"><select style={styles.input} value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}><option value="">Select student</option>{filteredStudents.map((s) => <option key={s.id} value={s.id}>{[s.first_name, s.last_name].filter(Boolean).join(" ")}{s.admission_no ? ` — ${s.admission_no}` : ""}</option>)}</select></Field><button style={styles.button} disabled={busy || !selectedStudent} onClick={createWallet}>{busy ? "Working…" : "Create wallet"}</button></> : <p style={styles.muted}>Only an admin or secretary can create wallets.</p>}
        {createdToken && <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, display: "grid", gap: 10 }}><strong>Wallet created for {createdWalletStudent}</strong><p style={styles.muted}>Save this token securely now. This preview displays the token as text; QR image/card printing will be added after the secure flow is verified.</p><code style={{ overflowWrap: "anywhere", padding: 10, background: "#f8fafc", borderRadius: 8 }}>{createdToken}</code><button type="button" style={styles.secondary} onClick={() => navigator.clipboard?.writeText(createdToken)}>Copy token</button></div>}
        <h3 style={{ marginBottom: 0 }}>Existing wallets ({wallets.length})</h3>{wallets.length ? <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Admission No.</th><th style={styles.th}>Balance</th><th style={styles.th}>Status</th>{isSchoolManager && <th style={styles.th}>Action</th>}</tr></thead><tbody>{wallets.map((w) => { const s = studentMap.get(w.student_id); return <tr key={w.id}><td style={styles.td}>{s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "Student"}</td><td style={styles.td}>{s?.admission_no || "—"}</td><td style={styles.td}>{money(w.balance_kobo)}</td><td style={styles.td}>{w.status}</td>{isSchoolManager && <td style={styles.td}><button style={styles.secondary} disabled={busy} onClick={() => suspendWallet(w, w.status === "active" ? "suspended" : "active")}>{w.status === "active" ? "Suspend" : "Reactivate"}</button></td>}</tr>; })}</tbody></table></div> : <p style={styles.muted}>No wallets created yet.</p>}
      </section>}
      {tab === "Top-ups" && <section style={styles.panel}><h2 style={{ margin: 0 }}>Add money to a wallet</h2><p style={styles.muted}>For verified cash or transfer top-ups only. Confirm receipt of the money before crediting the wallet.</p>{isSchoolManager ? <><Field label="Student wallet"><select style={styles.input} value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)}><option value="">Select student wallet</option>{wallets.map((w) => { const s = studentMap.get(w.student_id); return <option key={w.id} value={w.id}>{s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "Student"} — balance {money(w.balance_kobo)}</option>; })}</select></Field><Field label="Amount (₦)"><input style={styles.input} inputMode="decimal" type="number" min="1" step="0.01" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="e.g. 2000" /></Field><Field label="Payment reference (optional)"><input style={styles.input} value={topupReference} onChange={(e) => setTopupReference(e.target.value)} placeholder="Cash receipt or transfer reference" /></Field><button style={styles.button} disabled={busy || !selectedWallet || !topupAmount} onClick={topUp}>{busy ? "Processing…" : "Confirm top-up"}</button></> : <p style={styles.muted}>Only an admin or secretary can top up wallets.</p>}</section>}
      {tab === "Canteen Debit" && <section style={styles.panel}><h2 style={{ margin: 0 }}>Canteen purchase</h2><p style={styles.muted}>Scan the student's QR using a scanner that types the token into this field, or enter the token manually. Camera scanning will be added separately.</p><Field label="QR token"><input style={styles.input} autoComplete="off" value={qrToken} onChange={(e) => { setQrToken(e.target.value); setResolvedWallet(null); setLastReceipt(null); }} placeholder="Scan or enter QR token" /></Field><button style={styles.secondary} disabled={busy || !qrToken.trim()} onClick={resolveQr}>Find wallet</button>{resolvedWallet && <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, display: "grid", gap: 7 }}><strong>{resolvedWallet.student_name}</strong><span>Admission No.: {resolvedWallet.admission_no || "—"}</span><span>Balance: <strong>{money(resolvedWallet.balance_kobo)}</strong></span><span>Wallet status: {resolvedWallet.wallet_status}</span></div>}{resolvedWallet && <><Field label="Purchase amount (₦)"><input style={styles.input} type="number" inputMode="decimal" min="0.01" step="0.01" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} placeholder="e.g. 100" /></Field><button style={styles.button} disabled={busy || !purchaseAmount || resolvedWallet.wallet_status !== "active"} onClick={debit}>{busy ? "Processing…" : `Debit ${purchaseAmount ? money(Math.round(Number(purchaseAmount) * 100)) : ""}`}</button></>}{lastReceipt && <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 14 }}><strong>Payment approved</strong><p>Student: {lastReceipt.student_name}</p><p>New balance: {money(lastReceipt.balance_after_kobo)}</p></div>}</section>}
      {tab === "Transactions" && <section style={styles.panel}><h2 style={{ margin: 0 }}>Transaction history</h2><p style={styles.muted}>Showing the latest 100 transactions available to your account.</p>{renderTransactions(transactions)}</section>}
    </>}
    <p style={styles.muted}>Signed in as {user?.email || "authorized staff"} · {staff?.role || "staff"} · Physical canteen only. No product catalogue or inventory tracking.</p>
  </div>;
}
