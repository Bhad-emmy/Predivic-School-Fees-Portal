import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const LAGOS_TIME_ZONE = "Africa/Lagos";
const LATE_CUTOFF = "07:20";
const WORK_END = "17:30";

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
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "—";

const isLate = (time) => Boolean(time && String(time).slice(0, 5) > LATE_CUTOFF);

const getEarlyMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  const [endH, endM] = WORK_END.split(":").map(Number);
  return Math.max(0, endH * 60 + endM - (h * 60 + m));
};

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

  const exportReport = () => {
    const staffName = selectedSummary?.device_staff_name || "Staff";
    const rows = selectedDaily.map((row) => `
      <tr>
        <td>${formatDate(row.attendance_date)}</td>
        <td>${formatTime(row.first_signin)}</td>
        <td>${formatTime(row.last_signout)}</td>
        <td>${row.status}</td>
        <td>${row.late_minutes ? `${row.late_minutes} min` : "—"}</td>
        <td>${row.early_departure ? `${row.early_minutes} min` : "—"}</td>
      </tr>`).join("");

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setError("Allow pop-ups to export the report.");
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Predivic Staff Attendance - ${staffName} - ${month}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            h1 { margin-bottom: 4px; }
            p { color: #64748b; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 24px 0; }
            .box { border: 1px solid #e5e7eb; padding: 14px; border-radius: 8px; }
            .label { color: #64748b; font-size: 12px; }
            .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 9px; text-align: left; }
            th { background: #f8fafc; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Predivic Schools</h1>
          <h2>Staff Attendance Report</h2>
          <p>${staffName} · ${month} · Arrival deadline: 7:20 AM · Scheduled closing: 5:30 PM</p>
          <div class="summary">
            <div class="box"><div class="label">Present</div><div class="value">${selectedSummary?.present_days ?? 0}</div></div>
            <div class="box"><div class="label">Late</div><div class="value">${selectedSummary?.late_days ?? 0}</div></div>
            <div class="box"><div class="label">No Punch</div><div class="value">${selectedSummary?.no_punch_days ?? 0}</div></div>
            <div class="box"><div class="label">Late Minutes</div><div class="value">${selectedSummary?.total_late_minutes ?? 0}</div></div><div class="box"><div class="label">Early Minutes</div><div class="value">${selectedSummary?.total_early_minutes ?? 0}</div></div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Sign-in</th><th>Sign-out</th><th>Status</th><th>Late</th><th>Early</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6">No daily records.</td></tr>'}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

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
            "device_employee_no, device_staff_name, attendance_date, first_signin, last_signout, status, late_minutes, early_minutes, early_departure"
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
              {month} · 7:20 AM is the arrival deadline · 5:30 PM is the scheduled closing time.
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
                    <th>Early Minutes</th>
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
                      <td>{row.total_early_minutes}</td>
                      <td>{formatTime(row.earliest_signin)}</td>
                      <td>{formatTime(row.latest_signin)}</td>
                    </tr>
                  ))}
                  {!summary.length && (
                    <tr><td colSpan="8">No attendance summary for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedSummary && (
            <div className="page-card">
              <h2>{selectedSummary.device_staff_name}</h2>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
                  Daily sign-in details for {month}
                </p>
                <button type="button" className="primary-btn" onClick={exportReport}>
                  Download PDF
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sign-in</th>
                      <th>Sign-out</th>
                      <th>Status</th>
                      <th>Late</th>
                      <th>Early</th>
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
                        <td>{row.early_departure ? `${row.early_minutes} min` : "—"}</td>
                      </tr>
                    ))}
                    {!selectedDaily.length && (
                      <tr><td colSpan="6">No daily records.</td></tr>
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
