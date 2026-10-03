import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const formatNaira = (value) =>
  "₦" + Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

export default function ParentPayment() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const reference = params.get("reference") || "";

  const [details, setDetails] = useState(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paystack");
  const [senderName, setSenderName] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDetails = async () => {
    if (!token) {
      setError("This payment link is missing its secure token.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("paystack-payment-link", {
        body: { token },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setDetails(data);
      setAmount(String(data.balance || 0));
    } catch (err) {
      setError(err.message || "Unable to load payment details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadDetails().then(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    if (!reference || !token) return;
    let mounted = true;

    const confirmPayment = async () => {
      try {
        setMessage("Confirming your payment...");
        const { data, error: invokeError } = await supabase.functions.invoke("paystack-payment-status", {
          body: { reference },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);

        if (data?.status === "paid") {
          await loadDetails();
          if (mounted) setMessage("Payment confirmed. Your fee balance has been updated.");
        } else if (mounted) {
          setMessage("Payment is still being confirmed. Please refresh in a moment.");
        }
      } catch (err) {
        if (mounted) setError(err.message || "Unable to confirm the payment.");
      }
    };

    confirmPayment();
    return () => { mounted = false; };
  }, [reference, token]);

  const handlePaystack = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const numericAmount = Number(amount);
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (numericAmount > Number(details.balance)) {
      setError("Amount cannot exceed the outstanding balance.");
      return;
    }

    try {
      setPaying(true);
      const { data, error: invokeError } = await supabase.functions.invoke("paystack-initialize", {
        body: { token, email, amount: numericAmount },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.authorizationUrl) throw new Error("Paystack did not return a checkout URL.");
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError(err.message || "Unable to start Paystack checkout.");
      setPaying(false);
    }
  };

  const handleBankTransfer = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (numericAmount > Number(details.balance)) {
      setError("Amount cannot exceed the outstanding balance.");
      return;
    }
    if (!transferReference.trim()) {
      setError("Enter the bank transfer reference.");
      return;
    }
    if (!proofFile) {
      setError("Upload your transfer receipt or proof.");
      return;
    }

    try {
      setSubmittingTransfer(true);
      const form = new FormData();
      form.append("token", token);
      form.append("amount", String(numericAmount));
      form.append("senderName", senderName.trim());
      form.append("transferReference", transferReference.trim());
      form.append("proof", proofFile);
      const { data, error: invokeError } = await supabase.functions.invoke("bank-transfer-submit", { body: form });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setMessage("Bank transfer submitted. The school will verify the transfer before the fee balance is updated.");
      setTransferReference("");
      setSenderName("");
      setProofFile(null);
    } catch (err) {
      setError(err.message || "Unable to submit the bank transfer.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  if (loading) {
    return <main style={styles.shell}><section style={styles.card}><p>Loading secure payment link...</p></section></main>;
  }

  if (error && !details) {
    return <main style={styles.shell}><section style={styles.card}><h1>MEKA School</h1><p style={styles.error}>{error}</p></section></main>;
  }

  const bankConfigured = Boolean(
    details?.bankTransfer?.bankName &&
    details?.bankTransfer?.accountName &&
    details?.bankTransfer?.accountNumber
  );

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <div style={styles.brand}>MEKA School</div>
        <h1 style={styles.title}>School Fee Payment</h1>
        <p style={styles.muted}>{details?.school}</p>

        <div style={styles.studentBox}>
          <strong>{details?.student?.name}</strong>
          {details?.student?.admissionNo && <span>Admission No: {details.student.admissionNo}</span>}
          <span>Outstanding: <strong>{formatNaira(details?.balance)}</strong></span>
        </div>

        <div style={styles.methodRow}>
          <button type="button" onClick={() => { setMethod("paystack"); setError(""); setMessage(""); }} style={method === "paystack" ? styles.methodActive : styles.method}>
            Pay Online
          </button>
          <button type="button" onClick={() => { setMethod("bank"); setError(""); setMessage(""); }} style={method === "bank" ? styles.methodActive : styles.method}>
            Bank Transfer
          </button>
          <button type="button" onClick={() => { setMethod("pos"); setError(""); setMessage(""); }} style={method === "pos" ? styles.methodActive : styles.method}>
            Pay at School
          </button>
        </div>

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}

        {method === "paystack" && (
          <form onSubmit={handlePaystack}>
            <label style={styles.label}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" required style={styles.input} disabled={paying} />
            </label>
            <label style={styles.label}>
              Amount to pay
              <input type="number" min="50" step="0.01" max={details?.balance} value={amount} onChange={(e) => setAmount(e.target.value)} required style={styles.input} disabled={paying} />
            </label>
            <button type="submit" disabled={paying} style={styles.button}>{paying ? "Opening Paystack..." : "Pay with Paystack"}</button>
          </form>
        )}

        {method === "bank" && (
          <form onSubmit={handleBankTransfer}>
            {bankConfigured ? (
              <div style={styles.bankBox}>
                <strong>Transfer to the school account</strong>
                <span>Bank: {details.bankTransfer.bankName}</span>
                <span>Account name: {details.bankTransfer.accountName}</span>
                <span>Account number: {details.bankTransfer.accountNumber}</span>
              </div>
            ) : (
              <div style={styles.warning}>The school has not configured its bank transfer details yet.</div>
            )}
            <label style={styles.label}>
              Amount transferred
              <input type="number" min="0.01" step="0.01" max={details?.balance} value={amount} onChange={(e) => setAmount(e.target.value)} required style={styles.input} disabled={submittingTransfer || !bankConfigured} />
            </label>
            <label style={styles.label}>
              Sender name
              <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Name on the bank transfer" style={styles.input} disabled={submittingTransfer || !bankConfigured} />
            </label>
            <label style={styles.label}>
              Transfer reference
              <input type="text" value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="Bank transaction/reference number" required style={styles.input} disabled={submittingTransfer || !bankConfigured} />
            </label>
            <label style={styles.label}>
              Transfer proof
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} required style={styles.input} disabled={submittingTransfer || !bankConfigured} />
              <small style={{color:"#64748b",fontWeight:400}}>JPG, PNG, WEBP or PDF. Maximum 10MB.</small>
            </label>
            <button type="submit" disabled={submittingTransfer || !bankConfigured} style={styles.button}>
              {submittingTransfer ? "Submitting..." : "Submit Transfer for Verification"}
            </button>
          </form>
        )}

        {method === "pos" && (
          <div style={styles.bankBox}>
            <strong>Pay at the school with POS</strong>
            <span>Visit the school office and make the payment through the school POS terminal.</span>
            <span>Keep the POS transaction/reference number. School staff will record and issue your receipt.</span>
          </div>
        )}

        <p style={styles.footer}>Online payments are verified by MEKA School before the fee balance is updated. Bank transfers remain pending until school staff verify them.</p>
      </section>
    </main>
  );
}

const styles = {
  shell:{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#f8fafc",fontFamily:"Inter,system-ui,sans-serif"},
  card:{width:"100%",maxWidth:"480px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:"18px",padding:"28px",boxShadow:"0 18px 50px rgba(15,23,42,.08)"},
  brand:{fontWeight:800,color:"#2563eb",letterSpacing:".02em"},
  title:{margin:"8px 0 4px",color:"#0f172a"},
  muted:{color:"#64748b",marginTop:0},
  studentBox:{display:"grid",gap:"6px",padding:"16px",margin:"20px 0",borderRadius:"12px",background:"#f1f5f9",color:"#334155"},
  methodRow:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"18px"},
  method:{border:"1px solid #cbd5e1",background:"#fff",borderRadius:"9px",padding:"10px 8px",fontWeight:700,color:"#334155"},
  methodActive:{border:"1px solid #2563eb",background:"#eff6ff",borderRadius:"9px",padding:"10px 8px",fontWeight:700,color:"#1d4ed8"},
  label:{display:"grid",gap:"7px",marginBottom:"16px",fontWeight:600,color:"#334155"},
  input:{width:"100%",boxSizing:"border-box",padding:"12px",border:"1px solid #cbd5e1",borderRadius:"10px",fontSize:"16px"},
  button:{width:"100%",border:0,borderRadius:"10px",padding:"13px 16px",background:"#2563eb",color:"#fff",fontWeight:700,cursor:"pointer"},
  bankBox:{display:"grid",gap:"7px",padding:"15px",marginBottom:"18px",borderRadius:"12px",background:"#eff6ff",color:"#1e3a8a"},
  warning:{padding:"12px",marginBottom:"18px",borderRadius:"10px",background:"#fff7ed",color:"#9a3412"},
  success:{color:"#166534",background:"#dcfce7",padding:"10px",borderRadius:"8px"},
  error:{color:"#b91c1c",background:"#fee2e2",padding:"10px",borderRadius:"8px"},
  footer:{color:"#64748b",fontSize:"13px",marginTop:"18px"},
};
