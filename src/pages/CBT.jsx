import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import CBTStudentInvites from "../components/CBTStudentInvites";
import CBTOpayPinDesk from "../components/CBTOpayPinDesk";
import CBTQuestionBankAdmin from "../components/CBTQuestionBankAdmin";
import CBTBatchImport from "../components/CBTBatchImport";
import CBTReviewQueue from "../components/CBTReviewQueue";

const headerStyle = {
  display: "grid", gap: 14, padding: "clamp(20px, 5vw, 32px)",
  borderRadius: 16, border: "1px solid #bed5eb",
  background: "linear-gradient(125deg, #eaf4ff, #f8fbff)",
};
const actionStyle = {
  border: "1px solid #b5c7d9", background: "#fff", color: "#143c5b",
  borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 14,
  cursor: "pointer", textDecoration: "none", display: "inline-flex",
  alignItems: "center", justifyContent: "center", minHeight: 44,
};
const infoStyle = {
  border: "1px solid #dae4ef", background: "#fff", borderRadius: 12,
  padding: "14px 17px", lineHeight: 1.6, color: "#334155",
};
const subsectionStyle = { display: "grid", gap: 15, scrollMarginTop: 16 };

export default function CBT() {
  const [coverage, setCoverage] = useState(null);
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: operator, error: operatorError } = await supabase.rpc("is_cbt_platform_operator");
      if (!active || operatorError || !operator) return;
      setIsOperator(true);
      const { data, error } = await supabase.rpc("cbt_question_bank_coverage");
      if (active && !error && Array.isArray(data)) setCoverage(data);
    })();
    return () => { active = false; };
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const freeQuestions = coverage?.reduce((sum, item) => sum + Number(item.published_free || 0), 0);
  const premiumQuestions = coverage?.reduce((sum, item) => sum + Number(item.published_premium || 0), 0);
  const draftQuestions = coverage?.reduce((sum, item) => sum + Number(item.drafts || 0), 0);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header style={headerStyle}>
        <p style={{ margin: 0, color: "#2362a6", textTransform: "uppercase", fontSize: 12, letterSpacing: "0.08em", fontWeight: 800 }}>
          MEKA School · CBT administration
        </p>
        <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 37px)", color: "#162840", lineHeight: 1.22 }}>
          WAEC & JAMB Mock Centre
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, maxWidth: 780 }}>
          The CBT beta is installed. Manage original exam-style practice questions, school-student invitations,
          and the learner experience below. Learners use the separate public CBT portal.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ borderRadius: 24, padding: "9px 13px", background: "#e0f2e9", color: "#17603c", fontWeight: 700, fontSize: 13 }}>
            ● CBT beta available
          </span>
          <span style={{ borderRadius: 24, padding: "9px 13px", background: "#fff5dd", color: "#795414", fontWeight: 700, fontSize: 13 }}>
            OPay PIN sales closed
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/learn" target="_blank" rel="noopener noreferrer"
            style={{ ...actionStyle, background: "#0d3552", color: "#fff", borderColor: "#0d3552" }}>
            Open public CBT learner portal
          </a>
          <button type="button" style={actionStyle} onClick={() => scrollToSection("cbt-question-bank")}>
            Manage question bank
          </button>
          <button type="button" style={actionStyle} onClick={() => scrollToSection("cbt-student-invites")}>
            Link school students
          </button>
        </div>
      </header>

      <section style={infoStyle} aria-label="CBT beta features">
        <strong style={{ color: "#143c5b" }}>Available now:</strong> learner profiles, free topic practice, premium
        questions with PIN-controlled access, 10-question timed mini-mocks, scoring, question rotation,
        content import and editorial review.
        <p style={{ margin: "8px 0 0" }}>
          <strong>Not released yet:</strong> full-length WAEC/JAMB simulations, study-material library, and OPay PIN sales.
          Practice scores are separate from school term results.
        </p>
      </section>

      {isOperator && (
        <section style={{ display: "flex", gap: 10, flexWrap: "wrap" }} aria-label="Question bank totals">
          {coverage ? (
            <>
              <div style={infoStyle}><strong>{freeQuestions}</strong> published free questions</div>
              <div style={infoStyle}><strong>{premiumQuestions}</strong> published premium questions</div>
              <div style={infoStyle}><strong>{draftQuestions}</strong> awaiting publication</div>
            </>
          ) : <p style={{ margin: 0, color: "#64748b" }}>Loading question-bank totals…</p>}
        </section>
      )}

      <section id="cbt-question-bank" style={subsectionStyle}>
        <div>
          <h2 style={{ margin: "0 0 5px", color: "#172f4a" }}>Question bank and publishing</h2>
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Approved CBT operators can create questions, import batches, review private answer keys and publish approved content.
            Other school administrators cannot publish platform-wide questions.
          </p>
        </div>
        <CBTQuestionBankAdmin />
        <CBTBatchImport />
        <CBTReviewQueue />
      </section>

      <section id="cbt-student-invites" style={subsectionStyle}>
        <h2 style={{ margin: "0 0 5px", color: "#172f4a" }}>School student invitations</h2>
        <CBTStudentInvites />
      </section>

      <section id="cbt-activation" style={subsectionStyle}>
        <h2 style={{ margin: "0 0 5px", color: "#172f4a" }}>OPay activation management</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          Activation is restricted to approved CBT operators. No payments should be requested or PINs issued
          until sales are enabled after the remaining launch checks.
        </p>
        <CBTOpayPinDesk />
      </section>
    </div>
  );
}
