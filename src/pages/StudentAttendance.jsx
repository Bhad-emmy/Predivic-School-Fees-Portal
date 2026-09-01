import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const SCHOOL_CLASS_ORDER = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

const getDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonday = (date) => {
  const result = new Date(date);
  const day = result.getDay();

  result.setDate(
    result.getDate() + (day === 0 ? -6 : 1 - day)
  );

  result.setHours(0, 0, 0, 0);

  return result;
};

const getWeekDates = (date) => {
  const monday = getMonday(date);

  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);

    return day;
  });
};

const getExpectedWeekdayCount = (dates, term, referenceDate = new Date()) => {
  if (!term) return 0;

  const todayString = getDateString(referenceDate);

  return dates.filter((date) => {
    const dateString = getDateString(date);
    const day = date.getDay();

    if (day === 0 || day === 6) return false;
    if (term.starts_on && dateString < term.starts_on) return false;
    if (term.ends_on && dateString > term.ends_on) return false;

    // Do not count future school days in the current week.
    if (dateString > todayString) return false;

    return true;
  }).length;
};

const isExcludedDate = (dateString, exclusions) => {
  return (exclusions || []).some((item) =>
    dateString >= item.start_date && dateString <= item.end_date
  );
};

const getExpectedSchoolDays = (startDateString, endDateString, exclusions = []) => {
  if (!startDateString || !endDateString || startDateString > endDateString) {
    return 0;
  }

  const start = new Date(`${startDateString}T00:00:00`);
  const end = new Date(`${endDateString}T00:00:00`);
  let count = 0;

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    const dateString = getDateString(cursor);

    if (day === 0 || day === 6) continue;
    if (isExcludedDate(dateString, exclusions)) continue;

    count++;
  }

  return count;
};

const formatDate = (date) => {
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
};

