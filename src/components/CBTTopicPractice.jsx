import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      const { data, error: questionError } = await supabase
        .from("cbt_questions")
        .select("id,exam_type,subject,topic,question_text,option_a,option_b,option_c,option_d,is_free_preview")
        .eq("exam_type", exam)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (questionError) setError(questionError.message);
      else setQuestions(data || []);
      setSubject("all");
      setSelectedId(null);
      setChosen("");
      setResult(null);
      setLoading(false);
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

  const subjects = useMemo(
    () => [...new Set(questions.map((q) => q.subject))].sort(),
    [questions]
  );
  const visibleQuestions = useMemo(
    () => questions.filter((q) => subject === "all" || q.subject === subject),
    [questions, subject]
  );
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
          Choose an exam and topic, attempt an original or rights-cleared question, then see the correction
          after submitting. Full timed mocks are still under development.
        </p>
        {attemptCount !== null && <p className="meka-learn-muted">Practice answers submitted on this account: {attemptCount}</p>}
      </div>
      <div className="meka-learn-practice-filters">
        <label>Exam
          <select value={exam} style={control} onChange={(event) => setExam(event.target.value)}>
            <option value="WAEC">WAEC</option>
            <option value="JAMB">JAMB / UTME</option>
          </select>
        </label>
        <label>Subject
          <select value={subject} style={control} onChange={(event) => { setSubject(event.target.value); setSelectedId(null); setResult(null); setChosen(""); }}>
            <option value="all">All subjects</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="meka-learn-muted">Loading questions...</p> :
        visibleQuestions.length === 0 ? (
          <p className="meka-learn-muted">
            No approved questions are available for this selection yet.
            {activationActive ? " The content team can publish questions from the operator dashboard." : " Additional premium content will unlock when your activation PIN is active."}
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
