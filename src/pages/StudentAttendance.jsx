import { useEffect, useState } from "react";

const CLASS_OPTIONS = [
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

export default function StudentAttendance() {
  const [students, setStudents] = useState([]);

  const [selectedClass, setSelectedClass] =
    useState("");

  const [attendanceDate, setAttendanceDate] =
    useState(
      new Date().toISOString().split("T")[0]
    );

  const [attendance, setAttendance] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  // ========================================
  // LOAD STUDENTS
  // ========================================

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/students"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load students."
        );
      }

      const data = await response.json();

      setStudents(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load students. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // ========================================
  // STUDENTS FOR SELECTED CLASS
  // ========================================

  const classStudents = students.filter(
    (student) =>
      student.className === selectedClass
  );

  // ========================================
  // MARK ATTENDANCE
  // ========================================

  const markAttendance = (
    studentId,
    status
  ) => {
    setAttendance(
      (currentAttendance) => ({
        ...currentAttendance,
        [studentId]: status,
      })
    );
  };

  // ========================================
  // MARK ALL PRESENT
  // ========================================

  const markAllPresent = () => {
    const updatedAttendance = {};

    classStudents.forEach((student) => {
      updatedAttendance[student.id] =
        "Present";
    });

    setAttendance(updatedAttendance);
  };

  // ========================================
  // RESET ATTENDANCE
  // ========================================

  const resetAttendance = () => {
    setAttendance({});
  };

  // ========================================
  // SAVE ATTENDANCE TO AIRTABLE
  // ========================================

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      alert("Please select a class first.");
      return;
    }

    if (classStudents.length === 0) {
      alert(
        "There are no students in this class."
      );
      return;
    }

    const unmarkedStudents =
      classStudents.filter(
        (student) =>
          !attendance[student.id]
      );

    if (unmarkedStudents.length > 0) {
      alert(
        `Please mark attendance for all ${unmarkedStudents.length} remaining student(s).`
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/attendance",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            date: attendanceDate,

            className:
              selectedClass,

            attendance,

            recordedBy:
              "School Admin",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save attendance."
        );
      }

      alert(
        `Attendance saved successfully for ${data.recordsCreated} student(s).`
      );

      // Clear the current attendance
      // after successful saving.

      setAttendance({});
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

  // ========================================
  // COUNTS
  // ========================================

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

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="page">
        <h1>
          Student Attendance
        </h1>

        <p>
          Loading students...
        </p>
      </div>
    );
  }

  // ========================================
  // PAGE
  // ========================================

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
              color: "#64748b",
              marginTop: "6px",
            }}
          >
            Record daily student
            attendance by class.
          </p>

        </div>

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

      {/* CONTROLS */}

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

          {/* DATE */}

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

          {/* CLASS */}

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
              }}
              className="filter-select"
              style={{
                width: "100%",
              }}
            >

              <option value="">
                Select Class
              </option>

              {CLASS_OPTIONS.map(
                (className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    {className}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

      </div>

      {/* ATTENDANCE */}

      {selectedClass && (
        <div className="page-card">

          {/* HEADER */}

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
                {selectedClass}
              </h2>

              <p
                style={{
                  color: "#64748b",
                  marginTop: "5px",
                }}
              >
                {classStudents.length}{" "}
                student(s)
              </p>

            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
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
                  background:
                    "#64748b",
                }}
              >
                Reset
              </button>

            </div>

          </div>

          {/* SUMMARY */}

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
              {classStudents.length}
            </div>

          </div>

          {/* STUDENT TABLE */}

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
                  (student) => {

                    const studentName =
                      student.fullName ||
                      [
                        student.firstName,
                        student.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ");

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
                          {studentName ||
                            "—"}
                        </td>

                        <td>

                          <div
                            style={{
                              display:
                                "flex",
                              gap: "10px",
                              flexWrap:
                                "wrap",
                            }}
                          >

                            {/* PRESENT */}

                            <button
                              type="button"
                              onClick={() =>
                                markAttendance(
                                  student.id,
                                  "Present"
                                )
                              }
                              style={{
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
                                    : "#ffffff",

                                color:
                                  "#166534",

                                padding:
                                  "8px 14px",

                                borderRadius:
                                  "6px",

                                cursor:
                                  "pointer",
                              }}
                            >
                              Present
                            </button>

                            {/* ABSENT */}

                            <button
                              type="button"
                              onClick={() =>
                                markAttendance(
                                  student.id,
                                  "Absent"
                                )
                              }
                              style={{
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
                                    : "#ffffff",

                                color:
                                  "#991b1b",

                                padding:
                                  "8px 14px",

                                borderRadius:
                                  "6px",

                                cursor:
                                  "pointer",
                              }}
                            >
                              Absent
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          ) : (

            <div
              style={{
                textAlign:
                  "center",
                padding: "40px",
                color:
                  "#64748b",
              }}
            >
              No students are
              currently registered
              in{" "}
              <strong>
                {selectedClass}
              </strong>
              .
            </div>

          )}

          {/* SAVE */}

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
                disabled={saving}
              >
                {saving
                  ? "Saving Attendance..."
                  : "Save Attendance"}
              </button>

            </div>
          )}

        </div>
      )}

      {/* NO CLASS SELECTED */}

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