const formatLongDate = (date) => {
  return date.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function StudentAttendance() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [academicSession, setAcademicSession] =
    useState(null);

  const [activeTerm, setActiveTerm] =
    useState(null);

  const [selectedClass, setSelectedClass] =
    useState("");

  const [attendanceDate, setAttendanceDate] =
    useState(getDateString(new Date()));

  const [weekDate, setWeekDate] =
    useState(getDateString(new Date()));

  const [attendance, setAttendance] =
    useState({});

  // Attendance already saved for this date is locked.
  // This prevents changing Present to Absent (or vice versa)
  // after the daily record has been submitted.
  const [lockedAttendance, setLockedAttendance] =
    useState({});

  const [weeklyRecords, setWeeklyRecords] =
    useState({});

  const [schoolCalendarExclusions, setSchoolCalendarExclusions] =
    useState([]);

  const [termRecords, setTermRecords] =
    useState({});

  const [weeklyExpectedDays, setWeeklyAttendanceDays] =
    useState(0);

  const [termAttendanceDays, setTermAttendanceDays] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [loadingWeekly, setLoadingWeekly] =
    useState(false);

  const [loadingTerm, setLoadingTerm] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const { isAdmin } = useAuth();

  // Saved attendance can only be changed through the admin
  // override flow, which records an audit entry in Supabase.
  const [attendanceRecordIds, setAttendanceRecordIds] =
    useState({});

  const [overrideTarget, setOverrideTarget] =
    useState(null);

  const [overrideStatus, setOverrideStatus] =
    useState("Present");

  const [overrideReason, setOverrideReason] =
    useState("");

  const [overriding, setOverriding] =
    useState(false);

  // =========================================================
  // ACADEMIC SESSION + ACTIVE TERM
  // =========================================================

  const fetchAcademicContext = async () => {
    try {
      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from("academic_sessions")
        .select(
          "id, name, is_active"
        )
        .eq("is_active", true)
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        setAcademicSession(null);
        setActiveTerm(null);

        throw new Error(
          "There is no active academic session."
        );
      }

      setAcademicSession(session);

      const {
        data: term,
        error: termError,
      } = await supabase
        .from("terms")
        .select(`
          id,
          academic_session_id,
          name,
          status,
          starts_on,
          ends_on,
          started_at,
          closed_at
        `)
        .eq(
          "academic_session_id",
          session.id
        )
        .eq("status", "active")
        .maybeSingle();

      if (termError) {
        throw termError;
      }

      if (!term) {
        setActiveTerm(null);

        throw new Error(
          "There is no active academic term."
        );
      }

      setActiveTerm(term);

      // Put the attendance date inside the active term
      // when possible.
      if (term.starts_on) {
        const today = new Date();
        const todayString =
          getDateString(today);

        if (
          todayString <
          term.starts_on
        ) {
          setAttendanceDate(
            term.starts_on
          );

          setWeekDate(
            term.starts_on
          );
        }
      }
    } catch (err) {
      console.error(
        "ACADEMIC CONTEXT ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load academic session."
      );
    }
  };

  // =========================================================
  // CLASSES
  // =========================================================

  const fetchClasses = async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("classes")
        .select(
          "id, name, display_order"
        );

      if (error) {
        throw error;
      }

      const sortedClasses =
        [...(data || [])].sort(
          (a, b) => {
            const orderA =
              SCHOOL_CLASS_ORDER.indexOf(
                a.name
              );

            const orderB =
              SCHOOL_CLASS_ORDER.indexOf(
                b.name
              );

            if (
              orderA !== -1 &&
              orderB !== -1
            ) {
              return (
                orderA - orderB
              );
            }

            if (
              orderA !== -1
            ) {
              return -1;
            }

            if (
              orderB !== -1
            ) {
              return 1;
            }

            return (
              (a.display_order ??
                999) -
              (b.display_order ??
                999)
            );
          }
        );

      setClasses(
        sortedClasses
      );
    } catch (err) {
      console.error(
        "CLASS LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load classes."
      );
    }
  };

  // =========================================================
  // STUDENTS
  // =========================================================

  const fetchStudents = async (
    sessionId,
    termId
  ) => {
    try {
      if (
        !sessionId ||
        !termId
      ) {
        setStudents([]);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("student_enrollments")
        .select(`
          id,
          student_id,
          session_id,
          term_id,
          class_id,
          status,
          students (
            id,
            admission_no,
            first_name,
            last_name,
            status,
            student_type
          ),
          classes (
            id,
            name
          )
        `)
        .eq(
          "session_id",
          sessionId
        )
        .eq(
          "term_id",
          termId
        )
        .eq(
          "status",
          "active"
        );

      if (error) {
        throw error;
      }

      const formattedStudents =
        (data || [])
          .filter(
            (enrollment) =>
              enrollment.students
          )
          .map(
            (enrollment) => ({
              enrollmentId:
                enrollment.id,

              id:
                enrollment
                  .students
                  .id,

              studentNumber:
                enrollment
                  .students
                  .admission_no,

              firstName:
                enrollment
                  .students
                  .first_name,

              lastName:
                enrollment
                  .students
                  .last_name,

              fullName: [
                enrollment
                  .students
                  .first_name,
                enrollment
                  .students
                  .last_name,
              ]
                .filter(Boolean)
                .join(" "),

              studentType:
                enrollment
                  .students
                  .student_type,

              classId:
                enrollment.class_id,

              className:
                enrollment
                  .classes
                  ?.name || "",
            })
          );

      setStudents(
        formattedStudents
      );
    } catch (err) {
      console.error(
        "STUDENT LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load enrolled students."
      );
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    const initialize =
      async () => {
        setLoading(true);
        setError("");

        await Promise.all([
          fetchAcademicContext(),
          fetchClasses(),
        ]);

        setLoading(false);
      };

    initialize();
  }, []);

  // =========================================================
  // LOAD STUDENTS AFTER SESSION + TERM
  // =========================================================

  useEffect(() => {
    if (
      !academicSession ||
      !activeTerm
    ) {
      setStudents([]);
      return;
    }

    fetchStudents(
      academicSession.id,
      activeTerm.id
    );
  }, [
    academicSession,
    activeTerm,
  ]);

  // =========================================================
  // SELECTED CLASS STUDENTS
  // =========================================================

  const classStudents =
    useMemo(() => {
      return students.filter(
        (student) =>
          student.classId ===
          selectedClass
      );
    }, [
      students,
      selectedClass,
    ]);

  // =========================================================
  // WEEK
  // =========================================================

  const weekDates =
    useMemo(() => {
      return getWeekDates(
        new Date(
          `${weekDate}T00:00:00`
        )
      );
    }, [weekDate]);

  // =========================================================
  // CHECK DATE IS IN ACTIVE TERM
  // =========================================================

  const isDateWithinActiveTerm =
    (dateString) => {
      if (!activeTerm) {
        return false;
      }

      if (
        activeTerm.starts_on &&
        dateString <
          activeTerm.starts_on
      ) {
        return false;
      }

      if (
        activeTerm.ends_on &&
        dateString >
          activeTerm.ends_on
      ) {
        return false;
      }

      return true;
    };

  // =========================================================
  // LOAD EXISTING ATTENDANCE FOR SELECTED DATE
  // =========================================================

  const fetchDailyAttendance =
    async () => {
      if (
        !selectedClass ||
        !academicSession ||
        !activeTerm ||
        classStudents.length === 0
      ) {
        setAttendance({});
        setLockedAttendance({});
        setAttendanceRecordIds({});
        return;
      }

      try {
        const studentIds =
          classStudents.map(
            (student) =>
              student.id
          );

        const {
          data,
          error,
        } = await supabase
          .from(
            "student_attendance"
          )
          .select(`
            student_id,
            enrollment_id,
            class_id,
            session_id,
            term_id,
            attendance_date,
            status
          `)
          .in(
            "student_id",
            studentIds
          )
          .eq(
            "class_id",
            selectedClass
          )
          .eq(
            "session_id",
            academicSession.id
          )
          .eq(
            "term_id",
            activeTerm.id
          )
          .eq(
            "attendance_date",
            attendanceDate
          );

        if (error) {
          throw error;
        }

        const existing = {};
        const locked = {};
        const recordIds = {};

        (data || []).forEach(
          (record) => {
            existing[record.student_id] =
              record.status;

            locked[record.student_id] = true;
            recordIds[record.student_id] = record.id;
          }
        );

        setAttendance(existing);
        setLockedAttendance(locked);
        setAttendanceRecordIds(recordIds);
      } catch (err) {
        console.error(
          "DAILY ATTENDANCE LOAD ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to load daily attendance."
        );
      }
    };

  useEffect(() => {
    fetchDailyAttendance();
  }, [
    selectedClass,
    attendanceDate,
    academicSession,
    activeTerm,
    classStudents.length,
  ]);

  // =========================================================
  // LOAD SCHOOL CALENDAR EXCLUSIONS
  // =========================================================

  const fetchSchoolCalendarExclusions = async () => {
    if (!academicSession || !activeTerm) {
      setSchoolCalendarExclusions([]);
      return;
    }

    try {
      let query = supabase
        .from("school_calendar_exclusions")
        .select("id, session_id, term_id, start_date, end_date, exclusion_type, reason")
        .eq("session_id", academicSession.id);

      if (activeTerm.id) {
        query = query.or(`term_id.is.null,term_id.eq.${activeTerm.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSchoolCalendarExclusions(data || []);
    } catch (err) {
      console.error("SCHOOL CALENDAR LOAD ERROR:", err);
      setSchoolCalendarExclusions([]);
    }
  };

  useEffect(() => {
    fetchSchoolCalendarExclusions();
  }, [academicSession, activeTerm]);

  // =========================================================
  // LOAD WEEKLY ATTENDANCE
  // =========================================================

  const fetchWeeklyAttendance =
    async () => {
      if (
        !selectedClass ||
        !academicSession ||
        !activeTerm ||
        classStudents.length === 0
      ) {
        setWeeklyRecords({});
        setWeeklyAttendanceDays(0);
        return;
      }

      try {
        setLoadingWeekly(true);

        const startDate =
          getDateString(
            weekDates[0]
          );

        const endDate =
          getDateString(
            weekDates[4]
          );

        const studentIds =
          classStudents.map(
            (student) =>
              student.id
          );

        const {
          data,
          error,
        } = await supabase
          .from(
            "student_attendance"
          )
          .select(`
            student_id,
            attendance_date,
            status
          `)
          .in(
            "student_id",
            studentIds
          )
          .eq(
            "class_id",
            selectedClass
          )
          .eq(
            "session_id",
            academicSession.id
          )
          .eq(
            "term_id",
            activeTerm.id
          )
          .gte(
            "attendance_date",
            startDate
          )
          .lte(
            "attendance_date",
            endDate
          );

        if (error) {
          throw error;
        }

        const records =
          {};

        (data || []).forEach(
          (record) => {
            if (isExcludedDate(record.attendance_date, schoolCalendarExclusions)) {
              return;
            }

            if (
              !records[
                record.student_id
              ]
            ) {
              records[
                record.student_id
              ] = {};
            }

            records[
              record.student_id
            ][
              record.attendance_date
            ] =
              record.status;
          }
        );

        // Percentage denominator is expected Monday-Friday
        // school days, excluding configured holidays/breaks.
        const expectedDays = weekDates.filter((date) => {
          const dateString = getDateString(date);
          const day = date.getDay();

          if (day === 0 || day === 6) return false;
          if (activeTerm.starts_on && dateString < activeTerm.starts_on) return false;
          if (activeTerm.ends_on && dateString > activeTerm.ends_on) return false;
          if (dateString > getDateString(new Date())) return false;
          if (isExcludedDate(dateString, schoolCalendarExclusions)) return false;

          return true;
        }).length;

        setWeeklyRecords(
          records
        );

        setWeeklyExpectedDays(
          expectedDays
        );

      } catch (err) {
        console.error(
          "WEEKLY ATTENDANCE ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to load weekly attendance."
        );
      } finally {
        setLoadingWeekly(false);
      }
    };

  useEffect(() => {
    fetchWeeklyAttendance();
  }, [
    selectedClass,
    weekDate,
    academicSession,
    activeTerm,
    schoolCalendarExclusions,
    classStudents.length,
  ]);

  // =========================================================
  // TERM ATTENDANCE
  // =========================================================

  const fetchTermAttendance =
    async () => {
      if (
        !selectedClass ||
        !academicSession ||
        !activeTerm ||
        classStudents.length === 0
      ) {
        setTermRecords({});
        setTermAttendanceDays(0);
        return;
      }

      try {
        setLoadingTerm(true);

        const studentIds =
          classStudents.map(
            (student) =>
              student.id
          );

        let query =
          supabase
            .from(
              "student_attendance"
            )
            .select(`
              student_id,
              attendance_date,
              status
            `)
            .in(
              "student_id",
              studentIds
            )
            .eq(
              "class_id",
              selectedClass
            )
            .eq(
              "session_id",
              academicSession.id
            )
            .eq(
              "term_id",
              activeTerm.id
            );

        if (
          activeTerm.starts_on
        ) {
          query =
            query.gte(
              "attendance_date",
              activeTerm.starts_on
            );
        }

        if (
          activeTerm.ends_on
        ) {
          query =
            query.lte(
              "attendance_date",
              activeTerm.ends_on
            );
        }

        const {
          data,
          error,
        } = await query;

        if (error) {
          throw error;
        }

        const records =
          {};

        const attendanceDates =
          new Set();

        (data || []).forEach(
          (record) => {
            if (isExcludedDate(record.attendance_date, schoolCalendarExclusions)) {
              return;
            }

            if (
              !records[
                record.student_id
              ]
            ) {
              records[
                record.student_id
              ] = [];
            }

            records[
              record.student_id
            ].push(record);

            attendanceDates.add(
              record.attendance_date
            );
          }
        );

        setTermRecords(
          records
        );

        const todayString = getDateString(new Date());
        const termEndForCalculation =
          activeTerm.ends_on && activeTerm.ends_on < todayString
            ? activeTerm.ends_on
            : todayString;

        const expectedTermDays = getExpectedSchoolDays(
          activeTerm.starts_on,
          termEndForCalculation,
          schoolCalendarExclusions
        );

        setTermAttendanceDays(
          expectedTermDays
        );
      } catch (err) {
        console.error(
          "TERM ATTENDANCE ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to load term attendance."
        );
      } finally {
        setLoadingTerm(false);
      }
    };

  useEffect(() => {
    fetchTermAttendance();
  }, [
    selectedClass,
    academicSession,
    activeTerm,
    schoolCalendarExclusions,
    classStudents.length,
  ]);

  // =========================================================
  // ATTENDANCE ACTIONS
  // =========================================================

  const markAttendance = (
    studentId,
    status
  ) => {
    // Once a daily record has been saved, it is locked.
    if (lockedAttendance[studentId]) {
      return;
    }

    setAttendance(
      (current) => ({
        ...current,
        [studentId]: status,
      })
    );
  };

  const markAllPresent =
    () => {
      const updated = {
        ...attendance,
      };

      classStudents.forEach(
        (student) => {
          if (!lockedAttendance[student.id]) {
            updated[student.id] = "Present";
          }
        }
      );

      setAttendance(updated);
    };

  const resetAttendance =
    () => {
      setAttendance({});
      setSuccess("");
      setError("");
    };

  // =========================================================
  // SAVE ATTENDANCE
  // =========================================================

  const handleSaveAttendance =
    async () => {
      if (
        !academicSession ||
        !activeTerm
      ) {
        alert(
          "Attendance cannot be recorded because there is no active term."
        );
        return;
      }

      if (!selectedClass) {
        alert(
          "Please select a class."
        );
        return;
      }

      if (
        !isDateWithinActiveTerm(
          attendanceDate
        )
      ) {
        alert(
          "The selected date is outside the active academic term."
        );
        return;
      }

      if (
        classStudents.length ===
        0
      ) {
        alert(
          "There are no students enrolled in this class."
        );
        return;
      }

      const unmarked =
        classStudents.filter(
          (student) =>
            !attendance[
              student.id
            ]
        );

      if (
        unmarked.length > 0
      ) {
        alert(
          `Please mark attendance for all ${unmarked.length} remaining student(s).`
        );
        return;
      }

      const studentsToSave =
        classStudents.filter(
          (student) =>
            !lockedAttendance[student.id]
        );

      if (studentsToSave.length === 0) {
        setSuccess(
          "Attendance for this date has already been saved. Saved records are locked."
        );
        return;
      }

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const records =
          studentsToSave.map(
            (student) => ({
              student_id:
                student.id,

              enrollment_id:
                student.enrollmentId,

              class_id:
                student.classId,

              session_id:
                academicSession.id,

              term_id:
                activeTerm.id,

              attendance_date:
                attendanceDate,

              status:
                attendance[
                  student.id
                ],
            })
          );

        const {
          error,
        } = await supabase
          .from(
            "student_attendance"
          )
          .upsert(
            records,
            {
              onConflict:
                "student_id,session_id,term_id,attendance_date",
            }
          );

        if (error) {
          throw error;
        }

        setSuccess(
          `Attendance for ${formatLongDate(
            new Date(
              `${attendanceDate}T00:00:00`
            )
          )} saved successfully.`
        );

        await Promise.all([
          fetchDailyAttendance(),
          fetchWeeklyAttendance(),
          fetchTermAttendance(),
        ]);
      } catch (err) {
        console.error(
          "SAVE ATTENDANCE ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to save attendance."
        );
      } finally {
        setSaving(false);
      }
    };

  // =========================================================
  // ADMIN ATTENDANCE OVERRIDE
  // =========================================================

  const openOverride = (student) => {
    const attendanceId = attendanceRecordIds[student.id];

    if (!attendanceId) {
      setError(
        "Unable to locate the saved attendance record for override."
      );
      return;
    }

    setOverrideTarget({
      attendanceId,
      studentName:
        student.fullName ||
        student.studentNumber ||
        "this student",
      currentStatus: attendance[student.id],
    });

    setOverrideStatus(
      attendance[student.id] === "Present"
        ? "Absent"
        : "Present"
    );

    setOverrideReason("");
    setError("");
  };

  const handleOverrideAttendance = async () => {
    if (!overrideTarget) return;

    if (!overrideReason.trim()) {
      setError("An override reason is required.");
      return;
    }

    if (overrideStatus === overrideTarget.currentStatus) {
      setError("Choose a different attendance status.");
      return;
    }

    const confirmed = window.confirm(
      `Override ${overrideTarget.studentName}'s attendance from ${overrideTarget.currentStatus} to ${overrideStatus}?`
    );

    if (!confirmed) return;

    try {
      setOverriding(true);
      setError("");
      setSuccess("");

      const { error: overrideError } =
        await supabase.rpc(
          "override_student_attendance",
          {
            p_attendance_id:
              overrideTarget.attendanceId,
            p_new_status:
              overrideStatus,
            p_reason:
              overrideReason.trim(),
          }
        );

      if (overrideError) {
        throw overrideError;
      }

      setOverrideTarget(null);
      setOverrideReason("");

      setSuccess(
        "Attendance override saved and recorded in the audit log."
      );

      await Promise.all([
        fetchDailyAttendance(),
        fetchWeeklyAttendance(),
        fetchTermAttendance(),
      ]);
    } catch (err) {
      console.error(
        "ATTENDANCE OVERRIDE ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to save the attendance override."
      );
    } finally {
      setOverriding(false);
    }
  };

  // =========================================================
  // WEEKLY STATS
  // =========================================================

  const getWeeklyStats =
    (studentId) => {
      const records =
        weeklyRecords[
          studentId
        ] || {};

      let presentDays = 0;
      let absentDays = 0;

      Object.values(records).forEach(
        (status) => {
          if (
            status ===
            "Present"
          ) {
            presentDays++;
          }

          if (
            status ===
            "Absent"
          ) {
            absentDays++;
          }
        }
      );

      const percentage =
        weeklyExpectedDays >
        0
          ? Math.round(
              (presentDays /
                weeklyExpectedDays) *
                100
            )
          : 0;

      return {
        presentDays,
        absentDays,
        percentage,
      };
    };

  // =========================================================
  // TERMLY STATS
  // =========================================================

  const getTermStats =
    (studentId) => {
      const records =
        termRecords[
          studentId
        ] || [];

      const presentDays =
        records.filter(
          (record) =>
            record.status ===
            "Present"
        ).length;

      const absentDays =
        records.filter(
          (record) =>
            record.status ===
            "Absent"
        ).length;

      const percentage =
        termAttendanceDays >
        0
          ? Math.round(
              (presentDays /
                termAttendanceDays) *
                100
            )
          : 0;

      return {
        presentDays,
        absentDays,
        percentage,
      };
    };

  // =========================================================
  // DAILY COUNTS
  // =========================================================

  const presentCount =
    classStudents.filter(
      (student) =>
        attendance[
          student.id
        ] === "Present"
    ).length;

  const absentCount =
    classStudents.filter(
      (student) =>
        attendance[
          student.id
        ] === "Absent"
    ).length;

  const unmarkedCount =
    classStudents.length -
    presentCount -
    absentCount;

  // =========================================================
  // SELECTED CLASS NAME
  // =========================================================

  const selectedClassName =
    classes.find(
      (item) =>
        item.id ===
        selectedClass
    )?.name || "";

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="page" style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
        <h1>
          Student Attendance
        </h1>

        <p>
          Loading attendance system...
        </p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="page">

      {/* HEADER */}

      <div className="page-header">
        <div>
          <h1>
            Student Attendance
          </h1>

          <p
            style={{
              color:
                "#64748b",
              marginTop:
                "6px",
            }}
          >
            Record daily attendance
            and monitor weekly and
            termly attendance
            percentages.
          </p>
        </div>
      </div>

      {/* ACADEMIC CONTEXT */}

      <div
        className="page-card"
        style={{
          marginBottom:
            "20px",
        }}
      >
        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <label
              style={{
                display:
                  "block",
                marginBottom:
                  "8px",
                fontWeight:
                  "600",
              }}
            >
              Academic Session
            </label>

            <div
              style={{
                padding:
                  "12px 16px",
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius:
                  "8px",
              }}
            >
              {academicSession?.name ||
                "No active session"}
            </div>
          </div>

          <div>
            <label
              style={{
                display:
                  "block",
                marginBottom:
                  "8px",
                fontWeight:
                  "600",
              }}
            >
              Current Term
            </label>

            <div
              style={{
                padding:
                  "12px 16px",
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius:
                  "8px",
              }}
            >
              {activeTerm?.name ||
                "No active term"}
            </div>
          </div>
        </div>

        <p
          style={{
            marginTop:
              "12px",
            color:
              "#64748b",
            fontSize:
              "13px",
          }}
        >
          Attendance is stored against
          the student's class,
          enrollment, session and
          term at the time it is
          recorded.
        </p>
      </div>

      {/* ERROR */}

      {error && (
        <div
          style={{
            background:
              "#fee2e2",
            color:
              "#991b1b",
            padding:
              "12px 15px",
            borderRadius:
              "8px",
            marginBottom:
              "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div
          style={{
            background:
              "#dcfce7",
            color:
              "#166534",
            padding:
              "12px 15px",
            borderRadius:
              "8px",
            marginBottom:
              "20px",
          }}
        >
          {success}
        </div>
      )}

      {/* DAILY CONTROLS */}

      <div
        className="page-card"
        style={{
          marginBottom:
            "20px",
        }}
      >
        <h2
          style={{
            marginBottom:
              "20px",
          }}
        >
          Daily Attendance
        </h2>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <label
              style={{
                display:
                  "block",
                marginBottom:
                  "8px",
                fontWeight:
                  "600",
              }}
            >
              Attendance Date
            </label>

            <input
              type="date"
              value={
                attendanceDate
              }
              min={
                activeTerm?.starts_on ||
                undefined
              }
              max={
                activeTerm?.ends_on ||
                undefined
              }
              onChange={(e) => {
                setAttendanceDate(
                  e.target.value
                );
                setSuccess("");
              }}
              className="search-input"
            />
          </div>

          <div>
            <label
              style={{
                display:
                  "block",
                marginBottom:
                  "8px",
                fontWeight:
                  "600",
              }}
            >
              Class
            </label>

            <select
              value={
                selectedClass
              }
              onChange={(e) => {
                setSelectedClass(
                  e.target.value
                );

                setAttendance(
                  { }
                );

                setSuccess("");
              }}
              className="filter-select"
              style={{
                width:
                  "100%",
              }}
            >
              <option value="">
                Select Class
              </option>

              {classes.map(
                (classItem) => (
                  <option
                    key={
                      classItem.id
                    }
                    value={
                      classItem.id
                    }
                  >
                    {
                      classItem.name
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* DAILY TABLE */}

      {selectedClass && (
        <div
          className="page-card"
          style={{
            marginBottom:
              "25px",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "20px",
              flexWrap:
                "wrap",
              gap: "15px",
            }}
          >
            <div>
              <h2>
                {
                  selectedClassName
                }
              </h2>

              <p
                style={{
                  color:
                    "#64748b",
                  marginTop:
                    "5px",
                }}
              >
                {
                  classStudents.length
                }{" "}
                enrolled
                student(s)
              </p>
            </div>

            <div
              style={{
                display:
                  "flex",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={
                  markAllPresent
                }
                disabled={
                  classStudents.length ===
                  0
                }
              >
                Mark All Present
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={
                  resetAttendance
                }
                style={{
                  background:
                    "#64748b",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* COUNTS */}

          <div
            style={{
              display:
                "flex",
              gap: "15px",
              marginBottom:
                "20px",
              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                background:
                  "#f0fdf4",
                padding:
                  "12px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <strong>
                Present:
              </strong>{" "}
              {presentCount}
            </div>

            <div
              style={{
                background:
                  "#fef2f2",
                padding:
                  "12px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <strong>
                Absent:
              </strong>{" "}
              {absentCount}
            </div>

            <div
              style={{
                background:
                  "#f8fafc",
                padding:
                  "12px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <strong>
                Unmarked:
              </strong>{" "}
              {unmarkedCount}
            </div>

            <div
              style={{
                background:
                  "#f8fafc",
                padding:
                  "12px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <strong>
                Total:
              </strong>{" "}
              {
                classStudents.length
              }
            </div>
          </div>

          {classStudents.length > 0 ? (
            <>
              <div
                style={{
                  marginBottom: "10px",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                Swipe left on the attendance table to reach Absent.
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  overflowX: "auto",
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-x",
                  overscrollBehaviorX: "contain",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                }}
              >
                <div style={{ minWidth: "760px" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: "760px",
                      tableLayout: "auto",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            minWidth: "160px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Student Number
                        </th>

                        <th
                          style={{
                            minWidth: "240px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Student Name
                        </th>

                        <th
                          style={{
                            minWidth: "330px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Attendance
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {classStudents.map((student) => {
                        const isLocked =
                          !!lockedAttendance[student.id];

                        return (
                          <tr key={student.id}>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {student.studentNumber || "—"}
                            </td>

                            <td style={{ minWidth: "240px" }}>
                              {student.fullName || "—"}
                            </td>

                            <td style={{ minWidth: "330px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  flexWrap: "nowrap",
                                  whiteSpace: "nowrap",
                                  minWidth: "fit-content",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    markAttendance(
                                      student.id,
                                      "Present"
                                    )
                                  }
                                  disabled={isLocked}
                                  title={
                                    isLocked
                                      ? "Attendance already saved for this date"
                                      : "Mark Present"
                                  }
                                  style={{
                                    flexShrink: 0,
                                    minWidth: "95px",
                                    padding: "10px 14px",
                                    borderRadius: "6px",
                                    cursor: isLocked
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isLocked ? 0.65 : 1,
                                    border:
                                      attendance[student.id] ===
                                      "Present"
                                        ? "2px solid #166534"
                                        : "1px solid #d1d5db",
                                    background:
                                      attendance[student.id] ===
                                      "Present"
                                        ? "#dcfce7"
                                        : "#fff",
                                    color: "#166534",
                                    fontWeight: "600",
                                  }}
                                >
                                  Present
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    markAttendance(
                                      student.id,
                                      "Absent"
                                    )
                                  }
                                  disabled={isLocked}
                                  title={
                                    isLocked
                                      ? "Attendance already saved for this date"
                                      : "Mark Absent"
                                  }
                                  style={{
                                    flexShrink: 0,
                                    minWidth: "95px",
                                    padding: "10px 14px",
                                    borderRadius: "6px",
                                    cursor: isLocked
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isLocked ? 0.65 : 1,
                                    border:
                                      attendance[student.id] ===
                                      "Absent"
                                        ? "2px solid #991b1b"
                                        : "1px solid #d1d5db",
                                    background:
                                      attendance[student.id] ===
                                      "Absent"
                                        ? "#fee2e2"
                                        : "#fff",
                                    color: "#991b1b",
                                    fontWeight: "600",
                                  }}
                                >
                                  Absent
                                </button>

                                {isLocked && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "7px",
                                      flexShrink: 0,
                                      fontSize: "11px",
                                      color: "#64748b",
                                    }}
                                  >
                                    <span>Saved</span>

                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openOverride(student)
                                        }
                                        style={{
                                          padding: "4px 8px",
                                          border:
                                            "1px solid #94a3b8",
                                          borderRadius: "4px",
                                          background: "#fff",
                                          color: "#334155",
                                          cursor: "pointer",
                                          fontSize: "11px",
                                        }}
                                      >
                                        Override
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign:
                  "center",
                padding:
                  "40px",
                color:
                  "#64748b",
              }}
            >
              No students are
              currently enrolled in
              this class.
            </div>
          )}

          {classStudents.length >
            0 && (
            <div
              style={{
                marginTop:
                  "25px",
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={
                  handleSaveAttendance
                }
                disabled={
                  saving ||
                  !activeTerm ||
                  classStudents.every(
                    (student) =>
                      !!lockedAttendance[
                        student.id
                      ]
                  )
                }
              >
                {saving
                  ? "Saving Attendance..."
                  : "Save Attendance"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          WEEKLY ATTENDANCE
      ===================================================== */}

      {selectedClass && (
        <div
          className="page-card"
          style={{
            marginBottom:
              "25px",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "20px",
              flexWrap:
                "wrap",
              gap: "15px",
            }}
          >
            <div>
              <h2>
                Weekly Attendance
              </h2>

              <p
                style={{
                  color:
                    "#64748b",
                  marginTop:
                    "5px",
                }}
              >
                Attendance percentage
                calculated from expected
                Monday-Friday school days.
                Weekends and dates outside
                the active term are excluded.
              </p>
            </div>

            <div>
              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "8px",
                  fontWeight:
                    "600",
                }}
              >
                Select Week
              </label>

              <input
                type="date"
                value={
                  weekDate
                }
                onChange={(e) =>
                  setWeekDate(
                    e.target.value
                  )
                }
                className="search-input"
              />
            </div>
          </div>

          <div
            style={{
              background:
                "#f8fafc",
              padding:
                "12px 16px",
              borderRadius:
                "8px",
              marginBottom:
                "20px",
            }}
          >
            <strong>
              Week:
            </strong>{" "}
            {formatDate(
              weekDates[0]
            )}{" "}
            –{" "}
            {formatDate(
              weekDates[4]
            )}

            <span
              style={{
                marginLeft:
                  "15px",
                color:
                  "#64748b",
              }}
            >
              {weeklyExpectedDays}{" "}
              expected school day
              {weeklyExpectedDays ===
              1
                ? ""
                : "s"}
            </span>
          </div>

          {loadingWeekly ? (
            <p>
              Loading weekly
              attendance...
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Student Number
                    </th>

                    <th>
                      Student Name
                    </th>

                    {weekDates.map(
                      (date) => (
                        <th
                          key={getDateString(
                            date
                          )}
                          style={{
                            textAlign:
                              "center",
                          }}
                        >
                          {date.toLocaleDateString(
                            "en-NG",
                            {
                              weekday:
                                "short",
                            }
                          )}

                          <div
                            style={{
                              fontSize:
                                "12px",
                              color:
                                "#64748b",
                            }}
                          >
                            {formatDate(
                              date
                            )}
                          </div>
                        </th>
                      )
                    )}

                    <th>
                      Weekly %
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {classStudents.map(
                    (student) => {
                      const stats =
                        getWeeklyStats(
                          student.id
                        );

                      const records =
                        weeklyRecords[
                          student.id
                        ] || {};

                      return (
                        <tr
                          key={
                            student.id
                          }
                        >
                          <td>
                            {
                              student.studentNumber ||
                              "—"
                            }
                          </td>

                          <td>
                            <strong>
                              {
                                student.fullName
                              }
                            </strong>
                          </td>

                          {weekDates.map(
                            (date) => {
                              const dateString =
                                getDateString(
                                  date
                                );

                              const status =
                                records[
                                  dateString
                                ];

                              return (
                                <td
                                  key={
                                    dateString
                                  }
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "600",
                                  }}
                                >
                                  {status ===
                                  "Present"
                                    ? "P"
                                    : status ===
                                      "Absent"
                                    ? "A"
                                    : "—"}
                                </td>
                              );
                            }
                          )}

                          <td
                            style={{
                              textAlign:
                                "center",
                            }}
                          >
                            <strong>
                              {
                                stats.percentage
                              }
                              %
                            </strong>

                            <div
                              style={{
                                fontSize:
                                  "12px",
                                color:
                                  "#64748b",
                              }}
                            >
                              {
                                stats.presentDays
                              }
                              /
                              {
                                weeklyExpectedDays
                              }{" "}
                              present
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          TERMLY ATTENDANCE
      ===================================================== */}

      {selectedClass && (
        <div className="page-card">
          <div
            style={{
              marginBottom:
                "20px",
            }}
          >
            <h2>
              Termly Attendance
            </h2>

            <p
              style={{
                color:
                  "#64748b",
                marginTop:
                  "5px",
              }}
            >
              Term percentage is
              calculated from all
              daily attendance records
              for the selected class,
              session and term.
            </p>
          </div>

          <div
            style={{
              display:
                "flex",
              gap: "15px",
              flexWrap:
                "wrap",
              marginBottom:
                "20px",
            }}
          >
            <div
              style={{
                background:
                  "#f8fafc",
                padding:
                  "14px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "13px",
                  color:
                    "#64748b",
                }}
              >
                Term
              </div>

              <strong>
                {activeTerm?.name ||
                  "—"}
              </strong>
            </div>

            <div
              style={{
                background:
                  "#f8fafc",
                padding:
                  "14px 18px",
                borderRadius:
                  "8px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "13px",
                  color:
                    "#64748b",
                }}
              >
                Attendance Days
              </div>

              <strong>
                {
                  termAttendanceDays
                }
              </strong>
            </div>
          </div>

          {loadingTerm ? (
            <p>
              Loading termly
              attendance...
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Student Number
                    </th>

                    <th>
                      Student Name
                    </th>

                    <th>
                      Present
                    </th>

                    <th>
                      Absent
                    </th>

                    <th>
                      Attendance Days
                    </th>

                    <th>
                      Term %
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {classStudents.map(
                    (student) => {
                      const stats =
                        getTermStats(
                          student.id
                        );

                      return (
                        <tr
                          key={
                            student.id
                          }
                        >
                          <td>
                            {
                              student.studentNumber ||
                              "—"
                            }
                          </td>

                          <td>
                            <strong>
                              {
                                student.fullName
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              stats.presentDays
                            }
                          </td>

                          <td>
                            {
                              stats.absentDays
                            }
                          </td>

                          <td>
                            {
                              stats.presentDays +
                              stats.absentDays
                            }
                          </td>

                          <td>
                            <strong>
                              {
                                stats.percentage
                              }
                              %
                            </strong>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NO CLASS */}

      {!selectedClass && (
        <div
          className="page-card"
          style={{
            textAlign:
              "center",
            padding:
              "50px",
            color:
              "#64748b",
          }}
        >
          Select a class to begin
          recording and viewing
          attendance.
        </div>
      )}
      {overrideTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-override-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(15, 23, 42, 0.45)",
          }}
        >
          <div
            className="page-card"
            style={{
              width: "min(100%, 460px)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 id="attendance-override-title">
              Override saved attendance
            </h2>

            <p
              style={{
                margin: "10px 0 18px",
                color: "#475569",
              }}
            >
              {overrideTarget.studentName}:{" "}
              {overrideTarget.currentStatus} →{" "}
              {overrideStatus}
            </p>

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              New status
            </label>

            <select
              className="filter-select"
              value={overrideStatus}
              onChange={(event) =>
                setOverrideStatus(event.target.value)
              }
              style={{
                width: "100%",
                marginBottom: "16px",
              }}
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
            </select>

            <label
              htmlFor="attendance-override-reason"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Override reason
            </label>

            <textarea
              id="attendance-override-reason"
              value={overrideReason}
              onChange={(event) =>
                setOverrideReason(event.target.value)
              }
              required
              rows="4"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                marginBottom: "18px",
              }}
              placeholder="Explain why this saved record is being changed."
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                disabled={overriding}
                onClick={() => setOverrideTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={
                  overriding ||
                  !overrideReason.trim() ||
                  overrideStatus ===
                    overrideTarget.currentStatus
                }
                onClick={handleOverrideAttendance}
              >
                {overriding
                  ? "Saving override..."
                  : "Confirm override"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}