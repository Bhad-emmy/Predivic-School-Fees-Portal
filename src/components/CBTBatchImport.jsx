import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// These are MEKA launch-readiness targets for five fresh full-length practice
// attempts per selected subject. They are NOT WAEC or JAMB official quotas.
const INITIAL_SUBJECTS = [
  ["JAMB", "Use of English", 300],
  ...["Mathematics", "Physics", "Chemistry", "Biology", "Government",
    "Economics", "Agricultural Science", "Geography", "Literature in English",
    "Christian Religious Studies", "Commerce"].map((subject) => ["JAMB", subject, 200]),
  ...["Mathematics", "English Language", "Biology", "Chemistry", "Physics",
    "Agricultural Science", "Government", "Economics", "Geography",
    "Literature in English", "Commerce", "Financial Accounting",
    "Civic Education"].map((subject) => ["WAEC", subject, 250]),
];

const sample = JSON.stringify([{
  exam_type: "WAEC",
  subject: "Mathematics",
  topic: "Ratio and Proportion",
  question_text: "If eight pens cost ₦400, what is the price of one pen?",
  option_a: "₦40",
  option_b: "₦45",
  option_c: "₦50",
  option_d: "₦55",
  correct_option: "C",
  explanation: "Unit cost = ₦400 divided by 8, which is ₦50.",
  content_origin: "original",
  is_free_preview: false,
}], null, 2);

const card = { padding: 22, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 14, display: "grid", gap: 14 };
const field = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, boxSizing: "border-box", font: "inherit" };
const columns = ["Exam", "Subject", "Premium published", "Drafts", "Launch target", "Still needed"];

function validateBatch(input) {
  const value = JSON.parse(input);
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new Error("Submit a JSON array containing between 1 and 50 question objects.");
  }
  const needed = [
    "exam_type", "subject", "topic", "question_text",
    "option_a", "option_b", "option_c", "option_d",
    "correct_option", "explanation", "content_origin",
  ];
  value.forEach((q, index) => {
    if (!q || typeof q !== "object" || Array.isArray(q)) {
      throw new Error(`Question ${index + 1} must be an object.`);
    }
    if (needed.some((key) => typeof q[key] !== "string" || !q[key].trim())) {
      throw new Error(`Question ${index + 1} is missing a required text field.`);
    }
    if (!["WAEC", "JAMB"].includes(q.exam_type) || !["A", "B", "C", "D"].includes(q.correct_option)) {
      throw new Error(`Question ${index + 1} has an invalid exam or answer option.`);
    }
    if (!["original", "licensed"].includes(q.content_origin)) {
      throw new Error(`Question ${index + 1} needs an original or licensed source label.`);
    }
    if (q.content_origin === "licensed" &&
      (typeof q.license_reference !== "string" || q.license_reference.trim().length < 8)) {
      throw new Error(`Question ${index + 1} requires evidence of redistribution rights.`);
    }
    if (q.is_published === true) {
      throw new Error(`Question ${index + 1} must be reviewed before publication.`);
    }
  });
  return value;
}

