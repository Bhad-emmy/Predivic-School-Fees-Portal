import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const LAGOS_TIME_ZONE = "Africa/Lagos";
const LATE_CUTOFF = "08:00";

const getDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const getLagosTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

const getMonthRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
};

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

const formatTime = (value) => (value ? String(value).slice(0, 5) : "-");

const isLate = (time) => Boolean(time && String(time).slice(0, 5) > LATE_CUTOFF);

const fullName = (teacher) =>
  [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ");

const getMonthString = (date = new Date()) => getDateString(date).slice(0, 7);

export default function TeacherAttendance() {
  const { staff, isAdmin, isAttendanceOnly } = useAuth();
  const role = String(staff?.role || "").toLowerCase();
  const canManage = isAdmin || isAttendanceOnly || role === "secretary";

  const [teachers, setTeachers] = useState([]);
  const [records, setRecords] = useState({});
  const [selfRecord, setSelfRecord] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getDateString());
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => String(teacher.status).toLowerCase() === "active"),
    [teachers]
  );

  const loadTeachers = async () => {
    if (!canManage) return;

    const { data, error: queryError } = await supabase
      .from("teachers")
      .select("id, employee_no, first_name, middle_name, last_name, role, status")
      .eq("status", "Active")
      .order("first_name", { ascending: true });

    if (queryError) throw queryError;
    setTeachers(data || []);
  };

  const loadDailyRecords = async () => {
    const { data, error: queryError } = await supabase
      .from("teacher_attendance")
      .select("id, teacher_id, teacher_name, attendance_date, status, check_in, check_out, note")
      .eq("attendance_date", selectedDate);

    if (queryError) throw queryError;

    const next = {};
    for (const record of data || []) next[record.teacher_id] = record;
    setRecords(next);

    if (!canManage && staff?.id) {
      setSelfRecord(next[staff.id] || null);
    }
  };

  const loadSelfRecord = async () => {
    if (canManage || !staff?.id) return;

    const { data, error: queryError } = await supabase
      .from("teacher_attendance")
      .select("id, teacher_id, teacher_name, attendance_date, status, check_in, check_out, note")
      .eq("teacher_id", staff.id)
      .eq("attendance_date", selectedDate)
      .maybeSingle();

    if (queryError) throw queryError;
    setSelfRecord(data || null);
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    const { start, end } = getMonthRange(selectedMonth);

    const { data, error: queryError } = await supabase
      .from("teacher_attendance")
      .select("teacher_id, status, attendance_date, check_in, check_out")
      .gte("attendance_date", start)
      .lte("attendance_date", end);

    if (queryError) {
      setSummaryLoading(false);
      throw queryError;
    }

    const next = {};
    for (const record of data || []) {
      if (!next[record.teacher_id]) {
        next[record.teacher_id] = {
          Present: 0,
          Late: 0,
          Absent: 0,
          Excused: 0,
          total: 0,
        };
      }
      next[record.teacher_id][record.status] =
        (next[record.teacher_id][record.status] || 0) + 1;
      next[record.teacher_id].total += 1;
    }

    setSummary(next);
    setSummaryLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadTeachers(),
        canManage ? loadDailyRecords() : loadSelfRecord(),
        loadSummary(),
      ]);
    } catch (err) {
      console.error("TEACHER ATTENDANCE LOAD ERROR:", err);
      setError(err.message || "Unable to load teacher attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [selectedDate, selectedMonth, canManage, staff?.id]);

  const saveRecord = async (teacher, status, checkIn = null, checkOut = null) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const existing = records[teacher.id];
      const payload = {
        teacher_id: teacher.id,
        teacher_name: fullName(teacher),
        attendance_date: selectedDate,
        status,
        check_in: checkIn ?? existing?.check_in ?? null,
        check_out: checkOut ?? existing?.check_out ?? null,
        note: note.trim() || existing?.note || null,
        school_id: staff.school_id,
      };

      const query = existing
        ? supabase.from("teacher_attendance").update(payload).eq("id", existing.id).select().single()
        : supabase.from("teacher_attendance").insert(payload).select().single();

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      setRecords((current) => ({ ...current, [teacher.id]: data }));
      setNote("");
      setSuccess(`${fullName(teacher)} marked ${status.toLowerCase()}.`);
      await loadSummary();
    } catch (err) {
      console.error("TEACHER ATTENDANCE SAVE ERROR:", err);
      setError(err.message || "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const markPresentNow = async (teacher) => {
    const time = getLagosTime();
    await saveRecord(teacher, isLate(time) ? "Late" : "Present", time);
  };

  const markAbsent = async (teacher) => {
    await saveRecord(teacher, "Absent", null, null);
  };

  const markExcused = async (teacher) => {
    await saveRecord(teacher, "Excused", null, null);
  };

  const checkOut = async () => {
    if (!selfRecord) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: queryError } = await supabase
        .from("teacher_attendance")
        .update({ check_out: getLagosTime() })
        .eq("id", selfRecord.id)
        .select()
        .single();

      if (queryError) throw queryError;
      setSelfRecord(data);
      setSuccess("Check-out recorded.");
    } catch (err) {
      setError(err.message || "Unable to record check-out.");
    } finally {
      setSaving(false);
    }
  };

  const selfTeacher = {
    id: staff?.id,
    employee_no: staff?.employee_no,
    first_name: staff?.first_name,
    middle_name: staff?.middle_name,
    last_name: staff?.last_name,
    status: staff?.status,
    role: staff?.role,
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h1>Teacher Attendance</h1></div>
        <div className="page-card"><p>Loading teacher attendance...</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Teacher Attendance</h1>
          <p style={{ color: "#64748b", marginTop: "6px" }}>
            Daily sign-in, check-out and monthly attendance records.
          </p>
        </div>
      </div>

      {error && (
        <div className="page-card" style={{ borderLeft: "4px solid #dc2626", marginBottom: "16px" }}>
          <strong>Error</strong><p style={{ marginTop: "6px" }}>{error}</p>
        </div>
      )}

      {success && (
        <div className="page-card" style={{ borderLeft: "4px solid #16a34a", marginBottom: "16px" }}>
          {success}
        </div>
      )}

      {!canManage ? (
        <div className="page-card">
          <h2>My attendance</h2>
          <p style={{ color: "#64748b", margin: "6px 0 20px" }}>
            Sign-in time is recorded using Lagos time. After 8:00 AM, the record is automatically marked Late.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <label>
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{ display: "block", marginTop: "6px" }}
              />
            </label>

            <div style={{ minWidth: "180px" }}>
              <strong>{selfRecord?.status || "Not signed in"}</strong>
              <div style={{ color: "#64748b", marginTop: "5px" }}>
                In: {formatTime(selfRecord?.check_in)} · Out: {formatTime(selfRecord?.check_out)}
              </div>
            </div>

            {!selfRecord ? (
              <button
                className="primary-btn"
                disabled={saving || selectedDate !== getDateString()}
                onClick={() => markPresentNow(selfTeacher)}
              >
                {saving ? "Saving..." : "Check in now"}
              </button>
            ) : (
              <button
                className="primary-btn"
                disabled={saving || Boolean(selfRecord.check_out)}
                onClick={checkOut}
              >
                {selfRecord.check_out ? "Checked out" : saving ? "Saving..." : "Check out"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="page-card">
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "end" }}>
              <label>
                Attendance date
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  style={{ display: "block", marginTop: "6px" }}
                />
              </label>

              <label>
                Monthly summary
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  style={{ display: "block", marginTop: "6px" }}
                />
              </label>
            </div>

            <p style={{ color: "#64748b", marginTop: "14px" }}>
              8:00 AM is the punctuality cutoff. A check-in after 8:00 AM is recorded as Late.
            </p>
          </div>

          <div className="page-card">
            <h2>Daily register</h2>
            <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
              {formatDate(selectedDate)} · {activeTeachers.length} active staff
            </p>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Teacher</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTeachers.map((teacher) => {
                    const record = records[teacher.id];
                    return (
                      <tr key={teacher.id}>
                        <td>{teacher.employee_no || "-"}</td>
                        <td><strong>{fullName(teacher)}</strong></td>
                        <td>{record?.status || "Not marked"}</td>
                        <td>{formatTime(record?.check_in)}</td>
                        <td>{formatTime(record?.check_out)}</td>
                        <td>
                          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                            <button className="primary-btn" disabled={saving} onClick={() => markPresentNow(teacher)}>
                              {record ? "Sign in" : "Mark present"}
                            </button>
                            <button className="secondary-btn" disabled={saving} onClick={() => markAbsent(teacher)}>
                              Absent
                            </button>
                            <button className="secondary-btn" disabled={saving} onClick={() => markExcused(teacher)}>
                              Excused
                            </button>
                            {record && !record.check_out && (
                              <button className="secondary-btn" disabled={saving} onClick={() => saveRecord(teacher, record.status, record.check_in, getLagosTime())}>
                                Check out
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!activeTeachers.length && (
                    <tr><td colSpan="6">No active teachers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-card">
            <h2>Monthly attendance summary</h2>
            <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
              {selectedMonth} · Late records are counted separately for punctuality and future salary-deduction rules.
            </p>

            {summaryLoading ? (
              <p>Loading monthly summary...</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Excused</th>
                      <th>Total marked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTeachers.map((teacher) => {
                      const stats = summary[teacher.id] || {};
                      return (
                        <tr key={teacher.id}>
                          <td><strong>{fullName(teacher)}</strong></td>
                          <td>{stats.Present || 0}</td>
                          <td>{stats.Late || 0}</td>
                          <td>{stats.Absent || 0}</td>
                          <td>{stats.Excused || 0}</td>
                          <td>{stats.total || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {canManage && (
        <div className="page-card">
          <label style={{ display: "block", marginBottom: "7px", fontWeight: 600 }}>
            Note for next attendance action
          </label>
          <textarea
            rows="2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note, e.g. approved late arrival."
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
      )}
    </div>
  );
}
