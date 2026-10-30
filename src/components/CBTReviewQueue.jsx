import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const border = "1px solid #cbd5e1";
const btn = { border, borderRadius: 8, padding: "10px 13px", background: "#fff", cursor: "pointer", fontWeight: 700 };
const PAGE_SIZE = 50;

export default function CBTReviewQueue() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [filter, setFilter] = useState("draft");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [review, setReview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    let query = supabase.from("cbt_questions")
      .select("id, exam_type, subject, topic, question_text, is_published, content_origin, created_at")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (filter === "draft") query = query.eq("is_published", false);
    if (filter === "published") query = query.eq("is_published", true);
    const { data, error: loadError } = await query;
    if (loadError) throw loadError;
    setItems((data || []).slice(0, PAGE_SIZE));
    setHasMore((data || []).length > PAGE_SIZE);
  }, [filter, page]);

  useEffect(() => {
    let mounted = true;
    supabase.rpc("is_cbt_platform_operator").then(({ data, error: checkError }) => {
      if (!mounted) return;
      setAllowed(!checkError && Boolean(data));
      setChecking(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!allowed) return undefined;
    let active = true;
    load().catch((loadError) => { if (active) setError(loadError.message); });
    const onImport = () => load().catch((loadError) => { if (active) setError(loadError.message); });
    window.addEventListener("cbt-bank-updated", onImport);
    return () => {
      active = false;
      window.removeEventListener("cbt-bank-updated", onImport);
    };
  }, [allowed, load]);

  const openReview = async (questionId) => {
    setError("");
    setNotice("");
    setConfirmed(false);
    setReview(null);
    setReviewLoading(true);
    try {
      const { data, error: reviewError } = await supabase.rpc("review_cbt_question_for_operator", {
        p_question_id: questionId,
      });
      if (reviewError) throw reviewError;
      setReview(data);
    } catch (reviewError) {
      setError(reviewError.message || "Could not load the question and answer key.");
    } finally {
      setReviewLoading(false);
    }
  };

  const changePublication = async () => {
    if (!review || (!review.is_published && !confirmed)) return;
    setError("");
    setPublishing(true);
    try {
      const { error: publishError } = await supabase.rpc("set_cbt_question_published", {
        p_question_id: review.id,
        p_published: !review.is_published,
      });
      if (publishError) throw publishError;
      setNotice(review.is_published
        ? "Question unpublished and withdrawn from future mocks."
        : "Question approved and now available to eligible learners.");
      setReview(null);
      setConfirmed(false);
      await load();
    } catch (publishError) {
      setError(publishError.message || "Could not change question publication.");
    } finally {
      setPublishing(false);
    }
  };

  if (checking || !allowed) return null;

  return (
    <section style={{ padding: 22, borderRadius: 14, background: "#fff", border: "1px solid #e2e8f0", display: "grid", gap: 14 }}>
      <div>
        <p style={{ margin: "0 0 5px", color: "#2563eb", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Authorized CBT content operators only</p>
        <h2 style={{ margin: "0 0 7px", fontSize: 21 }}>Question editorial review queue</h2>
        <p style={{ color: "#64748b", lineHeight: 1.6, margin: 0 }}>
          Inspect the question, all four options, correct answer, explanation and content rights before publishing.
          Drafts from the bulk importer remain hidden from students until reviewed.
        </p>
      </div>
      {error && <p role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, margin: 0 }}>{error}</p>}
      {notice && <p role="status" style={{ background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: 12, margin: 0 }}>{notice}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 700 }}>Show
          <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); setReview(null); }}
            style={{ marginLeft: 8, border, borderRadius: 8, padding: 9 }}>
            <option value="draft">Unpublished drafts</option>
            <option value="published">Published questions</option>
            <option value="all">All questions</option>
          </select>
        </label>
        <button type="button" style={btn} onClick={() => load().catch((e) => setError(e.message))}>Refresh</button>
        <span style={{ color: "#64748b", fontSize: 13 }}>50 questions per page</span>
      </div>
      {items.length === 0 ? <p style={{ color: "#64748b" }}>No questions in this category.</p> :
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: 12, border: "1px solid #e2e8f0", borderRadius: 9 }}>
              <div style={{ flex: "1 1 250px" }}>
                <strong>{item.exam_type} · {item.subject} · {item.topic}</strong>
                <p style={{ margin: "6px 0", color: "#475569", fontSize: 13 }}>{item.question_text}</p>
                <small>{item.is_published ? "Published" : "Awaiting review"} · {item.content_origin}</small>
              </div>
              <button type="button" style={btn} disabled={reviewLoading} onClick={() => openReview(item.id)}>Review answer and rights</button>
            </div>
          ))}
        </div>
      }
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" style={btn} disabled={page === 0} onClick={() => { setPage((p) => p - 1); setReview(null); }}>Previous</button>
        <span style={{ fontSize: 13 }}>Page {page + 1}</span>
        <button type="button" style={btn} disabled={!hasMore} onClick={() => { setPage((p) => p + 1); setReview(null); }}>Next</button>
      </div>

      {review && (
        <div style={{ display: "grid", gap: 12, border: "2px solid #93c5fd", borderRadius: 12, padding: 18, background: "#eff6ff" }}>
          <h3 style={{ margin: 0 }}>Review: {review.exam_type} · {review.subject} · {review.topic}</h3>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{review.question_text}</p>
          {["A", "B", "C", "D"].map((letter) => (
            <p key={letter} style={{ margin: 0, lineHeight: 1.5, fontWeight: review.correct_option === letter ? 800 : 400 }}>
              {letter}. {review[`option_${letter.toLowerCase()}`]} {review.correct_option === letter ? "— ANSWER" : ""}
            </p>
          ))}
          <div><strong>Explanation</strong><p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.explanation}</p></div>
          <p style={{ fontSize: 13, margin: 0 }}>
            Source: <strong>{review.content_origin}</strong>
            {review.license_reference ? ` · Recorded permission: ${review.license_reference}` : ""}
            {review.is_free_preview ? " · Free preview" : " · Paid questions"}
          </p>
          {!review.is_published && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.6, fontSize: 13 }}>
              <input type="checkbox" style={{ marginTop: 5 }} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I have checked the answer, explanation, syllabus coverage and rights to publish this question.
            </label>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={publishing || (!review.is_published && !confirmed)}
              onClick={changePublication}
              style={{ ...btn, background: review.is_published ? "#fff" : "#166534", color: review.is_published ? "#334155" : "#fff" }}>
              {publishing ? "Saving..." : review.is_published ? "Unpublish" : "Approve and publish"}
            </button>
            <button type="button" style={btn} onClick={() => { setReview(null); setConfirmed(false); }}>Close review</button>
          </div>
        </div>
      )}
    </section>
  );
}
