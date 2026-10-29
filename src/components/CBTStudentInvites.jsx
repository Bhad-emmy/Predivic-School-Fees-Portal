import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getStudents } from "../lib/schoolData";

export default function CBTStudentInvites() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getStudents().then((items) => {
      if (mounted) setStudents(items.filter((item) => String(item.status || "").toLowerCase() === "active"));
    }).catch((loadError) => {
      if (mounted) setError(loadError.message || "Unable to load school students.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const issueInvitation = async (event) => {
    event.preventDefault();
    if (!studentId) return;
    setError("");
    setCode("");
    setBusy(true);
    try {
      const { data, error: issueError } = await supabase.rpc("issue_cbt_school_invite", {
        p_student_id: studentId,
      });
      if (issueError) throw issueError;
      setCode(data);
    } catch (issueError) {
      setError(issueError.message || "Unable to issue an invitation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ background: "var(--card-background, #fff)", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 14, padding: 22, display: "grid", gap: 14 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>School CBT student access</h2>
        <p style={{ color: "#64748b", lineHeight: 1.6, margin: 0 }}>
          Invite a student to activate their own CBT login at <strong>/learn</strong>.
          The invitation is valid for 48 hours and can be redeemed only once.
        </p>
      </div>
      <form onSubmit={issueInvitation} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 6, flex: "1 1 280px", fontWeight: 700, fontSize: 13 }}>
          Choose a registered student
          <select disabled={loading || busy} value={studentId} onChange={(event) => { setStudentId(event.target.value); setCode(""); }} required style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, width: "100%" }}>
            <option value="">{loading ? "Loading students..." : "Select a student"}</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.fullName} — {student.admissionNo || "No admission number"} ({student.className || "Unassigned"})</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!studentId || busy} style={{ alignSelf: "end", border: 0, color: "#fff", background: "#0f2a43", padding: "13px 16px", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Issuing..." : "Generate one-time invitation"}
        </button>
      </form>
      {error && <p role="alert" style={{ color: "#991b1b", background: "#fef2f2", borderRadius: 8, padding: 12, margin: 0 }}>{error}</p>}
      {code && (
        <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
          <strong>Share this one-time invitation privately with the selected student.</strong>
          <p style={{ color: "#166534", margin: "8px 0", overflowWrap: "anywhere", fontFamily: "monospace", fontSize: 13 }}>{code}</p>
          <p style={{ margin: 0, color: "#166534", fontSize: 13 }}>
            This code cannot be retrieved later. Generating a new code revokes previous unused codes.
            Do not post it in public groups.
          </p>
        </div>
      )}
    </section>
  );
}
