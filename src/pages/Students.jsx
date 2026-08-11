import { useEffect, useState } from "react";

export default function Students() {
  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    studentNumber: "",
    parentPhone: "",
    status: "Active",
  });

  // Load students from Airtable
  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/students"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch students");
      }

      const data = await response.json();

      const formattedStudents = data.map((record) => ({
        id: record.id,
        studentId:
          record.fields["Student ID Auto"] || "",
        name:
          record.fields["Name"] || "",
        studentNumber:
          record.fields["Student Number"] || "",
        parentPhone:
          record.fields["Parent Phone"] || "",
        status:
          record.fields["Status"] || "Active",
      }));

      setStudents(formattedStudents);
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

  // Handle form changes
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Create student
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.studentNumber) {
      alert("Please enter the student's name and student number.");
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
            name: form.name,
            studentNumber: form.studentNumber,
            parentPhone: form.parentPhone,
            status: form.status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create student"
        );
      }

      // Add newly created student immediately
      const newStudent = {
        id: data.id,
        studentId:
          data.fields["Student ID Auto"] || "",
        name:
          data.fields["Name"] || "",
        studentNumber:
          data.fields["Student Number"] || "",
        parentPhone:
          data.fields["Parent Phone"] || "",
        status:
          data.fields["Status"] || "Active",
      };

      setStudents((currentStudents) => [
        ...currentStudents,
        newStudent,
      ]);

      // Reset form
      setForm({
        name: "",
        studentNumber: "",
        parentPhone: "",
        status: "Active",
      });

      setShowForm(false);

      alert("Student added successfully.");
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Failed to create student."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <h1>Students</h1>
        <p>Loading students...</p>
      </div>
    );
  }

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">

        <h1>Students</h1>

        <button
          className="primary-btn"
          onClick={() => setShowForm(!showForm)}
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

      {/* ADD STUDENT FORM */}
      {showForm && (
        <div
          className="page-card"
          style={{
            marginBottom: "25px",
          }}
        >

          <h2 style={{ marginBottom: "20px" }}>
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

              <input
                type="text"
                name="name"
                placeholder="Student name"
                value={form.name}
                onChange={handleChange}
                className="search-input"
              />

              <input
                type="number"
                name="studentNumber"
                placeholder="Student number"
                value={form.studentNumber}
                onChange={handleChange}
                className="search-input"
              />

              <input
                type="tel"
                name="parentPhone"
                placeholder="Parent phone"
                value={form.parentPhone}
                onChange={handleChange}
                className="search-input"
              />

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
                onClick={() => setShowForm(false)}
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

      {/* STUDENTS TABLE */}
      <div className="page-card">

        <table>

          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Student Number</th>
              <th>Parent Phone</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {students.length > 0 ? (
              students.map((student) => (
                <tr key={student.id}>

                  <td>
                    {student.studentId}
                  </td>

                  <td>
                    {student.name}
                  </td>

                  <td>
                    {student.studentNumber}
                  </td>

                  <td>
                    {student.parentPhone || "—"}
                  </td>

                  <td>
                    {student.status}
                  </td>

                </tr>
              ))
            ) : (
              <tr>

                <td
                  colSpan="5"
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