export default function CBTBatchImport() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [coverage, setCoverage] = useState([]);
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshCoverage = async () => {
    const { data, error: coverageError } = await supabase.rpc("cbt_question_bank_coverage");
    if (coverageError) throw coverageError;
    setCoverage(data || []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error: permissionError } = await supabase.rpc("is_cbt_platform_operator");
        if (permissionError || !data) return;
        if (mounted) setAllowed(true);
        const { data: coverageData, error: coverageError } = await supabase.rpc("cbt_question_bank_coverage");
        if (coverageError) throw coverageError;
        if (mounted) setCoverage(coverageData || []);
      } catch (loadFailure) {
        if (mounted) setLoadError(loadFailure.message || "Could not load question bank coverage.");
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => {
    const map = new Map(INITIAL_SUBJECTS.map(([exam, subject, target]) =>
      [`${exam}|${subject.toLowerCase()}`, { exam, subject, target, published_premium: 0, drafts: 0, published_free: 0 }]
    ));
    for (const item of coverage) {
      const key = `${item.exam_type}|${String(item.subject).toLowerCase()}`;
      const previous = map.get(key);
      map.set(key, {
        exam: item.exam_type, subject: item.subject,
        target: previous?.target || (item.exam_type === "JAMB" ? 200 : 250),
        published_premium: item.published_premium,
        published_free: item.published_free,
        drafts: item.drafts,
      });
    }
    return [...map.values()].sort((a, b) => a.exam.localeCompare(b.exam) || a.subject.localeCompare(b.subject));
  }, [coverage]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    published: t.published + r.published_premium,
    target: t.target + r.target,
    drafts: t.drafts + r.drafts,
  }), { published: 0, target: 0, drafts: 0 }), [rows]);

  const upload = async (file) => {
    setError("");
    setNotice("");
    if (!file) return;
    if (file.size > 250_000) {
      setError("This file is too large. Split it into smaller batches (50 items maximum).");
      return;
    }
    try { setRaw(await file.text()); }
    catch { setError("Unable to read the selected JSON file."); }
  };

  const importBatch = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setImporting(true);
    try {
      const parsed = validateBatch(raw);
      const { data, error: insertError } = await supabase.rpc("import_cbt_question_batch", {
        p_questions: parsed,
      });
      if (insertError) throw insertError;
      setNotice(`${data.imported_count} questions saved as drafts. Review each answer and source before publishing.`);
      setRaw("");
      await refreshCoverage();
      // Let the nearby editor refresh its draft list.
      window.dispatchEvent(new Event("cbt-bank-updated"));
    } catch (err) {
      setError(err instanceof SyntaxError
        ? "This is not valid JSON. Check commas, quotation marks and brackets."
        : (err.message || "Could not import questions."));
    } finally {
      setImporting(false);
    }
  };

  if (checking || !allowed) return null;

  return (
    <section style={card}>
      <header>
        <p style={{ margin: "0 0 6px", textTransform: "uppercase", color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>Approved MEKA CBT content operators only</p>
        <h2 style={{ margin: "0 0 7px" }}>Question-bank coverage and bulk import</h2>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#64748b" }}>
          New questions are chosen before repeated ones. To support five different full-length
          practice sittings, we need hundreds of verified, syllabus-aligned questions per subject.
          These are planning targets, not counts required by the exam boards.
        </p>
      </header>
      {loadError && <p role="alert" style={{ color: "#991b1b" }}>{loadError}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <strong>Published premium: {totals.published.toLocaleString("en-NG")}</strong>
        <span>Drafts awaiting review: {totals.drafts.toLocaleString("en-NG")}</span>
        <span>Initial target: {totals.target.toLocaleString("en-NG")}</span>
      </div>
      <div style={{ maxHeight: 430, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 9 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            {columns.map((name) => <th key={name} scope="col" style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0" }}>{name}</th>)}
          </tr></thead>
          <tbody>{rows.map((item) => (
            <tr key={`${item.exam}-${item.subject}`}>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{item.exam}</td>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{item.subject}</td>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{item.published_premium}</td>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{item.drafts}</td>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{item.target}</td>
              <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{Math.max(0, item.target - item.published_premium)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <button type="button" onClick={async () => {
        try { setLoadError(""); await refreshCoverage(); }
        catch (err) { setLoadError(err.message || "Could not refresh coverage."); }
      }} style={{ justifySelf: "start", cursor: "pointer", padding: "10px 14px", borderRadius: 8, background: "#fff", border: "1px solid #cbd5e1", fontWeight: 700 }}>
        Refresh question counts
      </button>

      <form onSubmit={importBatch} style={{ display: "grid", gap: 12, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
        <h3 style={{ margin: 0 }}>Import a batch (maximum 50)</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#64748b" }}>
          Paste a JSON array or upload a JSON file. Imported questions are saved as
          unpublished drafts and will not reach learners until individually reviewed.
          Use only independently authored questions or material with documented redistribution rights.
        </p>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          JSON file (optional)
          <input type="file" accept=".json,application/json" onChange={(event) => upload(event.target.files?.[0])} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Question JSON
          <textarea style={{ ...field, minHeight: 195, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
            placeholder={sample} value={raw} onChange={(event) => setRaw(event.target.value)} required />
        </label>
        <button type="button" onClick={() => { setRaw(sample); setError(""); setNotice(""); }}
          style={{ justifySelf: "start", border: "1px solid #cbd5e1", padding: "9px 13px", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          Insert an example JSON question
        </button>
        <button type="submit" disabled={importing || !raw.trim()}
          style={{ justifySelf: "start", padding: "12px 18px", background: "#0f2a43", color: "#fff", borderRadius: 9, border: 0, fontWeight: 800, cursor: "pointer" }}>
          {importing ? "Importing drafts..." : "Import as unpublished drafts"}
        </button>
        {error && <p role="alert" style={{ margin: 0, padding: 12, color: "#991b1b", background: "#fef2f2", borderRadius: 8 }}>{error}</p>}
        {notice && <p role="status" style={{ margin: 0, padding: 12, color: "#166534", background: "#f0fdf4", borderRadius: 8 }}>{notice}</p>}
      </form>
    </section>
  );
}
