import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000";

const TERM_OPTIONS = [
  "First Term",
  "Second Term",
  "Third Term",
];

const SESSION_OPTIONS = [
  "2025/2026",
  "2026/2027",
];

export default function FeeAccounts() {
  const [feeAccounts, setFeeAccounts] = useState([]);
  const [students, setStudents] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] =
    useState("All Terms");

  // IMPORTANT:
  // Start with ALL SESSIONS so existing Airtable
  // records are immediately visible.
  const [selectedSession, setSelectedSession] =
    useState("All Sessions");

  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    studentRecordId: "",
    session: "2026/2027",
    term: "First Term",
    totalFee: "",
  });

  // ============================================
  // LOAD STUDENTS
  // ============================================

  const loadStudents = async () => {
    const response = await fetch(
      `${API_URL}/api/students`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to load students."
      );
    }

    return Array.isArray(data)
      ? data
      : data.records || [];
  };

  // ============================================
  // LOAD FEE ACCOUNTS
  // ============================================

  const loadFeeAccounts = async () => {
    const response = await fetch(
      `${API_URL}/api/fee-accounts`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to load fee accounts."
      );
    }

    return Array.isArray(data)
      ? data
      : data.records || [];
  };

  // ============================================
  // LOAD ALL DATA
  // ============================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        studentsData,
        feeAccountsData,
      ] = await Promise.all([
        loadStudents(),
        loadFeeAccounts(),
      ]);

      console.log(
        "Students loaded:",
        studentsData
      );

      console.log(
        "Fee accounts loaded:",
        feeAccountsData
      );

      setStudents(studentsData);
      setFeeAccounts(feeAccountsData);
    } catch (err) {
      console.error(
        "LOAD DATA ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load fee account data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ============================================
  // GET STUDENT NAME
  // ============================================

  const getStudentName = (account) => {
    const fields = account?.fields || {};

    const studentField =
      fields.Student;

    // Airtable linked-record field normally
    // returns an array of record IDs.
    if (Array.isArray(studentField)) {
      const studentId =
        studentField[0];

      const student = students.find(
        (item) =>
          item.id === studentId
      );

      return (
        student?.fields?.Name ||
        "Unknown Student"
      );
    }

    // Fallback if API already returned
    // the student name.
    if (
      typeof studentField === "string" &&
      studentField.trim()
    ) {
      return studentField;
    }

    return "Unknown Student";
  };

  // ============================================
  // FILTER
  // ============================================

  const filteredFeeAccounts = useMemo(() => {
    const searchText =
      search.toLowerCase().trim();

    return feeAccounts.filter(
      (account) => {
        const fields =
          account?.fields || {};

        const studentName =
          getStudentName(
            account
          ).toLowerCase();

        const feeAccountId =
          String(
            fields["Fee Account ID"] ||
              ""
          ).toLowerCase();

        const session =
          String(
            fields.Session || ""
          ).trim();

        const term =
          String(
            fields.Term || ""
          ).trim();

        const matchesSearch =
          !searchText ||
          studentName.includes(
            searchText
          ) ||
          feeAccountId.includes(
            searchText
          );

        const matchesTerm =
          selectedTerm ===
            "All Terms" ||
          term === selectedTerm;

        const matchesSession =
          selectedSession ===
            "All Sessions" ||
          session === selectedSession;

        return (
          matchesSearch &&
          matchesTerm &&
          matchesSession
        );
      }
    );
  }, [
    feeAccounts,
    students,
    search,
    selectedTerm,
    selectedSession,
  ]);

  // ============================================
  // FORM CHANGE
  // ============================================

  const handleFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  // ============================================
  // RESET FORM
  // ============================================

  const resetForm = () => {
    setFormData({
      studentRecordId: "",
      session: "2026/2027",
      term: "First Term",
      totalFee: "",
    });
  };

  // ============================================
  // CLOSE MODAL
  // ============================================

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    resetForm();
  };

  // ============================================
  // CREATE FEE ACCOUNT
  // ============================================

  const handleCreateFeeAccount = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    if (!formData.studentRecordId) {
      setError(
        "Please select a student."
      );
      return;
    }

    if (!formData.session) {
      setError(
        "Please select a session."
      );
      return;
    }

    if (!formData.term) {
      setError(
        "Please select a term."
      );
      return;
    }

    if (
      !formData.totalFee ||
      Number(formData.totalFee) <= 0
    ) {
      setError(
        "Please enter a valid total fee."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        studentRecordId:
          formData.studentRecordId,

        session:
          formData.session,

        // IMPORTANT:
        // Send Airtable's exact option name.
        term:
          formData.term,

        totalFee:
          Number(formData.totalFee),
      };

      console.log(
        "Creating fee account:",
        payload
      );

      const response = await fetch(
        `${API_URL}/api/fee-accounts`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      console.log(
        "Create fee account response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create fee account."
        );
      }

      // Close first.
      setShowModal(false);
      resetForm();

      // Reload directly from Airtable.
      // This guarantees the UI matches
      // the actual database.
      await loadData();
    } catch (err) {
      console.error(
        "CREATE FEE ACCOUNT ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to create fee account."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="page">

      {/* HEADER */}
      <div className="page-header">

        <h1>
          Fee Accounts
        </h1>

        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            setError("");
            setShowModal(true);
          }}
        >
          + Create Fee Account
        </button>

      </div>

      {/* ERROR */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontWeight: "500",
          }}
        >
          {error}
        </div>
      )}

      {/* FILTERS */}
      <div className="table-controls">

        <input
          type="text"
          className="search-input"
          placeholder="Search student or fee account..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />

        <select
          className="filter-select"
          value={selectedTerm}
          onChange={(event) =>
            setSelectedTerm(
              event.target.value
            )
          }
        >
          <option value="All Terms">
            All Terms
          </option>

          {TERM_OPTIONS.map(
            (term) => (
              <option
                key={term}
                value={term}
              >
                {term}
              </option>
            )
          )}
        </select>

        <select
          className="filter-select"
          value={selectedSession}
          onChange={(event) =>
            setSelectedSession(
              event.target.value
            )
          }
        >
          <option value="All Sessions">
            All Sessions
          </option>

          {SESSION_OPTIONS.map(
            (session) => (
              <option
                key={session}
                value={session}
              >
                {session}
              </option>
            )
          )}
        </select>

      </div>

      {/* TABLE */}
      <div className="table-section">

        <h2>
          Fee Accounts
        </h2>

        {loading ? (
          <p
            style={{
              padding: "30px 0",
              color: "#64748b",
            }}
          >
            Loading fee accounts...
          </p>
        ) : (
          <table>

            <thead>
              <tr>
                <th>
                  Fee Account ID
                </th>

                <th>
                  Student
                </th>

                <th>
                  Session
                </th>

                <th>
                  Term
                </th>

                <th>
                  Total Fee
                </th>

                <th>
                  Total Paid
                </th>

                <th>
                  Balance
                </th>

                <th>
                  Status
                </th>
              </tr>
            </thead>

            <tbody>

              {filteredFeeAccounts.length >
              0 ? (
                filteredFeeAccounts.map(
                  (account) => {
                    const fields =
                      account?.fields ||
                      {};

                    const totalFee =
                      Number(
                        fields[
                          "Total Fee"
                        ] || 0
                      );

                    const totalPaid =
                      Number(
                        fields[
                          "Total Paid"
                        ] || 0
                      );

                    const balance =
                      fields.Balance !==
                      undefined
                        ? Number(
                            fields.Balance
                          )
                        : totalFee -
                          totalPaid;

                    const status =
                      fields[
                        "Payment Status"
                      ] ||
                      fields.Status ||
                      (balance <= 0
                        ? "Paid"
                        : totalPaid > 0
                        ? "Part Payment"
                        : "Unpaid");

                    return (
                      <tr
                        key={
                          account.id
                        }
                      >

                        <td>
                          {fields[
                            "Fee Account ID"
                          ] || "—"}
                        </td>

                        <td>
                          {getStudentName(
                            account
                          )}
                        </td>

                        <td>
                          {fields.Session ||
                            "—"}
                        </td>

                        <td>
                          {fields.Term ||
                            "—"}
                        </td>

                        <td>
                          ₦
                          {totalFee.toLocaleString()}
                        </td>

                        <td>
                          ₦
                          {totalPaid.toLocaleString()}
                        </td>

                        <td>
                          ₦
                          {balance.toLocaleString()}
                        </td>

                        <td>
                          {status}
                        </td>

                      </tr>
                    );
                  }
                )
              ) : (
                <tr>

                  <td
                    colSpan="8"
                    style={{
                      textAlign:
                        "center",
                      padding: "40px",
                      color:
                        "#64748b",
                    }}
                  >
                    No fee accounts
                    found.
                  </td>

                </tr>
              )}

            </tbody>

          </table>
        )}

      </div>

      {/* MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >

          <div
            className="modal-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <h2>
                Create Fee Account
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleCreateFeeAccount
              }
            >

              {/* STUDENT */}
              <div className="form-group">

                <label htmlFor="studentRecordId">
                  Student *
                </label>

                <select
                  id="studentRecordId"
                  name="studentRecordId"
                  value={
                    formData.studentRecordId
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                >

                  <option value="">
                    Select student
                  </option>

                  {students.map(
                    (student) => (
                      <option
                        key={
                          student.id
                        }
                        value={
                          student.id
                        }
                      >
                        {student.fields
                          ?.Name ||
                          "Unnamed Student"}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* SESSION + TERM */}
              <div className="form-row">

                <div className="form-group">

                  <label htmlFor="session">
                    Session *
                  </label>

                  <select
                    id="session"
                    name="session"
                    value={
                      formData.session
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >

                    {SESSION_OPTIONS.map(
                      (session) => (
                        <option
                          key={
                            session
                          }
                          value={
                            session
                          }
                        >
                          {session}
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div className="form-group">

                  <label htmlFor="term">
                    Term *
                  </label>

                  <select
                    id="term"
                    name="term"
                    value={
                      formData.term
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >

                    {TERM_OPTIONS.map(
                      (term) => (
                        <option
                          key={term}
                          value={term}
                        >
                          {term}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

              {/* TOTAL FEE */}
              <div className="form-group">

                <label htmlFor="totalFee">
                  Total Fee (₦) *
                </label>

                <input
                  id="totalFee"
                  type="number"
                  name="totalFee"
                  min="1"
                  step="1"
                  placeholder="50000"
                  value={
                    formData.totalFee
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                />

              </div>

              {/* ACTIONS */}
              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Creating..."
                    : "Create Fee Account"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}