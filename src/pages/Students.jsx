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

export default function Students() {
  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    parentPhone: "",
    className: "",
    status: "Active",
  });

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
        throw new Error("Failed to fetch students.");
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
  // FORM CHANGE
  // ========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  // ========================================
  // CREATE STUDENT
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.firstName.trim()) {
      alert("Please enter the student's first name.");
      return;
    }

    if (!form.lastName.trim()) {
      alert("Please enter the student's last name.");
      return;
    }

    if (!form.className) {
      alert("Please select the student's class.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/students",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            parentPhone: form.parentPhone.trim(),
            className: form.className,
            status: form.status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create student."
        );
      }

      /*
        Airtable generates:

        - Student Number
        - Student ID Auto

        We receive the complete Airtable record
        from the backend.
      */

      const newStudent = {
        id: data.id,

        studentId:
          data.fields?.["Student ID Auto"] || "",

        firstName:
          data.fields?.["First Name"] || "",

        lastName:
          data.fields?.["Last Name"] || "",

        fullName:
          [
            data.fields?.["First Name"],
            data.fields?.["Last Name"],
          ]
            .filter(Boolean)
            .join(" "),

        className:
          data.fields?.["Class"] || "",

        studentNumber:
          data.fields?.["Student Number"] || "",

        parentPhone:
          data.fields?.["Parent Phone"] || "",

        status:
          data.fields?.["Status"] || "Active",
      };

      setStudents((currentStudents) => [
        ...currentStudents,
        newStudent,
      ]);

      // Reset form

      setForm({
        firstName: "",
        lastName: "",
        parentPhone: "",
        className: "",
        status: "Active",
      });

      setShowForm(false);

      alert("Student added successfully.");

      // Reload from backend so Airtable-generated
      // fields are definitely reflected.

      await fetchStudents();
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Failed to create student."
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // FILTER STUDENTS
  // ========================================

  const filteredStudents = students.filter(
    (student) => {
      const searchText =
        search.toLowerCase().trim();

      const studentName =
        student.fullName ||
        [
          student.firstName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" ");

      const matchesSearch =
        !searchText ||
        studentName
          .toLowerCase()
          .includes(searchText) ||
        String(student.studentNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        String(student.studentId || "")
          .toLowerCase()
          .includes(searchText);

      const matchesClass =
        !classFilter ||
        student.className === classFilter;

      const matchesStatus =
        !statusFilter ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesClass &&
        matchesStatus
      );
    }
  );

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="page">
        <h1>Students</h1>
        <p>Loading students...</p>
      </div>
    );
  }

  // ========================================
  // PAGE
  // ========================================

  return (
    <div className="page">

      {/* PAGE HEADER */}

      <div className="page-header">

        <h1>Students</h1>

        <button
          className="primary-btn"
          onClick={() =>
            setShowForm(!showForm)
          }
        >
          {showForm
            ? "Close"
            : "+ Add Student"}
        </button>

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

      {/* ADD STUDENT FORM */}

      {showForm && (
        <div
          className="page-card"
          style={{
            marginBottom: "25px",
          }}
        >

          <h2
            style={{
              marginBottom: "20px",
            }}
          >
            Add Student
          </h2>

          <form onSubmit={handleSubmit}>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, 1fr)",
                gap: "15px",
              }}
            >

              {/* FIRST NAME */}

              <input
                type="text"
                name="firstName"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
                className="search-input"
              />

              {/* LAST NAME */}

              <input
                type="text"
                name="lastName"
                placeholder="Last name"
                value={form.lastName}
                onChange={handleChange}
                className="search-input"
              />

              {/* PARENT PHONE */}

              <input
                type="tel"
                name="parentPhone"
                placeholder="Parent phone"
                value={form.parentPhone}
                onChange={handleChange}
                className="search-input"
              />

              {/* CLASS */}

              <select
                name="className"
                value={form.className}
                onChange={handleChange}
                className="filter-select"
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

              {/* STATUS */}

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>

            </div>

            {/* BUTTONS */}

            <div
              style={{
                marginTop: "20px",
              }}
            >

              <button
                type="submit"
                className="primary-btn"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Student"}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  setShowForm(false)
                }
                style={{
                  background: "#64748b",
                  marginLeft: "10px",
                }}
              >
                Cancel
              </button>

            </div>

          </form>

        </div>
      )}

      {/* SEARCH AND FILTERS */}

      <div className="table-controls">

        <input
          type="text"
          placeholder="🔍 Search student..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="search-input"
        />

        <select
          value={classFilter}
          onChange={(e) =>
            setClassFilter(e.target.value)
          }
          className="filter-select"
        >
          <option value="">
            All Classes
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

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
          className="filter-select"
        >
          <option value="">
            All Status
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Inactive">
            Inactive
          </option>
        </select>

      </div>

      {/* STUDENTS TABLE */}

      <div className="page-card">

        <table>

          <thead>

            <tr>

              <th>
                Student ID
              </th>

              <th>
                First Name
              </th>

              <th>
                Last Name
              </th>

              <th>
                Class
              </th>

              <th>
                Student Number
              </th>

              <th>
                Parent Phone
              </th>

              <th>
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {filteredStudents.length > 0 ? (

              filteredStudents.map(
                (student) => (

                  <tr key={student.id}>

                    <td>
                      {student.studentId || "—"}
                    </td>

                    <td>
                      {student.firstName || "—"}
                    </td>

                    <td>
                      {student.lastName || "—"}
                    </td>

                    <td>
                      {student.className || "—"}
                    </td>

                    <td>
                      {student.studentNumber || "—"}
                    </td>

                    <td>
                      {student.parentPhone || "—"}
                    </td>

                    <td>
                      {student.status || "Active"}
                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#64748b",
                  }}
                >
                  No students found.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}