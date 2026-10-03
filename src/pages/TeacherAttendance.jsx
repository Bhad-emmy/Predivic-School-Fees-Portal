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

const getMonthString = () => getDateString().slice(0, 7);

const formatTime = (value) => (value ? String(value).slice(0, 5) : "—");

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      })
    : "—";

const isLate = (time) => Boolean(time && String(time).slice(0, 5) > LATE_CUTOFF);

const getLateMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  const [cutoffH, cutoffM] = LATE_CUTOFF.split(":").map(Number);
  return Math.max(0, h * 60 + m - (cutoffH * 60 + cutoffM));
};

const fullName = (staff) =>
  [staff?.first_name, staff?.middle_name, staff?.last_name].filter(Boolean).join(" ");

export default function TeacherAttendance() {
  const { staff, isAdmin, isAttendanceOnly } = useAuth();
  const role = String(staff?.role || "").toLowerCase();
  const canManage = isAdmin || isAttendanceOnly || role === "secretary";

  const [month, setMonth] = useState(getMonthString());
  const [selectedStaff, setSelectedStaff] = useState("");
  const [summary, setSummary] = useState([]);
  const [daily, setDaily] = useState([]);
  const [selfRecord, setSelfRecord] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getDateString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedSummary = useMemo(
    () => summary.find((row) => row.device_employee_no === selectedStaff),
    [summary, selectedStaff]
  );

  const selectedDaily = useMemo(
    () =>
      daily
        .filter((row) => row.device_employee_no === selectedStaff)
        .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date)),
    [daily, selectedStaff]
  );

  const loadAdminAttendance = async () => {
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
      .toISOString()
      .slice(0, 10);

    const [{ data: monthly, error: monthlyError }, { data: dailyRows, error: dailyError }] =
      await Promise.all([
        supabase
          .from("teacher_attendance_monthly_summary")
          .select("*")
          .eq("school_id", staff.school_id)
          .eq("month", monthStart)
          .order("device_staff_name"),
        supabase
          .from("teacher_attendance_summary")
          .select(
            "device_employee_no, device_staff_name, attendance_date, first_signin, last_signout, status, late_minutes"
          )
          .eq("school_id", staff.school_id)
          .gte("attendance_date", monthStart)
          .lte("attendance_date", monthEnd)
          .order("attendance_date"),
      ]);

    if (monthlyError) throw monthlyError;
    if (dailyError) throw dailyError;

    setSummary(monthly || []);
    setDaily(dailyRows || []);

    if (!selectedStaff && monthly?.length) {
      setSelectedStaff(monthly[0].device_employee_no);
    } else if (selectedStaff && !monthly?.some((row) => row.device_employee_no === selectedStaff)) {
      setSelectedStaff(monthly?.[0]?.device_employee_no || "");
    }
  };

  const loadSelfAttendance = async () => {
    if (!staff?.id) return;

    const { data, error: queryError } = await supabase
      .from("teacher_attendance")
      .select("id, status, check_in, check_out, late_minutes, attendance_date")
      .eq("teacher_id", staff.id)
      .eq("attendance_date", selectedDate)
      .maybeSingle();

    if (queryError) throw queryError;
    setSelfRecord(data || null);
  };

  const refresh = async () => {
    setLoading(true);
    setError("");

    try {
      if (canManage) {
        await loadAdminAttendance();
      } else {
        await loadSelfAttendance();
      }
    } catch (err) {
      console.error("TEACHER ATTENDANCE LOAD ERROR:", err);
      setError(err.message || "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [month, selectedDate, canManage, staff?.id]);

  const checkIn = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const time = getLagosTime();
      const payload = {
        teacher_id: staff.id,
        teacher_name: fullName(staff),
        attendance_date: selectedDate,
        status: isLate(time) ? "Late" : "Present",
        check_in: time,
        late_minutes: getLateMinutes(time),
        school_id: staff.school_id,
      };

      const query = selfRecord
        ? supabase.from("teacher_attendance").update(payload).eq("id", selfRecord.id)
        : supabase.from("teacher_attendance").insert(payload);

      const { error: queryError } = await query;
      if (queryError) throw queryError;

      setSuccess("Check-in recorded.");
      await loadSelfAttendance();
    } catch (err) {
      setError(err.message || "Unable to record check-in.");
    } finally {
      setSaving(false);
    }
  };

  const checkOut = async () => {
    if (!selfRecord) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: queryError } = await supabase
        .from("teacher_attendance")
        .update({ check_out: getLagosTime() })
        .eq("id", selfRecord.id);

      if (queryError) throw queryError;

      setSuccess("Check-out recorded.");
      await loadSelfAttendance();
    } catch (err) {
      setError(err.message || "Unable to record check-out.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h1>Teacher Attendance</h1></div>
        <div className="page-card"><p>Loading attendance...</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Teacher Attendance</h1>
          <p style={{ color: "#64748b", marginTop: "6px" }}>
            Simple staff sign-in records and attendance summary.
          </p>
        </div>
      </div>

      {error && (
        <div className="page-card" style={{ borderLeft: "4px solid #dc2626", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {success && (
        <div className="page-card" style={{ borderLeft: "4px solid #16a34a", marginBottom: "16px" }}>
          {success}
        </div>
      )}

      {!canManage ? (
        <div className="page-card">
          <h2>My Attendance</h2>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "end", marginTop: "18px" }}>
            <label>
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{ display: "block", marginTop: "6px" }}
              />
            </label>

            <div>
              <strong>{selfRecord?.status || "Not signed in"}</strong>
              <div style={{ color: "#64748b", marginTop: "5px" }}>
                In: {formatTime(selfRecord?.check_in)} · Out: {formatTime(selfRecord?.check_out)}
              </div>
            </div>

            {!selfRecord ? (
              <button className="primary-btn" disabled={saving} onClick={checkIn}>
                {saving ? "Saving..." : "Check in"}
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
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  style={{ display: "block", marginTop: "6px" }}
                />
              </label>

              <label style={{ minWidth: "220px" }}>
                Staff
                <select
                  value={selectedStaff}
                  onChange={(event) => setSelectedStaff(event.target.value)}
                  style={{ display: "block", marginTop: "6px", width: "100%" }}
                >
                  {summary.map((row) => (
                    <option key={row.device_employee_no} value={row.device_employee_no}>
                      {row.device_staff_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="page-card">
            <h2>Monthly Summary</h2>
            <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
              {month} · 8:30 AM is the biometric punctuality cutoff.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>No Punch</th>
                    <th>Late Minutes</th>
                    <th>First In</th>
                    <th>Last In</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.device_employee_no}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedStaff(row.device_employee_no)}
                          style={{
                            border: 0,
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {row.device_staff_name}
                        </button>
                      </td>
                      <td>{row.present_days}</td>
                      <td>{row.late_days}</td>
                      <td>{row.no_punch_days}</td>
                      <td>{row.total_late_minutes}</td>
                      <td>{formatTime(row.earliest_signin)}</td>
                      <td>{formatTime(row.latest_signin)}</td>
                    </tr>
                  ))}
                  {!summary.length && (
                    <tr><td colSpan="7">No attendance summary for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedSummary && (
            <div className="page-card">
              <h2>{selectedSummary.device_staff_name}</h2>
              <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
                Daily sign-in details for {month}
              </p>

              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sign-in</th>
                      <th>Sign-out</th>
                      <th>Status</th>
                      <th>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDaily.map((row) => (
                      <tr key={row.attendance_date}>
                        <td>{formatDate(row.attendance_date)}</td>
                        <td>{formatTime(row.first_signin)}</td>
                        <td>{formatTime(row.last_signout)}</td>
                        <td>{row.status}</td>
                        <td>{row.late_minutes ? `${row.late_minutes} min` : "—"}</td>
                      </tr>
                    ))}
                    {!selectedDaily.length && (
                      <tr><td colSpan="5">No daily records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
