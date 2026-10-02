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

const getLateMinutes = (time) => {
  if (!time) return null;
  const parts = String(time).slice(0, 8).split(":").map(Number);
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const cutoff = LATE_CUTOFF.split(":").map(Number);
  return Math.max(0, (parts[0] * 60 + parts[1]) - (cutoff[0] * 60 + cutoff[1]));
};

const fullName = (teacher) =>
  [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ");

const getMonthString = (date = new Date()) => getDateString(date).slice(0, 7);

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\\s+/g, " ");

const findColumn = (row, aliases) => {
  const keys = Object.keys(row);
  const normalized = new Map(keys.map((key) => [normalizeHeader(key), key]));
  for (const alias of aliases) {
    const match = normalized.get(normalizeHeader(alias));
    if (match) return match;
  }
  return null;
};

const normalizeTime = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && value >= 0 && value < 1) {
    const totalSeconds = Math.round(value * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  }

  const text = String(value).trim();
  const match = text.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

const normalizeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: LAGOS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  if (typeof value === "number" && value > 20000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  let match = text.match(/^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})$/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  }

  match = text.match(/^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})$/);
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const parseClockTextFile = async (file) => {
  const text = await file.text();
  const lines = text.split(/\\r?\\n/).filter((line) => line.trim());
  const rows = lines.map((line) => line.split("\\t"));
  const hasRawGLogShape =
    rows.length > 1 &&
    rows.slice(1, Math.min(rows.length, 8)).some((row) =>
      /\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}\\s+\\d{1,2}:\\d{2}/.test(String(row[6] || ""))
    );

  if (hasRawGLogShape) {
    return rows.slice(1).map((row) => ({
      "Employee No": String(row[2] || "").trim(),
      "Teacher Name": String(row[3] || "").trim(),
      Date: String(row[6] || "").trim().slice(0, 10),
      "Check In": String(row[6] || "").trim().slice(11),
    }));
  }

  const headers = rows[0];
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))
  );
};

