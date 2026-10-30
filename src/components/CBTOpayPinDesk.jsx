import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const fieldStyle = { display: "grid", gap: 7, fontWeight: 700, fontSize: 13 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 9 };

export default function CBTOpayPinDesk() {
  const [allowed, setAllowed] = useState(false);
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [reference, setReference] = useState("");
  const [verified, setVerified] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: authError } = await supabase.rpc("is_cbt_platform_operator");
      if (!active) return;
      if (authError || !data) {
        setChecking(false);
        return;
      }
      setAllowed(true);
      const { data: enabled, error: salesError } = await supabase.rpc("cbt_opay_sales_enabled");
      if (!active) return;
      if (!salesError) setSalesEnabled(Boolean(enabled));
      setChecking(false);
    })();
    return () => { active = false; };
  }, []);

  const generatePin = async (event) => {
    event.preventDefault();
    if (!allowed || !salesEnabled || !verified || !reference.trim()) return;
    setIssuing(true);
    setError("");
    setPin("");
    try {
      const { data, error: createError } = await supabase.rpc("issue_verified_opay_cbt_pin", {
        p_transaction_reference: reference.trim(),
      });
      if (createError) throw createError;
      if (typeof data !== "string" || !data.startsWith("MEKA-")) {
        throw new Error("The PIN was not returned. Check the issuance audit before trying again.");
      }
      setPin(data);
      setReference("");
      setVerified(false);
    } catch (createError) {
      setError(createError.message || "Unable to issue a PIN.");
    } finally {
      setIssuing(false);
    }
  };

  // This widget is only shown to explicitly allowlisted platform operators.
  // School administrator role alone is insufficient to generate paid PINs.
  if (checking || !allowed) return null;

  return (
    <section style={{ background: "var(--card-background,#fff)", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, display: "grid", gap: 14 }}>
      <div>
        <p style={{ margin: "0 0 6px", color: "#2563eb", fontWeight: 800, letterSpacing: ".08em", fontSize: 12, textTransform: "uppercase" }}>MEKA CBT operators only</p>
        <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Manual OPay PIN issuance</h2>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#64748b" }}>
          After independently verifying an incoming ₦1,500 transfer inside your OPay transaction history,
          generate one 30-day PIN and privately send it to the learner on WhatsApp.
        </p>
      </div>
      {!salesEnabled && (
        <p role="status" style={{ margin: 0, padding: 12, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", borderRadius: 9 }}>
          PIN sales are disabled until the receiving OPay details, operator account, security tests and launch requirements are verified.
        </p>
      )}
      <form onSubmit={generatePin} style={{ display: "grid", gap: 14 }}>
        <label style={fieldStyle}>OPay transaction reference (as shown in your received transaction)
          <input type="text" maxLength={120} minLength={6} required disabled={!salesEnabled || issuing}
            value={reference} onChange={(event) => { setReference(event.target.value); setPin(""); }}
            style={inputStyle} placeholder="Enter the independently verified transaction reference" />
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.6, fontSize: 13 }}>
          <input type="checkbox" disabled={!salesEnabled || issuing} checked={verified}
            onChange={(event) => setVerified(event.target.checked)} style={{ marginTop: 4 }} />
          <span>I checked the received transaction directly in OPay and independently confirmed ₦1,500 was received for this reference. I understand screenshots are not payment confirmation.</span>
        </label>
        <button type="submit" disabled={!salesEnabled || issuing || !verified || reference.trim().length < 6}
          style={{ justifySelf: "start", border: 0, color: "#fff", background: "#0f2a43", borderRadius: 9, padding: "12px 16px", cursor: "pointer", fontWeight: 700 }}>
          {issuing ? "Generating..." : "Confirm received payment and generate PIN"}
        </button>
      </form>
      {error && <p role="alert" style={{ color: "#991b1b", background: "#fef2f2", margin: 0, padding: 12, borderRadius: 9 }}>{error}</p>}
      {pin && (
        <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, background: "#f0fdf4", padding: 16 }}>
          <strong>Single-use activation PIN (displayed once)</strong>
          <p style={{ overflowWrap: "anywhere", fontFamily: "monospace", fontWeight: 700 }}>{pin}</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(pin)}
            style={{ border: "1px solid #86efac", borderRadius: 8, background: "#fff", padding: "9px 12px", cursor: "pointer" }}>
            Copy PIN to send privately on WhatsApp
          </button>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#166534" }}>
            Give this PIN to the learner only after verifying their payment. The PIN cannot be retrieved again.
            Duplicate OPay transaction references cannot generate another PIN.
          </p>
        </div>
      )}
    </section>
  );
}
