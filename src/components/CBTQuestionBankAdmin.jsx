import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const blankQuestion = {
  examType: "WAEC",
  subject: "",
  topic: "",
  prompt: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correct: "A",
  explanation: "",
  origin: "original",
  licenseReference: "",
  freePreview: true,
};

const fieldStyle = { display: "grid", gap: 6, fontSize: 13, fontWeight: 700 };
const inputStyle = {
  font: "inherit", boxSizing: "border-box", width: "100%", padding: 10,
  borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff",
};

export default function CBTQuestionBankAdmin() {
  const [isOperator, setIsOperator] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState(blankQuestion);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQuestions = async () => {
    const { data, error: listError } = await supabase.from("cbt_questions")
      .select("id, exam_type, subject, topic, question_text, content_origin, is_free_preview, is_published, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (listError) throw listError;
    setRows(data || []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: accessError } = await supabase.rpc("is_cbt_platform_operator");
      if (!active) return;
      if (accessError || !data) {
        setChecking(false);
        return;
      }
      setIsOperator(true);
      try {
        const { data: questions, error: listError } = await supabase
          .from("cbt_questions")
          .select("id, exam_type, subject, topic, question_text, content_origin, is_free_preview, is_published, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (listError) throw listError;
        if (active) setRows(questions || []);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const createQuestion = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      if (form.origin === "licensed" && !form.licenseReference.trim()) {
        throw new Error("Document the redistribution permission for licensed content before saving.");
      }
      const { error: addError } = await supabase.rpc("create_cbt_practice_question", {
        p_exam_type: form.examType,
        p_subject: form.subject.trim(),
        p_topic: form.topic.trim(),
        p_question_text: form.prompt.trim(),
        p_option_a: form.optionA.trim(),
        p_option_b: form.optionB.trim(),
        p_option_c: form.optionC.trim(),
        p_option_d: form.optionD.trim(),
        p_correct_option: form.correct,
        p_explanation: form.explanation.trim(),
        p_content_origin: form.origin,
        p_license_reference: form.origin === "licensed" ? form.licenseReference.trim() : null,
        p_is_free_preview: form.freePreview,
      });
      if (addError) throw addError;
      setForm(blankQuestion);
      setNotice("Question saved as a draft. Review it before publishing to learners.");
      await loadQuestions();
    } catch (saveError) {
      setError(saveError.message || "Could not save this question.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (question) => {
    setError("");
    setNotice("");
    setWorkingId(question.id);
    try {
      const { error: publishError } = await supabase.rpc("set_cbt_question_published", {
        p_question_id: question.id,
        p_published: !question.is_published,
      });
      if (publishError) throw publishError;
      setNotice(question.is_published ? "Question unpublished." : "Question published for eligible learners.");
      await loadQuestions();
    } catch (publishError) {
      setError(publishError.message || "Publication change failed.");
    } finally {
      setWorkingId(null);
    }
  };

  if (checking || !isOperator) return null;

  return (
    <section style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 14, padding: 22, display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: "0 0 5px", color: "#2563eb", textTransform: "uppercase", fontSize: 12, letterSpacing: ".08em", fontWeight: 800 }}>MEKA CBT content operators only</p>
        <h2 style={{ margin: "0 0 6px" }}>WAEC & JAMB question bank</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          Write original practice questions or enter material you have rights to distribute.
          Questions start unpublished; answer keys stay on the server.
          Free-preview questions are visible to registered learners without a paid PIN.
        </p>
      </header>
      {error && <p role="alert" style={{ color: "#991b1b", margin: 0, padding: 12, background: "#fef2f2", borderRadius: 8 }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#166534", margin: 0, padding: 12, background: "#f0fdf4", borderRadius: 8 }}>{notice}</p>}
      <form onSubmit={createQuestion} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <label style={fieldStyle}>Exam
            <select style={inputStyle} value={form.examType} onChange={(e) => update("examType", e.target.value)}>
              <option value="WAEC">WAEC</option><option value="JAMB">JAMB / UTME</option>
            </select>
          </label>
          <label style={fieldStyle}>Subject
            <input style={inputStyle} minLength={2} maxLength={80} required value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="e.g. Mathematics" />
          </label>
          <label style={fieldStyle}>Syllabus topic
            <input style={inputStyle} minLength={2} maxLength={120} required value={form.topic} onChange={(e) => update("topic", e.target.value)} placeholder="e.g. Algebra" />
          </label>
        </div>
        <label style={fieldStyle}>Question
          <textarea style={inputStyle} rows={3} minLength={10} maxLength={6000} required value={form.prompt} onChange={(e) => update("prompt", e.target.value)} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
          {["A", "B", "C", "D"].map((key) => (
            <label key={key} style={fieldStyle}>Option {key}
              <input style={inputStyle} required maxLength={2000} value={form[`option${key}`]} onChange={(e) => update(`option${key}`, e.target.value)} />
            </label>
          ))}
        </div>
        <label style={fieldStyle}>Correct answer
          <select style={inputStyle} value={form.correct} onChange={(e) => update("correct", e.target.value)}>
            {["A","B","C","D"].map((key) => <option value={key} key={key}>{key}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>Explanation and correction
          <textarea style={inputStyle} rows={3} minLength={5} maxLength={6000} required value={form.explanation} onChange={(e) => update("explanation", e.target.value)} placeholder="Explain why the answer is correct." />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          <label style={fieldStyle}>Content origin
            <select style={inputStyle} value={form.origin} onChange={(e) => update("origin", e.target.value)}>
              <option value="original">Original MEKA-style practice question</option>
              <option value="licensed">Licensed/authenticated redistribution rights</option>
            </select>
          </label>
          {form.origin === "licensed" && (
            <label style={fieldStyle}>License / permission reference
              <input style={inputStyle} minLength={3} maxLength={2000} required value={form.licenseReference} onChange={(e) => update("licenseReference", e.target.value)} placeholder="Rights agreement or permission identifier" />
            </label>
          )}
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={form.freePreview} onChange={(e) => update("freePreview", e.target.checked)} />
          Make this a free sample question once reviewed and published
        </label>
        <button disabled={saving} type="submit" style={{ justifySelf: "start", border: 0, borderRadius: 9, color: "#fff", background: "#0f2a43", padding: "13px 18px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving..." : "Save question as draft"}
        </button>
      </form>
      <div>
        <h3 style={{ margin: "6px 0 12px" }}>Recent questions ({rows.length})</h3>
        {rows.length === 0 && <p style={{ color: "#64748b" }}>No question drafts yet. Create and review the first question above.</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((question) => (
            <div key={question.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ flex: "1 1 240px" }}>
                <strong>{question.exam_type} · {question.subject} · {question.topic}</strong>
                <p style={{ color: "#475569", fontSize: 13, margin: "6px 0" }}>{question.question_text}</p>
                <small style={{ color: "#64748b" }}>
                  {question.is_published ? "Published" : "Draft"} · {question.is_free_preview ? "Free preview" : "PIN required"} · {question.content_origin}
                </small>
              </div>
              <button disabled={workingId === question.id} type="button" onClick={() => togglePublished(question)}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 13px", cursor: "pointer", background: "#fff", fontWeight: 700 }}>
                {workingId === question.id ? "Saving..." : question.is_published ? "Unpublish" : "Publish"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
