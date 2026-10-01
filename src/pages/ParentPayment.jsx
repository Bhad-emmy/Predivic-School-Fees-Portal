import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import LegalFooter from "../components/LegalFooter";

const formatNaira = (value) =>
  "₦" + Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

export default function ParentPayment() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const reference = params.get("reference") || "";

  const [details, setDetails] = useState(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!token) {
        if (mounted) {
          setError("This payment link is missing its secure token.");
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("paystack-payment-link", {
          body: { token },
        });

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);
        if (!mounted) return;

        setDetails(data);
        setAmount(String(Math.min(Number(data.balance || 0), Number(data.balance || 0))));
      } catch (err) {
        if (mounted) setError(err.message || "Unable to load payment details.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
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
          const { data: refreshed, error: refreshError } = await supabase.functions.invoke("paystack-payment-link", {
            body: { token },
          });

          if (refreshError) throw refreshError;
          if (refreshed?.error) throw new Error(refreshed.error);

          if (!mounted) return;
          setDetails(refreshed);
          setAmount(String(refreshed.balance || 0));
          setMessage("Payment confirmed. Your fee balance has been updated.");
        } else {
          if (mounted) setMessage("Payment is still being confirmed. Please refresh in a moment.");
        }
      } catch (err) {
        if (mounted) setError(err.message || "Unable to confirm the payment.");
      }
    };

    confirmPayment();
    return () => {
      mounted = false;
    };
  }, [reference, token]);

  const handlePay = async (event) => {
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

  if (loading) {
    return <main style={styles.shell}>
      <a className="skip-link" href="#payment-form">Skip to payment form</a><section style={styles.card}><p>Loading secure payment link...</p></section></main>;
  }

  if (error && !details) {
    return <main style={styles.shell}><section style={styles.card}><h1>MEKA School</h1><p style={styles.error}>{error}</p></section></main>;
  }

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

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}

        <form id="payment-form" onSubmit={handlePay}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="parent@example.com"
              required
              style={styles.input}
              disabled={paying}
            />
          </label>

          <label style={styles.label}>
            Amount to pay
            <input
              type="number"
              min="50"
              step="0.01"
              max={details?.balance}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              style={styles.input}
              disabled={paying}
            />
          </label>

          <button type="submit" disabled={paying} style={styles.button}>
            {paying ? "Opening Paystack..." : "Pay with Paystack"}
          </button>
        </form>

        <p style={styles.footer}>
          Your payment is verified by MEKA School before the fee balance is updated.
        </p>
        <LegalFooter />
      </section>
    </main>
  );
}

const styles = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "#f8fafc",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "28px",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  brand: { fontWeight: 800, color: "#2563eb", letterSpacing: "0.02em" },
  title: { margin: "8px 0 4px", color: "#0f172a" },
  muted: { color: "#64748b", marginTop: 0 },
  studentBox: {
    display: "grid",
    gap: "6px",
    padding: "16px",
    margin: "20px 0",
    borderRadius: "12px",
    background: "#f1f5f9",
    color: "#334155",
  },
  label: { display: "grid", gap: "7px", marginBottom: "16px", fontWeight: 600, color: "#334155" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "16px",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: "10px",
    padding: "13px 16px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  success: { color: "#166534", background: "#dcfce7", padding: "10px", borderRadius: "8px" },
  error: { color: "#b91c1c", background: "#fee2e2", padding: "10px", borderRadius: "8px" },
  footer: { color: "#64748b", fontSize: "13px", marginTop: "18px" },
};
