import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

const formatDate = (date) => {
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
};

export default function StudentAttendance() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [academicSession, setAcademicSession] = useState(null);
  const [activeTerm, setActiveTerm] = useState(null);

  const [selectedClass, setSelectedClass] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(
    getDateString(new Date())
  );

  const [weekDate, setWeekDate] = useState(
    getDateString(new Date())
  );

  const [attendance, setAttendance] = useState({});
  const [weeklyRecords, setWeeklyRecords] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =========================================================
  // ACADEMIC SESSION + ACTIVE TERM
  // =========================================================

  const fetchAcademicContext = async () => {
    try {
      const { data: session, error: sessionError } =
        await supabase
          .from("academic_sessions")
          .select("id, name, is_active")
          .eq("is_active", true)
          .maybeSingle();

      if (sessionError) throw sessionError;

      if (!session) {
        setAcademicSession(null);
        setActiveTerm(null);

        throw new Error(
          "There is no active academic session."
        );
      }

      setAcademicSession(session);

      const { data: term, error: termError } =
        await supabase
          .from("terms")
          .select(`
            id,
            academic_session_id,
            name,
            status,
            started_at,
            closed_at
          `)
          .eq("academic_session_id", session.id)
          .eq("status", "active")
          .maybeSingle();

      if (termError) throw termError;

      if (!term) {
        setActiveTerm(null);

        throw new Error(
          "There is no active academic term."
        );
      }

      setActiveTerm(term);
    } catch (err) {
      console.error(err);
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
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, display_order");

      if (error) throw error;

      /*
       * IMPORTANT:
       * We deliberately sort AGAIN in JavaScript.
       * This guarantees that the UI follows the school's
       * academic order even if Supabase returns the rows
       * in a different order.
       */

      const sortedClasses = [...(data || [])].sort(
        (a, b) => {
          const orderA =
            SCHOOL_CLASS_ORDER.indexOf(a.name);

          const orderB =
            SCHOOL_CLASS_ORDER.indexOf(b.name);

          // Known classes follow the school order.
          if (orderA !== -1 && orderB !== -1) {
            return orderA - orderB;
          }

          // Known classes always come before unknown classes.
          if (orderA !== -1) return -1;
          if (orderB !== -1) return 1;

          // Unknown classes fall back to database order.
          return (
            (a.display_order ?? 999) -
            (b.display_order ?? 999)
          );
        }
      );

      setClasses(sortedClasses);
    } catch (err) {
      console.error("CLASS LOAD ERROR:", err);

      setError(
        err.message ||
          "Unable to load classes from Supabase."
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
      if (!sessionId || !termId) {
        setStudents([]);
        return;
      }

      const { data, error } = await supabase
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
        .eq("session_id", sessionId)
        .eq("term_id", termId)
        .eq("status", "active");

      if (error) throw error;

      const formattedStudents = (data || [])
        .filter(
          (enrollment) =>
            enrollment.students
        )
        .map((enrollment) => ({
          enrollmentId: enrollment.id,
          id: enrollment.students.id,

          studentNumber:
            enrollment.students.admission_no,

          firstName:
            enrollment.students.first_name,

          lastName:
            enrollment.students.last_name,

          fullName: [
            enrollment.students.first_name,
            enrollment.students.last_name,
          ]
            .filter(Boolean)
            .join(" "),

          studentType:
            enrollment.students.student_type,

          classId: enrollment.class_id,

          className:
            enrollment.classes?.name || "",
        }));

      setStudents(formattedStudents);
    } catch (err) {
      console.error("STUDENT LOAD ERROR:", err);

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
    const initialize = async () => {
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
    if (!academicSession || !activeTerm) {
      setStudents([]);
      return;
    }

    fetchStudents(
      academicSession.id,
      activeTerm.id
    );
  }, [academicSession, activeTerm]);

  // =========================================================
  // SELECTED CLASS STUDENTS
  // =========================================================

  const classStudents = useMemo(() => {
    return students.filter(
      (student) =>
        student.classId === selectedClass
    );
  }, [students, selectedClass]);

  // =========================================================
  // WEEK
  // =========================================================

  const weekDates = useMemo(() => {
    return getWeekDates(
      new Date(`${weekDate}T00:00:00`)
    );
  }, [weekDate]);

  // =========================================================
  // WEEKLY ATTENDANCE
  // =========================================================

  const fetchWeeklyAttendance = async () => {
    if (
      !selectedClass ||
      classStudents.length === 0
    ) {
      setWeeklyRecords({});
      return;
    }

    try {
      setLoadingWeekly(true);

      const startDate = getDateString(
        weekDates[0]
      );

      const endDate = getDateString(
        weekDates[4]
      );

      const studentIds = classStudents.map(
        (student) => student.id
      );

      const { data, error } = await supabase
        .from("student_attendance")
        .select(
          "student_id, enrollment_id, attendance_date, status"
        )
        .in("student_id", studentIds)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (error) throw error;

      const records = {};

      (data || []).forEach((record) => {
        if (!records[record.student_id]) {
          records[record.student_id] = {};
        }

        records[record.student_id][
          record.attendance_date
        ] = record.status;
      });

      setWeeklyRecords(records);
    } catch (err) {
      console.error(err);

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
    classStudents.length,
  ]);

  // =========================================================
  // ATTENDANCE ACTIONS
  // =========================================================

  const markAttendance = (
    studentId,
    status
  ) => {
    setAttendance((current) => ({
      ...current,
      [studentId]: status,
    }));
  };

  const markAllPresent = () => {
    const updated = {};

    classStudents.forEach((student) => {
      updated[student.id] = "Present";
    });

    setAttendance(updated);
  };

  const resetAttendance = () => {
    setAttendance({});
    setSuccess("");
    setError("");
  };

  // =========================================================
  // SAVE
  // =========================================================

  const handleSaveAttendance = async () => {
    if (!academicSession || !activeTerm) {
      alert(
        "Attendance cannot be recorded because there is no active term."
      );
      return;
    }

    if (!selectedClass) {
      alert("Please select a class.");
      return;
    }

    if (classStudents.length === 0) {
      alert(
        "There are no students enrolled in this class."
      );
      return;
    }

    const unmarked = classStudents.filter(
      (student) =>
        !attendance[student.id]
    );

    if (unmarked.length > 0) {
      alert(
        `Please mark attendance for all ${unmarked.length} remaining student(s).`
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const records = classStudents.map(
        (student) => ({
          student_id: student.id,
          enrollment_id:
            student.enrollmentId,
          attendance_date:
            attendanceDate,
          status:
            attendance[student.id],
        })
      );

      const { error } = await supabase
        .from("student_attendance")
        .upsert(records, {
          onConflict:
            "student_id,attendance_date",
        });

      if (error) throw error;

      setSuccess(
        "Attendance saved successfully."
      );

      setAttendance({});

      await fetchWeeklyAttendance();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // WEEKLY STATS
  // =========================================================

  const getWeeklyStats = (studentId) => {
    const records =
      weeklyRecords[studentId] || {};

    let presentDays = 0;
    let absentDays = 0;

    weekDates.forEach((date) => {
      const dateString =
        getDateString(date);

      const status =
        records[dateString];

      if (status === "Present") {
        presentDays++;
      }

      if (status === "Absent") {
        absentDays++;
      }
    });

    return {
      presentDays,
      absentDays,
      percentage: Math.round(
        (presentDays / 5) * 100
      ),
    };
  };

  const presentCount =
    classStudents.filter(
      (student) =>
        attendance[student.id] ===
        "Present"
    ).length;

  const absentCount =
    classStudents.filter(
      (student) =>
        attendance[student.id] ===
        "Absent"
    ).length;

  const unmarkedCount =
    classStudents.length -
    presentCount -
    absentCount;

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="page">
        <h1>Student Attendance</h1>
        <p>Loading attendance system...</p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h1>Student Attendance</h1>

          <p
            style={{
              color: "#64748b",
              marginTop: "6px",
            }}
          >
            Record daily attendance and
            monitor individual weekly
            attendance percentages.
          </p>
        </div>
      </div>

      {/* ACADEMIC CONTEXT */}

      <div
        className="page-card"
        style={{
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Academic Session
            </label>

            <div
              style={{
                padding: "12px 16px",
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              {academicSession?.name ||
                "No active session"}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Current Term
            </label>

            <div
              style={{
                padding: "12px 16px",
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              {activeTerm?.name ||
                "No active term"}
            </div>
          </div>
        </div>

        <p
          style={{
            marginTop: "12px",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          Academic session and term are
          controlled by the administrator.
        </p>
      </div>

      {/* ERROR */}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px 15px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px 15px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          {success}
        </div>
      )}

      {/* DAILY CONTROLS */}

      <div
        className="page-card"
        style={{
          marginBottom: "20px",
        }}
      >
        <h2
          style={{
            marginBottom: "20px",
          }}
        >
          Daily Attendance
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Attendance Date
            </label>

            <input
              type="date"
              value={attendanceDate}
              onChange={(e) =>
                setAttendanceDate(
                  e.target.value
                )
              }
              className="search-input"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Class
            </label>

            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(
                  e.target.value
                );
                setAttendance({});
                setSuccess("");
              }}
              className="filter-select"
              style={{
                width: "100%",
              }}
            >
              <option value="">
                Select Class
              </option>

              {classes.map((classItem) => (
                <option
                  key={classItem.id}
                  value={classItem.id}
                >
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DAILY TABLE */}

      {selectedClass && (
        <div
          className="page-card"
          style={{
            marginBottom: "25px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div>
              <h2>
                {
                  classes.find(
                    (item) =>
                      item.id ===
                      selectedClass
                  )?.name
                }
              </h2>

              <p
                style={{
                  color: "#64748b",
                  marginTop: "5px",
                }}
              >
                {classStudents.length}{" "}
                enrolled student(s)
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={
                  markAllPresent
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
                  background: "#64748b",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* COUNTS */}

          <div
            style={{
              display: "flex",
              gap: "15px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "#f0fdf4",
                padding:
                  "12px 18px",
                borderRadius: "8px",
              }}
            >
              <strong>Present:</strong>{" "}
              {presentCount}
            </div>

            <div
              style={{
                background: "#fef2f2",
                padding:
                  "12px 18px",
                borderRadius: "8px",
              }}
            >
              <strong>Absent:</strong>{" "}
              {absentCount}
            </div>

            <div
              style={{
                background: "#f8fafc",
                padding:
                  "12px 18px",
                borderRadius: "8px",
              }}
            >
              <strong>Unmarked:</strong>{" "}
              {unmarkedCount}
            </div>

            <div
              style={{
                background: "#f8fafc",
                padding:
                  "12px 18px",
                borderRadius: "8px",
              }}
            >
              <strong>Total:</strong>{" "}
              {classStudents.length}
            </div>
          </div>

          {classStudents.length > 0 ? (
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
                    Attendance
                  </th>
                </tr>
              </thead>

              <tbody>
                {classStudents.map(
                  (student) => (
                    <tr
                      key={
                        student.id
                      }
                    >
                      <td>
                        {student.studentNumber ||
                          "—"}
                      </td>

                      <td>
                        {student.fullName ||
                          "—"}
                      </td>

                      <td>
                        <div
                          style={{
                            display:
                              "flex",
                            gap: "10px",
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
                            style={{
                              padding:
                                "8px 14px",
                              borderRadius:
                                "6px",
                              cursor:
                                "pointer",
                              border:
                                attendance[
                                  student.id
                                ] ===
                                "Present"
                                  ? "2px solid #166534"
                                  : "1px solid #d1d5db",
                              background:
                                attendance[
                                  student.id
                                ] ===
                                "Present"
                                  ? "#dcfce7"
                                  : "#fff",
                              color:
                                "#166534",
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
                            style={{
                              padding:
                                "8px 14px",
                              borderRadius:
                                "6px",
                              cursor:
                                "pointer",
                              border:
                                attendance[
                                  student.id
                                ] ===
                                "Absent"
                                  ? "2px solid #991b1b"
                                  : "1px solid #d1d5db",
                              background:
                                attendance[
                                  student.id
                                ] ===
                                "Absent"
                                  ? "#fee2e2"
                                  : "#fff",
                              color:
                                "#991b1b",
                            }}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#64748b",
              }}
            >
              No students are currently
              enrolled in this class.
            </div>
          )}

          {classStudents.length > 0 && (
            <div
              style={{
                marginTop: "25px",
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
                  !activeTerm
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

      {/* WEEKLY */}

      {selectedClass && (
        <div className="page-card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div>
              <h2>
                Weekly Attendance
              </h2>

              <p
                style={{
                  color: "#64748b",
                  marginTop: "5px",
                }}
              >
                Individual attendance
                percentage for each student.
              </p>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                }}
              >
                Select Week
              </label>

              <input
                type="date"
                value={weekDate}
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
              background: "#f8fafc",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <strong>Week:</strong>{" "}
            {formatDate(
              weekDates[0]
            )}{" "}
            –{" "}
            {formatDate(
              weekDates[4]
            )}

            <span
              style={{
                marginLeft: "15px",
                color: "#64748b",
              }}
            >
              5 school days
            </span>
          </div>

          {loadingWeekly ? (
            <p>
              Loading weekly attendance...
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
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
                            {student.studentNumber ||
                              "—"}
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
                              /5 present
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

      {!selectedClass && (
        <div
          className="page-card"
          style={{
            textAlign: "center",
            padding: "50px",
            color: "#64748b",
          }}
        >
          Select a class to begin
          recording attendance.
        </div>
      )}
    </div>
  );
}