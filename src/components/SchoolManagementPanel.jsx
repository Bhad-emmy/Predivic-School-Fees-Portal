import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SchoolManagementPanel({ isAdmin }) {
  const [school, setSchool] = useState(null);
  const [stats, setStats] = useState({
    students: 0,
    staff: 0,
    classes: 0,
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("No authenticated user found.");

      const { data: staff, error: staffError } = await supabase
        .from("teachers")
        .select("id, school_id")
        .eq("auth_user_id", user.id)
        .eq("status", "Active")
        .maybeSingle();

      if (staffError) throw staffError;
      if (!staff?.school_id) throw new Error("Your account is not linked to a school.");

      const schoolId = staff.school_id;

      const { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .select("id, name, slug, code, status, created_at, updated_at")
        .eq("id", schoolId)
        .maybeSingle();

      if (schoolError) throw schoolError;
      if (!schoolData) throw new Error("School record was not found.");

      const [students, staffCount, classes, logs] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
        supabase
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "Active"),
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
        supabase
          .from("staff_account_audit_logs")
          .select("id, actor_teacher_id, target_teacher_id, target_email, target_role, action, created_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      for (const result of [students, staffCount, classes, logs]) {
        if (result.error) throw result.error;
      }

      setSchool(schoolData);
      setStats({
        students: students.count || 0,
        staff: staffCount.count || 0,
        classes: classes.count || 0,
      });

      const actorIds = [...new Set(
        (logs.data || []).map((item) => item.actor_teacher_id).filter(Boolean)
      )];

      let actorMap = new Map();
      if (actorIds.length) {
        const { data: actors, error: actorsError } = await supabase
          .from("teachers")
          .select("id, first_name, middle_name, last_name")
          .in("id", actorIds);

        if (actorsError) throw actorsError;

        actorMap = new Map(
          (actors || []).map((actor) => [
            actor.id,
            [actor.first_name, actor.middle_name, actor.last_name]
              .filter(Boolean)
              .join(" "),
          ])
        );
      }

      setAuditLogs(
        (logs.data || []).map((log) => ({
          ...log,
          actorName: actorMap.get(log.actor_teacher_id) || "Admin",
        }))
      );
    } catch (err) {
      console.error("SCHOOL MANAGEMENT LOAD ERROR:", err);
      setError(err.message || "Unable to load school management data.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) return null;

  return (
    <div id="settings-school-management" className="settings-section">
      <div className="settings-section-header">
        <div>
          <h2>School Management</h2>
          <p>Tenant information, school status, usage counts, and staff-account activity.</p>
        </div>
        <span className="settings-badge ready">Admin Only</span>
      </div>

      {error && (
        <div className="settings-error" role="alert">
          {error}
        </div>
      )}

      {loading && !school ? (
        <p>Loading school information...</p>
      ) : (
        <>
          <div className="settings-grid">
            <div className="settings-item">
              <span>School</span>
              <strong>{school?.name || "-"}</strong>
            </div>
            <div className="settings-item">
              <span>Status</span>
              <strong>{school?.status || "-"}</strong>
            </div>
            <div className="settings-item">
              <span>School Code</span>
              <strong>{school?.code || "-"}</strong>
            </div>
            <div className="settings-item">
              <span>Tenant ID</span>
              <strong className="settings-small-value">{school?.id || "-"}</strong>
            </div>
            <div className="settings-item">
              <span>Students</span>
              <strong>{stats.students}</strong>
            </div>
            <div className="settings-item">
              <span>Active Staff</span>
              <strong>{stats.staff}</strong>
            </div>
            <div className="settings-item">
              <span>Classes</span>
              <strong>{stats.classes}</strong>
            </div>
            <div className="settings-item">
              <span>Created</span>
              <strong>{formatDate(school?.created_at)}</strong>
            </div>
          </div>

          <div style={{ marginTop: "28px" }}>
            <div className="settings-section-header">
              <div>
                <h3>Staff Account Audit</h3>
                <p>Recent account creation/authorization events for this school.</p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <p>No staff account activity has been recorded yet.</p>
            ) : (
              <div className="settings-security-list">
                {auditLogs.map((log) => (
                  <div className="security-row" key={log.id}>
                    <div>
                      <strong>{log.action === "STAFF_ACCOUNT_AUTHORIZED" ? "Staff account authorized" : "Staff account created"}</strong>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        {log.target_email || "-"} • {log.target_role || "-"}
                      </small>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        By {log.actorName} • {formatDate(log.created_at)}
                      </small>
                    </div>
                    <span className="settings-badge ready">{log.target_role || "Staff"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: "20px" }}>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.75 }}>
              School activation/deactivation is intentionally not exposed to ordinary school Admins.
              That control belongs in the MEKA platform-owner layer so a school cannot lock itself out.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
