import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

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
  const [success, setSuccess] = useState("");

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
    studentType: "new",
  });

  // ==================================================
  // LOAD STUDENTS
  // ==================================================

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/students`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load students."
        );
      }

      setStudents(data);
    } catch (err) {
      console.error("Load students error:", err);

      setError(
        err.message ||
          "Unable to load students. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // ==================================================
  // FORM CHANGE
  // ==================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // ==================================================
  // CREATE STUDENT
  // ==================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    if (!form.className) {
      setError("Please select a class.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/api/students`,
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
            studentType: form.studentType,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create student."
        );
      }

      setSuccess(
        `Student added successfully. Admission No: ${
          data.studentNumber || "Generated"
        }`
      );

      setForm({
        firstName: "",
        lastName: "",
        parentPhone: "",
        className: "",
        status: "Active",
        studentType: "new",
      });

      setShowForm(false);

      await fetchStudents();
    } catch (err) {
      console.error("Create student error:", err);

      setError(
        err.message || "Unable to create student."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==================================================
  // FILTER STUDENTS
  // ==================================================

  const filteredStudents = students.filter(
    (student) => {
      const query = search.toLowerCase().trim();

      const name =
        student.fullName ||
        `${student.firstName || ""} ${
          student.lastName || ""
        }`.trim();

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        String(student.studentNumber || "")
          .toLowerCase()
          .includes(query) ||
        String(student.studentId || "")
          .toLowerCase()
          .includes(query);

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

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="page">
        <h1>Students</h1>
        <p>Loading students...</p>
      </div>
    );
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div className="page">

      {/* HEADER */}

      <div className="page-header">

        <h1>Students</h1>

        <button
          className="primary-btn"
          onClick={() => {
            setShowForm((current) => !current);
            setError("");
            setSuccess("");
          }}
        >
          {showForm ? "Close" : "+ Add Student"}
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

      {/* ADD STUDENT FORM */}

      {showForm && (
        <div
          className="page-card"
          style={{
            marginBottom: "25px",
          }}
        >

          <h2>Add Student</h2>

          <form onSubmit={handleSubmit}>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "15px",
                marginTop: "20px",
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

                {CLASS_OPTIONS.map((className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    {className}
                  </option>
                ))}
              </select>

              {/* STUDENT TYPE */}

              <select
                name="studentType"
                value={form.studentType}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="new">
                  New Student
                </option>

                <option value="old">
                  Returning Student
                </option>
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
                onClick={() => {
                  setShowForm(false);
                  setError("");
                  setSuccess("");
                }}
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

      {/* SEARCH + FILTERS */}

      <div className="table-controls">

        <input
          type="text"
          placeholder="🔍 Search student..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          className="search-input"
        />

        <select
          value={classFilter}
          onChange={(event) =>
            setClassFilter(event.target.value)
          }
          className="filter-select"
        >
          <option value="">
            All Classes
          </option>

          {CLASS_OPTIONS.map((className) => (
            <option
              key={className}
              value={className}
            >
              {className}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
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

      {/* STUDENT TABLE */}

      <div className="page-card">

        <table>

          <thead>

            <tr>
              <th>Student ID</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Class</th>
              <th>Admission No.</th>
              <th>Parent Phone</th>
              <th>Status</th>
            </tr>

          </thead>

          <tbody>

            {filteredStudents.length > 0 ? (

              filteredStudents.map((student) => (

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

              ))

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