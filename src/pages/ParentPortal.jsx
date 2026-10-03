import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const money = (value) =>
  "₦" + Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  });

export default function ParentPortal() {
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState("children");

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadParentData = async () => {
    setDataLoading(true);
    setError("");

    try {
      const [{ data: studentRows, error: studentsError }, { data: accountRows, error: accountsError }, { data: paymentRows, error: paymentsError }, { data: receiptRows, error: receiptsError }] =
        await Promise.all([
          supabase
            .from("students")
            .select("id, admission_no, first_name, middle_name, last_name, parent_name, parent_email")
            .order("first_name"),
          supabase
            .from("student_fee_accounts")
            .select("id, student_id, total_amount, status, updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("payments")
            .select("id, student_id, student_fee_account_id, amount, payment_date, method, reference, status")
            .order("payment_date", { ascending: false }),
          supabase
            .from("receipts")
            .select("id, payment_id, receipt_number, issued_at")
            .order("issued_at", { ascending: false }),
        ]);

      if (studentsError) throw studentsError;
      if (accountsError) throw accountsError;
      if (paymentsError) throw paymentsError;
      if (receiptsError) throw receiptsError;

      setStudents(studentRows || []);
      setAccounts(accountRows || []);
      setPayments(paymentRows || []);
      setReceipts(receiptRows || []);

      if (!studentRows?.length) {
        setMessage(
          "Your account is signed in, but no student is currently linked to this parent email. Contact the school office."
        );
      }
    } catch (err) {
      console.error("PARENT PORTAL LOAD ERROR:", err);
      setError(err.message || "Unable to load your school account.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) loadParentData();
    else {
      setStudents([]);
      setAccounts([]);
      setPayments([]);
      setReceipts([]);
    }
  }, [session?.user?.id]);

  const accountByStudent = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      if (!map.has(account.student_id)) map.set(account.student_id, []);
      map.get(account.student_id).push(account);
    });
    return map;
  }, [accounts]);

  const paidByAccount = useMemo(() => {
    const map = new Map();
    payments.forEach((payment) => {
      const status = String(payment.status || "").toLowerCase();
      if (!["paid", "successful", "completed"].includes(status)) return;
      const key = payment.student_fee_account_id || payment.fee_account_id;
      if (!key) return;
      map.set(key, (map.get(key) || 0) + Number(payment.amount || 0));
    });
    return map;
  }, [payments]);

  const outstandingByStudent = (studentId) =>
    (accountByStudent.get(studentId) || []).reduce((sum, account) => {
      const paid = paidByAccount.get(account.id) || 0;
      return sum + Math.max(Number(account.total_amount || 0) - paid, 0);
    }, 0);

  const totalOutstanding = students.reduce(
    (sum, student) => sum + outstandingByStudent(student.id),
    0
  );

  const totalPaid = payments
    .filter((payment) =>
      ["paid", "successful", "completed"].includes(
        String(payment.status || "").toLowerCase()
      )
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        setSession(data.session);
      } else {
        if (!fullName.trim()) throw new Error("Enter your full name.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          setSession(data.session);
          setMessage("Parent account created successfully.");
        } else {
          setMessage(
            "Account created. Check your email to confirm the account, then return here to sign in."
          );
          setMode("login");
        }
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const openPayment = async (student) => {
    const candidate = (accountByStudent.get(student.id) || []).find((account) => {
      const paid = paidByAccount.get(account.id) || 0;
      return Math.max(Number(account.total_amount || 0) - paid, 0) > 0;
    });

    if (!candidate) {
      setError("This student has no outstanding fee balance.");
      return;
    }

    try {
      setPaymentLoading(true);
      setError("");
      const { data, error: invokeError } = await supabase.functions.invoke("paystack-links", {
        body: {
          studentId: student.id,
          studentFeeAccountId: candidate.id,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Unable to create the secure payment page.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || "Unable to open the payment page.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setActiveView("children");
  };

  if (loading) {
    return <main style={styles.shell}><section style={styles.card}><p>Loading MEKA School...</p></section></main>;
  }

  if (!session?.user) {
    return (
      <main style={styles.shell}>
        <section style={styles.authCard}>
          <div style={styles.brand}>MEKA School</div>
          <h1 style={styles.title}>Parent Portal</h1>
          <p style={styles.muted}>
            Access your child&apos;s school information, fees and payment history.
          </p>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <div style={styles.tabs}>
            <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={mode === "login" ? styles.tabActive : styles.tab}>Sign in</button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={mode === "signup" ? styles.tabActive : styles.tab}>Create account</button>
          </div>

          <form onSubmit={handleAuth}>
            {mode === "signup" && (
              <label style={styles.label}>
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={styles.input} required disabled={authBusy} />
              </label>
            )}

            <label style={styles.label}>
              Email address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required disabled={authBusy} />
            </label>

            <label style={styles.label}>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required minLength={6} disabled={authBusy} />
            </label>

            <button type="submit" disabled={authBusy} style={styles.primaryButton}>
              {authBusy ? "Please wait..." : mode === "login" ? "Sign in to Parent Portal" : "Create Parent Account"}
            </button>
          </form>

          <p style={styles.note}>
            Use the email address registered with the school for your child.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.portalShell}>
      <style>{`@media (max-width: 760px) { .meka-parent-body { grid-template-columns: 1fr !important; } .meka-parent-nav { display: flex !important; width: 100%; box-sizing: border-box; overflow-x: auto; overflow-y: hidden; gap: 6px; scrollbar-width: none; -webkit-overflow-scrolling: touch; } .meka-parent-nav::-webkit-scrollbar { display: none; } .meka-parent-nav button { flex: 0 0 auto; white-space: nowrap; padding: 11px 14px !important; } .meka-parent-stats { grid-template-columns: 1fr !important; } .meka-parent-row { flex-direction: column !important; align-items: flex-start !important; } .meka-parent-row > div:last-child { text-align: left !important; } }`}</style>
      <header style={styles.topbar}>
        <div>
          <div style={styles.brand}>MEKA School</div>
          <strong style={{ fontSize: 18 }}>Parent Portal</strong>
        </div>
        <button type="button" onClick={signOut} style={styles.signOut}>Sign out</button>
      </header>

      <div className="meka-parent-body" style={styles.portalBody}>
        <aside className="meka-parent-nav" style={styles.nav}>
          <button onClick={() => setActiveView("children")} style={activeView === "children" ? styles.navActive : styles.navButton}>My Children</button>
          <button onClick={() => setActiveView("fees")} style={activeView === "fees" ? styles.navActive : styles.navButton}>Fees</button>
          <button onClick={() => setActiveView("payments")} style={activeView === "payments" ? styles.navActive : styles.navButton}>Payment History</button>
          <button onClick={() => setActiveView("receipts")} style={activeView === "receipts" ? styles.navActive : styles.navButton}>Receipts</button>
        </aside>

        <section style={styles.main}>
          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          {dataLoading ? (
            <div style={styles.card}><p>Loading your school records...</p></div>
          ) : activeView === "children" ? (
            <div style={styles.section}>
              <h1 style={styles.pageTitle}>My Children</h1>
              <p style={styles.muted}>View your children, outstanding fees, and pay school fees securely.</p>
              <div style={styles.grid}>
                {students.map((student) => (
                  <StudentCard key={student.id} student={student} balance={outstandingByStudent(student.id)} />
                ))}
              </div>
            </div>
          ) : activeView === "fees" ? (
            <div style={styles.section}>
              <h1 style={styles.pageTitle}>Fees</h1>
              {students.map((student) => (
                <div key={student.id} className="meka-parent-row" style={styles.rowCard}>
                  <div>
                    <strong>{student.first_name} {student.last_name}</strong>
                    <div style={styles.muted}>Admission No: {student.admission_no || "Not assigned"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={styles.muted}>Outstanding</span>
                    <strong style={{ display: "block", fontSize: 20 }}>{money(outstandingByStudent(student.id))}</strong>
                    {outstandingByStudent(student.id) > 0 && (
                      <button type="button" onClick={() => openPayment(student)} disabled={paymentLoading} style={styles.smallButton}>Pay fees</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : activeView === "payments" ? (
            <div style={styles.section}>
              <h1 style={styles.pageTitle}>Payment History</h1>
              {payments.length === 0 ? <p style={styles.muted}>No payments recorded.</p> : payments.map((payment) => {
                const student = students.find((item) => item.id === payment.student_id);
                return (
                  <div key={payment.id} className="meka-parent-row" style={styles.rowCard}>
                    <div>
                      <strong>{student ? `${student.first_name} ${student.last_name}` : "Student"}</strong>
                      <div style={styles.muted}>{payment.method || "Payment"} · {payment.reference || "No reference"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{money(payment.amount)}</strong>
                      <div style={styles.muted}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-NG") : ""}</div>
                      <span style={styles.status}>{payment.status || "Pending"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.section}>
              <h1 style={styles.pageTitle}>Receipts</h1>
              {receipts.length === 0 ? <p style={styles.muted}>No receipts available.</p> : receipts.map((receipt) => (
                <div key={receipt.id} className="meka-parent-row" style={styles.rowCard}>
                  <div>
                    <strong>{receipt.receipt_number || "Receipt"}</strong>
                    <div style={styles.muted}>{receipt.issued_at ? new Date(receipt.issued_at).toLocaleDateString("en-NG") : ""}</div>
                  </div>
                  <div style={styles.muted}>Receipt file available through the school.</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StudentCard({ student, balance, onPay }) {
  return (
    <article style={styles.studentCard}>
      <div style={styles.avatar}>{(student.first_name || "S").charAt(0).toUpperCase()}</div>
      <h3>{student.first_name} {student.middle_name ? student.middle_name + " " : ""}{student.last_name}</h3>
      <p style={styles.muted}>Admission No: {student.admission_no || "Not assigned"}</p>
      <div style={styles.balance}>{money(balance)}</div>
      <span style={styles.muted}>Outstanding fees</span>
      {balance > 0 && (
        <button type="button" onClick={onPay} style={styles.smallButton}>Pay fees</button>
      )}
    </article>
  );
}

const styles = {
  shell: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" },
  authCard: { width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 30, boxShadow: "0 18px 50px rgba(15,23,42,.08)" },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 },
  brand: { color: "#2563eb", fontWeight: 800, letterSpacing: ".02em" },
  title: { margin: "8px 0 8px", color: "#0f172a", fontSize: 30 },
  pageTitle: { margin: "0 0 4px", color: "#0f172a", fontSize: 28 },
  muted: { color: "#64748b" },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "22px 0" },
  tab: { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 9, padding: 11, fontWeight: 700 },
  tabActive: { border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", borderRadius: 9, padding: 11, fontWeight: 700 },
  label: { display: "grid", gap: 7, marginBottom: 16, fontWeight: 650, color: "#334155" },
  input: { width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 16 },
  primaryButton: { width: "100%", border: 0, borderRadius: 10, padding: 13, background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" },
  note: { fontSize: 13, color: "#64748b", marginTop: 18, lineHeight: 1.5 },
  error: { padding: 12, borderRadius: 10, background: "#fef2f2", color: "#b91c1c", marginBottom: 16 },
  success: { padding: 12, borderRadius: 10, background: "#f0fdf4", color: "#166534", marginBottom: 16 },
  portalShell: { minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" },
  topbar: { minHeight: 70, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #e2e8f0" },
  signOut: { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 9, padding: "9px 13px", fontWeight: 700 },
  portalBody: { maxWidth: 1180, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "210px minmax(0,1fr)", gap: 24 },
  nav: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 10, alignSelf: "start", display: "grid", gap: 5 },
  navButton: { border: 0, background: "transparent", textAlign: "left", padding: "11px 12px", borderRadius: 9, fontWeight: 650, color: "#475569" },
  navActive: { border: 0, background: "#eff6ff", color: "#1d4ed8", textAlign: "left", padding: "11px 12px", borderRadius: 9, fontWeight: 800 },
  main: { minWidth: 0 },
  stats: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, margin: "22px 0" },
  stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, display: "grid", gap: 8 },
  section: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 22, marginTop: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginTop: 16 },
  studentCard: { border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 },
  avatar: { width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: "50%", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800 },
  balance: { fontSize: 22, fontWeight: 850, marginTop: 14, color: "#0f172a" },
  smallButton: { marginTop: 12, border: 0, borderRadius: 9, padding: "10px 13px", background: "#2563eb", color: "#fff", fontWeight: 750 },
  rowCard: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0" },
  status: { display: "inline-block", marginTop: 5, fontSize: 12, fontWeight: 700, color: "#475569" },
};

