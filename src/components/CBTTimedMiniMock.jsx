import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const OPTIONS = ["A", "B", "C", "D"];
const MINIMOCK_QUESTION_COUNT = 10;
const MINI_MOCK_MINUTES = 10;
const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function CBTTimedMiniMock({ activationActive }) {
  const [exam, setExam] = useState("WAEC");
  const [session, setSession] = useState(null);
  const [review, setReview] = useState([]);
  const [history, setHistory] = useState([]);
  const [position, setPosition] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const autoFinishRequested = useRef(null);

  const loadHistory = useCallback(async () => {
    const { data, error: historyError } = await supabase
      .from("cbt_mock_sessions")
      .select("id, exam_type, score, total_questions, started_at, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10);
    if (historyError) throw historyError;
    setHistory(data || []);
  }, []);

  const loadSession = useCallback(async (id) => {
    const { data, error: sessionError } = await supabase.rpc("get_cbt_mini_mock", {
      p_session_id: id,
    });
    if (sessionError) throw sessionError;
    const offset = Date.parse(data.server_time) - Date.now();
    setServerOffsetMs(offset);
    setSecondsLeft(Math.max(0, Math.ceil((Date.parse(data.deadline_at) - Date.now() - offset) / 1000)));
    setSession(data);
    setPosition(0);
    setReview([]);
    autoFinishRequested.current = null;
    if (data.completed_at) {
      const { data: reviewData, error: reviewError } = await supabase.rpc("review_cbt_mini_mock", {
        p_session_id: id,
      });
      if (reviewError) throw reviewError;
      setReview(reviewData?.review || []);
    }
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: activeError } = await supabase.from("cbt_mock_sessions")
          .select("id").is("completed_at", null)
          .order("started_at", { ascending: false }).limit(1).maybeSingle();
        if (activeError) throw activeError;
        if (!active) return;
        if (data?.id) await loadSession(data.id);
        if (active) await loadHistory();
      } catch (initError) {
        if (active) setError(initError.message || "Could not load your mini mocks.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadHistory, loadSession]);

  useEffect(() => {
    if (!session || session.completed_at) return undefined;
    const updateClock = () => {
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(session.deadline_at) - Date.now() - serverOffsetMs) / 1000)));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [session?.session_id, session?.deadline_at, session?.completed_at, serverOffsetMs]);

  const finishMock = useCallback(async (id, automatic = false) => {
    if (!id) return;
    setFinishing(true);
    setError("");
    try {
      const { error: finishError } = await supabase.rpc("finish_cbt_mini_mock", {
        p_session_id: id,
      });
      if (finishError) throw finishError;
      await loadSession(id);
      await loadHistory();
      setNotice(automatic ? "Time is up. Your saved answers have been scored." : "Mock submitted. Review your score and corrections below.");
    } catch (finishError) {
      setError(finishError.message || "Submission failed. Please retry.");
    } finally {
      setFinishing(false);
    }
  }, [loadSession, loadHistory]);

  useEffect(() => {
    if (!session?.session_id || session.completed_at || secondsLeft === null || secondsLeft > 0) return;
    if (autoFinishRequested.current === session.session_id) return;
    autoFinishRequested.current = session.session_id;
    finishMock(session.session_id, true);
  }, [session?.session_id, session?.completed_at, secondsLeft, finishMock]);

  const startMock = async () => {
    if (!activationActive || starting) return;
    setStarting(true);
    setError("");
    setNotice("");
    try {
      const { data, error: startError } = await supabase.rpc("start_cbt_mini_mock", { p_exam_type: exam });
      if (startError) throw startError;
      await loadSession(data.session_id);
    } catch (startError) {
      setError(startError.message || "Unable to start the mock.");
    } finally {
      setStarting(false);
    }
  };

  const saveAnswer = async (questionId, option) => {
    if (!session?.session_id || session.completed_at || saving || secondsLeft === 0) return;
    setSaving(true);
    setError("");
    try {
      const { error: answerError } = await supabase.rpc("answer_cbt_mini_mock", {
        p_session_id: session.session_id,
        p_question_id: questionId,
        p_chosen_option: option,
      });
      if (answerError) throw answerError;
      setSession((current) => current && ({
        ...current,
        questions: current.questions.map((question) => question.question_id === questionId
          ? { ...question, chosen_option: option } : question),
      }));
    } catch (answerError) {
      setError(answerError.message || "Could not save the answer.");
    } finally {
      setSaving(false);
    }
  };

  const current = session?.questions?.[position] || null;
  const chosenCount = session?.questions?.filter((question) => Boolean(question.chosen_option)).length || 0;
  const complete = Boolean(session?.completed_at);

  return (
    <section className="meka-learn-mini-mock" aria-label="Timed WAEC and JAMB mini mock">
      <div className="meka-learn-mini-mock-heading">
        <div>
          <p className="meka-learn-overline">Premium CBT · Activated learners</p>
          <h3>Timed WAEC & JAMB mini mocks</h3>
          <p className="meka-learn-muted">
            A {MINI_MOCK_MINUTES}-minute practice test with {MINIMOCK_QUESTION_COUNT} randomly selected premium questions.
            This starter mini mock is not a full WAEC paper or the official JAMB UTME subject format.
          </p>
        </div>
        {session && !complete && <strong className={secondsLeft !== null && secondsLeft <= 60 ? "meka-mini-clock warning" : "meka-mini-clock"} aria-live="off">{secondsLeft === null ? "--:--" : formatTime(secondsLeft)} remaining</strong>}
      </div>

      {error && <p role="alert" className="meka-learn-error">{error}</p>}
      {notice && <p role="status" className="meka-learn-message">{notice}</p>}

      {loading ? <p className="meka-learn-muted">Checking your mock sessions...</p> :
        session ? (
          <>
            <div className="meka-mini-progress">
              <strong>{session.exam_type} mini mock</strong>
              <span>{complete ? `Score: ${session.score}/${session.question_count}` : `${chosenCount} of ${session.question_count} answers saved`}</span>
            </div>
            <div className="meka-mini-navigation" aria-label="Select mock question">
              {(session.questions || []).map((q, index) => (
                <button type="button" key={q.question_id} onClick={() => setPosition(index)}
                  aria-current={position === index ? "step" : undefined}
                  className={position === index ? "selected" : q.chosen_option ? "answered" : ""}>
                  {index + 1}
                </button>
              ))}
            </div>
            {current && (
              <div className="meka-mini-question" key={current.question_id}>
                <p className="meka-learn-muted">Question {position + 1} · {current.subject} · {current.topic}</p>
                <h4>{current.question_text}</h4>
                {OPTIONS.map((letter) => (
                  <label key={letter} className="meka-learn-practice-option">
                    <input type="radio" name={`mini-${current.question_id}`} value={letter}
                      checked={current.chosen_option === letter} disabled={complete || saving || secondsLeft === 0}
                      onChange={() => saveAnswer(current.question_id, letter)} />
                    <span>{letter}. {current[`option_${letter.toLowerCase()}`]}</span>
                  </label>
                ))}
                {complete && (() => {
                  const correction = review.find((item) => item.question_id === current.question_id);
                  return correction ? (
                    <div className="meka-learn-practice-result">
                      <strong>{correction.is_correct ? "Correct" : "Correction"} · Answer {correction.correct_option}</strong>
                      <p>{correction.explanation}</p>
                    </div>
                  ) : <p className="meka-learn-muted">Loading corrections...</p>;
                })()}
              </div>
            )}
            <div className="meka-mini-footer">
              <button type="button" className="meka-learn-link" disabled={position === 0} onClick={() => setPosition((n) => Math.max(0, n - 1))}>Previous</button>
              <button type="button" className="meka-learn-link" disabled={position >= session.questions.length - 1}
                onClick={() => setPosition((n) => Math.min(session.questions.length - 1, n + 1))}>Next</button>
              {!complete && (
                <button type="button" className="meka-learn-primary" disabled={saving || finishing}
                  onClick={() => finishMock(session.session_id)}>
                  {finishing ? "Scoring..." : "Submit mini mock"}
                </button>
              )}
              {complete && <button type="button" className="meka-learn-primary"
                onClick={() => { setSession(null); setReview([]); setError(""); setNotice(""); }}>
                {activationActive ? "Start a new mini mock" : "Back to mini mocks"}
              </button>}
            </div>
          </>
        ) : (
          <div className="meka-mini-start">
            {activationActive ? (
              <>
                <label>Choose an exam
                  <select value={exam} onChange={(event) => setExam(event.target.value)}>
                    <option value="WAEC">WAEC-style mini mock</option>
                    <option value="JAMB">JAMB-style mini mock</option>
                  </select>
                </label>
                <button className="meka-learn-primary" type="button" disabled={starting} onClick={startMock}>
                  {starting ? "Preparing your mock..." : "Start 10-minute premium mini mock"}
                </button>
              </>
            ) : <p className="meka-learn-muted">Activate a valid 30-day CBT PIN to unlock timed premium mini mocks. Your free topic practice remains available.</p>}
          </div>
        )
      }

      {history.length > 0 && (
        <div className="meka-mini-history">
          <h4>Recent mini-mock results</h4>
          {history.map((item) => (
            <button type="button" key={item.id} onClick={async () => {
              setError("");
              try { await loadSession(item.id); }
              catch (loadError) { setError(loadError.message || "Could not load this result."); }
            }}>
              {item.exam_type} · {item.score}/{item.total_questions} · {new Date(item.completed_at).toLocaleDateString("en-NG")}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
