import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { listCBTSubjects } from "../lib/cbtSubjects";

const answers = ["A", "B", "C", "D"];
const control = { padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, font: "inherit", background: "#fff", maxWidth: "100%" };

export default function CBTTopicPractice({ activationActive }) {
  const [exam, setExam] = useState("WAEC");
  const [subject, setSubject] = useState("all");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [chosen, setChosen] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(null);
  const [subjectCounts, setSubjectCounts] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      // Operators may read every question for editorial review through RLS.
      // Learner practice must still respect the learner's own PIN entitlement.
      // Apply the free/paid filter in the database query BEFORE the result
      // limit; otherwise the newest premium items could hide every free item.
      let query = supabase
        .from("cbt_questions")
        .select("id,exam_type,subject,topic,question_text,option_a,option_b,option_c,option_d,is_free_preview")
        .eq("exam_type", exam)
        .eq("is_published", true);
      if (!activationActive) {
        query = query.eq("is_free_preview", true);
      }
      if (subject !== "all") query = query.eq("subject", subject);
      const { data, error: questionError } = await query
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (questionError) setError(questionError.message);
      else setQuestions(data || []);
      setSelectedId(null);
      setChosen("");
      setResult(null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [exam, subject, activationActive]);

  // Check learner-visible availability; CBT editorial permissions must not
  // make premium questions appear to unactivated learner accounts.
  useEffect(() => {
    let active = true;
    setSubjectCounts({});
    (async () => {
      let query = supabase.from("cbt_questions")
        .select("subject")
        .eq("exam_type", exam)
        .eq("is_published", true);
      if (!activationActive) query = query.eq("is_free_preview", true);
      const { data, error: coverageError } = await query.limit(1000);
      if (!active || coverageError) return;
      const counts = {};
      (data || []).forEach((q) => { counts[q.subject] = (counts[q.subject] || 0) + 1; });
      setSubjectCounts(counts);
    })();
    return () => { active = false; };
  }, [exam, activationActive]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { count, error: countError } = await supabase
        .from("cbt_practice_attempts")
        .select("id", { count: "exact", head: true });
      if (active && !countError) setAttemptCount(count ?? 0);
    })();
    return () => { active = false; };
  }, [result?.attempt_id]);

  // List all exam subjects, even when no original questions have been reviewed.
  const subjectCatalog = useMemo(() => listCBTSubjects(exam), [exam]);
  const subjectGroups = useMemo(
    () => [...new Set(subjectCatalog.map((item) => item.category))],
    [subjectCatalog]
  );
  const visibleQuestions = questions;
  const currentQuestion = visibleQuestions.find((q) => q.id === selectedId) || visibleQuestions[0] || null;

  const submit = async (event) => {
    event.preventDefault();
    if (!currentQuestion || !chosen || result) return;
    setError("");
    setSubmitting(true);
    try {
      const { data, error: submitError } = await supabase.rpc("submit_cbt_practice_answer", {
        p_question_id: currentQuestion.id,
        p_chosen_option: chosen,
      });
      if (submitError) throw submitError;
      setResult(data);
    } catch (submissionError) {
      setError(submissionError.message || "Could not submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const openQuestion = (id) => {
    setSelectedId(id);
    setChosen("");
    setResult(null);
    setError("");
  };

  return (
    <section className="meka-learn-practice">
      <div>
        <p className="meka-learn-overline">Available practice · New</p>
        <h3>WAEC & JAMB topic practice</h3>
        <p className="meka-learn-muted">
          Choose an exam and topic, then submit your answer to see the correction.
          {activationActive
            ? " Your active PIN also unlocks premium topic practice."
            : " Free sample questions are available without a PIN. Premium questions require activation."}
          {" "}Full-length exam simulations are still under development.
        </p>
        <p className="meka-learn-muted">
          Browse {subjectCatalog.length} {exam === "JAMB" ? "JAMB-approved" : "WAEC catalogue"} subjects.
          Questions available means you can practise now; pending content means there are
          no accessible reviewed questions yet. WAEC offerings can vary by exam series.
        </p>
        {attemptCount !== null && <p className="meka-learn-muted">Practice answers submitted on this account: {attemptCount}</p>}
      </div>
      <div className="meka-learn-practice-filters">
        <label>Exam
          <select value={exam} style={control} onChange={(event) => { setExam(event.target.value); setSubject("all"); }}>
            <option value="WAEC">WAEC</option>
            <option value="JAMB">JAMB / UTME</option>
          </select>
        </label>
        <label>Subject
          <select value={subject} style={control} onChange={(event) => { setSubject(event.target.value); setSelectedId(null); setResult(null); setChosen(""); }}>
            <option value="all">All subjects</option>
            {subjectGroups.map((category) => (
              <optgroup key={category} label={category}>
                {subjectCatalog.filter((item) => item.category === category).map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.label}{subjectCounts[item.name] ? " · Questions available" : " · Pending content"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {loading ? <p className="meka-learn-muted">Loading questions...</p> :
        visibleQuestions.length === 0 ? (
          <p className="meka-learn-muted">
            No accessible questions are available for this subject yet.
            {activationActive
              ? " We are preparing and reviewing more questions."
              : " Free samples are being added; some subjects may have premium questions that require activation."}
          </p>
        ) : (
          <div className="meka-learn-practice-layout">
            <nav aria-label="Practice question list">
              {visibleQuestions.map((item, index) => (
                <button type="button" key={item.id} className={currentQuestion?.id === item.id ? "selected" : ""}
                  onClick={() => openQuestion(item.id)}>
                  {index + 1}. {item.subject} · {item.topic} {item.is_free_preview ? "· Free" : "· Premium"}
                </button>
              ))}
            </nav>
            {currentQuestion && (
              <form className="meka-learn-practice-question" onSubmit={submit} key={currentQuestion.id}>
                <p className="meka-learn-muted">{currentQuestion.exam_type} · {currentQuestion.subject} · {currentQuestion.topic}</p>
                <h4>{currentQuestion.question_text}</h4>
                {answers.map((letter) => (
                  <label key={letter} className="meka-learn-practice-option">
                    <input type="radio" name="practice_answer" value={letter} disabled={Boolean(result)}
                      checked={chosen === letter} onChange={() => setChosen(letter)} />
                    <span>{letter}. {currentQuestion[`option_${letter.toLowerCase()}`]}</span>
                  </label>
                ))}
                {!result ? (
                  <button type="submit" className="meka-learn-primary" disabled={!chosen || submitting}>
                    {submitting ? "Checking answer..." : "Submit answer"}
                  </button>
                ) : (
                  <div className="meka-learn-practice-result" role="status">
                    <strong>{result.is_correct ? "Correct!" : "Not quite."} Correct answer: {result.correct_option}</strong>
                    <p>{result.explanation}</p>
                    <button type="button" className="meka-learn-primary"
                      onClick={() => {
                        const index = visibleQuestions.findIndex((q) => q.id === currentQuestion.id);
                        openQuestion(visibleQuestions[(index + 1) % visibleQuestions.length].id);
                      }}>Next question</button>
                  </div>
                )}
              </form>
            )}
          </div>
        )
      }
      {error && <p className="meka-learn-error" role="alert">{error}</p>}
    </section>
  );
}