const parseClockFile = async (file) => {
  const lowerName = String(file.name || "").toLowerCase();
  if (lowerName.endsWith(".txt") || lowerName.endsWith(".dat")) {
    return parseClockTextFile(file);
  }
  if (!window.XLSX) {
    throw new Error("Spreadsheet importer is unavailable. Please refresh the app and try again.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The uploaded file has no readable worksheet.");

  return window.XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: true });
};

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
  const [clockFile, setClockFile] = useState(null);
  const [clockRows, setClockRows] = useState([]);
  const [clockPreview, setClockPreview] = useState(null);
  const [importing, setImporting] = useState(false);

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
      .select("id, teacher_id, teacher_name, attendance_date, status, check_in, check_out, late_minutes, note")
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
      .select("id, teacher_id, teacher_name, attendance_date, status, check_in, check_out, late_minutes, note")
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
      .select("teacher_id, status, attendance_date, check_in, check_out, late_minutes")
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
          lateMinutes: 0,
        };
      }
      next[record.teacher_id][record.status] =
        (next[record.teacher_id][record.status] || 0) + 1;
      next[record.teacher_id].total += 1;
      next[record.teacher_id].lateMinutes += Number(record.late_minutes || 0);
    }

    setSummary(next);
    setSummaryLoading(false);
  };


  const prepareClockRows = async (file) => {
    setError("");
    setSuccess("");
    setClockFile(file);
    setClockRows([]);
    setClockPreview(null);

    try {
      const rawRows = await parseClockFile(file);
      if (!rawRows.length) throw new Error("The file contains no attendance rows.");

      const sample = rawRows[0];
      const employeeColumn = findColumn(sample, ["Employee No", "Employee Number", "Employee ID", "Staff ID", "ID"]);
      const nameColumn = findColumn(sample, ["Teacher", "Teacher Name", "Employee Name", "Staff Name", "Name"]);
      const dateColumn = findColumn(sample, ["Attendance Date", "Date", "Punch Date", "Work Date"]);
      const checkInColumn = findColumn(sample, ["Check In", "Check-in", "Clock In", "Clock-in", "In Time", "Punch In", "Time"]);
      const checkOutColumn = findColumn(sample, ["Check Out", "Check-out", "Clock Out", "Clock-out", "Out Time", "Punch Out"]);

      if (!dateColumn || !checkInColumn || (!employeeColumn && !nameColumn)) {
        throw new Error(
          "Required columns are missing. Include Employee No (or Employee ID), Date, and Check In. Teacher Name can be used instead of Employee No."
        );
      }

      const teacherByEmployee = new Map(
        teachers
          .filter((teacher) => teacher.employee_no)
          .map((teacher) => [String(teacher.employee_no).trim().toLowerCase(), teacher])
      );
      const teacherByName = new Map(
        teachers.map((teacher) => [fullName(teacher).trim().toLowerCase(), teacher])
      );

      const valid = [];
      const errors = [];

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2;
        const employeeNo = employeeColumn ? String(row[employeeColumn] ?? "").trim() : "";
        const teacherName = nameColumn ? String(row[nameColumn] ?? "").trim() : "";
        const date = normalizeDate(row[dateColumn]);
        const checkIn = normalizeTime(row[checkInColumn]);
        const checkOut = checkOutColumn ? normalizeTime(row[checkOutColumn]) : null;

        const teacher =
          (employeeNo && teacherByEmployee.get(employeeNo.toLowerCase())) ||
          (teacherName && teacherByName.get(teacherName.toLowerCase()));

        if (!teacher) {
          errors.push(`Row ${rowNumber}: teacher could not be matched by employee number or exact name.`);
          return;
        }
        if (!date) {
          errors.push(`Row ${rowNumber}: invalid attendance date.`);
          return;
        }
        if (!checkIn) {
          errors.push(`Row ${rowNumber}: invalid or missing check-in time.`);
          return;
        }

        valid.push({
          teacher,
          date,
          checkIn,
          checkOut,
          status: isLate(checkIn) ? "Late" : "Present",
          lateMinutes: getLateMinutes(checkIn) || 0,
        });
      });

      const uniqueRows = [];
      const seen = new Set();
      for (const row of valid) {
        const key = `${row.teacher.id}|${row.date}`;
        if (seen.has(key)) {
          errors.push(`Duplicate attendance row for ${fullName(row.teacher)} on ${row.date}; only the first row was kept.`);
          continue;
        }
        seen.add(key);
        uniqueRows.push(row);
      }

      setClockRows(uniqueRows);
      setClockPreview({
        total: rawRows.length,
        valid: uniqueRows.length,
        errors,
        dates: [...new Set(uniqueRows.map((row) => row.date))].sort(),
        late: uniqueRows.filter((row) => row.status === "Late").length,
      });
    } catch (err) {
      setError(err.message || "Unable to read the clock-in file.");
    }
  };

  const importClockRows = async () => {
    if (!clockRows.length || !clockPreview) return;

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const dates = clockRows.map((row) => row.date).sort();
      const start = dates[0];
      const end = dates[dates.length - 1];
      const teacherIds = [...new Set(clockRows.map((row) => row.teacher.id))];

      const { data: existing, error: existingError } = await supabase
        .from("teacher_attendance")
        .select("id, teacher_id, attendance_date")
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .in("teacher_id", teacherIds);

      if (existingError) throw existingError;

      const existingMap = new Map(
        (existing || []).map((record) => [`${record.teacher_id}|${record.attendance_date}`, record.id])
      );

      const updates = [];
      const inserts = [];

      for (const row of clockRows) {
        const payload = {
          teacher_id: row.teacher.id,
          teacher_name: fullName(row.teacher),
          attendance_date: row.date,
          status: row.status,
          check_in: row.checkIn,
          check_out: null,
          late_minutes: row.lateMinutes,
          note: "Imported from clock-machine sign-in record",
          school_id: staff.school_id,
        };

        const existingId = existingMap.get(`${row.teacher.id}|${row.date}`);
        if (existingId) {
          updates.push({ id: existingId, payload });
        } else {
          inserts.push(payload);
        }
      }

      for (const item of updates) {
        const { error: updateError } = await supabase
          .from("teacher_attendance")
          .update(item.payload)
          .eq("id", item.id);
        if (updateError) throw updateError;
      }

      if (inserts.length) {
        const { error: insertError } = await supabase
          .from("teacher_attendance")
          .insert(inserts);
        if (insertError) throw insertError;
      }

      setSuccess(
        `Imported ${clockRows.length} clock-in record${clockRows.length === 1 ? "" : "s"} across ${clockPreview.dates.length} day${clockPreview.dates.length === 1 ? "" : "s"}. ${clockPreview.late} late arrival${clockPreview.late === 1 ? "" : "s"} detected.`
      );
      setClockFile(null);
      setClockRows([]);
      setClockPreview(null);
      await refresh();
    } catch (err) {
      console.error("CLOCK FILE IMPORT ERROR:", err);
      setError(err.message || "Unable to import clock-in records.");
    } finally {
      setImporting(false);
    }
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
        late_minutes: checkIn ?? existing?.check_in
          ? (isLate(checkIn ?? existing?.check_in) ? getLateMinutes(checkIn ?? existing?.check_in) : 0)
          : null,
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
            <h2>Import standalone clock-in</h2>
            <p style={{ color: "#64748b", margin: "6px 0 16px" }}>
              Upload the clock-machine Excel/CSV export or raw GLog text export. MEKA School uses the earliest sign-in for each teacher/day and stores punctuality, lateness and minutes late; no biometric information is imported.
            </p>

            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.dat"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) prepareClockRows(file);
                event.target.value = "";
              }}
              disabled={importing}
            />

            <p style={{ color: "#64748b", marginTop: "12px", fontSize: "13px" }}>
              For spreadsheets: <strong>Employee No</strong>, <strong>Date</strong>, <strong>Check In</strong>. Raw GLog <strong>.txt/.dat</strong> files are also supported. Teacher Name may be used instead of Employee No. The earliest punch of each teacher/day is used as sign-in.
            </p>

            {clockFile && clockPreview && (
              <div style={{ marginTop: "16px", padding: "14px", background: "#f8fafc", borderRadius: "10px" }}>
                <strong>{clockFile.name}</strong>
                <div style={{ color: "#475569", marginTop: "6px" }}>
                  {clockPreview.valid} valid · {clockPreview.errors.length} skipped · {clockPreview.dates.length} day(s) · {clockPreview.late} late
                </div>

                {clockPreview.errors.length > 0 && (
                  <div style={{ marginTop: "10px", color: "#b91c1c", fontSize: "13px", maxHeight: "120px", overflowY: "auto" }}>
                    {clockPreview.errors.slice(0, 10).map((message) => (
                      <div key={message}>{message}</div>
                    ))}
                    {clockPreview.errors.length > 10 && (
                      <div>…and {clockPreview.errors.length - 10} more skipped rows.</div>
                    )}
                  </div>
                )}

                <button
                  className="primary-btn"
                  disabled={importing || !clockRows.length}
                  onClick={importClockRows}
                  style={{ marginTop: "12px" }}
                >
                  {importing ? "Importing..." : `Import ${clockRows.length} record${clockRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            )}
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
                    <th>Sign-in</th>
                    <th>Punctuality</th>
                    <th>Minutes late</th>
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
                        <td>{record?.status === "Late" ? "Late" : record?.status === "Present" ? "Punctual" : "-"}</td>
                        <td>{record?.status === "Late" ? (record?.late_minutes ?? 0) + " min" : "-"}</td>
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
                    <tr><td colSpan="7">No active teachers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-card">
            <h2>Monthly attendance summary</h2>
            <p style={{ color: "#64748b", margin: "6px 0 18px" }}>
              {selectedMonth} · Punctuality is based on the 8:00 AM cutoff. Total minutes late is the payroll-ready figure for salary-deduction rules.
            </p>

            {summaryLoading ? (
              <p>Loading monthly summary...</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Punctual</th>
                      <th>Late days</th>
                      <th>Total minutes late</th>
                      <th>Absent</th>
                      <th>Excused</th>
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
