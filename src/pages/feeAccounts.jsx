import { useState } from "react";

export default function FeeAccounts({ feeAccounts, setFeeAccounts }) {
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [termFilter, setTermFilter] = useState("All Terms");
  const [sessionFilter, setSessionFilter] = useState("All Sessions");

  const [form, setForm] = useState({
    name: "",
    className: "",
    term: "",
    amount: "",
    dueDate: "",
    session: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateFee = (e) => {
    e.preventDefault();

    if (
      !form.name ||
      !form.className ||
      !form.term ||
      !form.amount ||
      !form.dueDate ||
      !form.session
    ) {
      alert("Please fill in all fields.");
      return;
    }

    const newFee = {
      id: Date.now(),
      name: form.name,
      className: form.className,
      term: form.term,
      amount: Number(form.amount),
      dueDate: form.dueDate,
      session: form.session,
      status: "Active",
    };

    setFeeAccounts([...feeAccounts, newFee]);

    setForm({
      name: "",
      className: "",
      term: "",
      amount: "",
      dueDate: "",
      session: "",
    });

    setShowForm(false);
  };

  const filteredFees = feeAccounts.filter((fee) => {
    const matchesSearch =
      fee.name.toLowerCase().includes(search.toLowerCase()) ||
      fee.className.toLowerCase().includes(search.toLowerCase());

    const matchesClass =
      classFilter === "All Classes" ||
      fee.className === classFilter;

    const matchesTerm =
      termFilter === "All Terms" ||
      fee.term === termFilter;

    const matchesSession =
      sessionFilter === "All Sessions" ||
      fee.session === sessionFilter;

    return (
      matchesSearch &&
      matchesClass &&
      matchesTerm &&
      matchesSession
    );
  });

  return (
    <div className="page">

      <div className="page-header">
        <h1>Fee Accounts</h1>

        <button
          className="primary-btn"
          onClick={() => setShowForm(true)}
        >
          + Create Fee Account
        </button>
      </div>

      {showForm && (
        <div
          className="page-card"
          style={{ marginBottom: "25px" }}
        >
          <h2 style={{ marginBottom: "20px" }}>
            Create Fee Account
          </h2>

          <form onSubmit={handleCreateFee}>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "15px",
              }}
            >
              <input
                type="text"
                name="name"
                placeholder="Fee name"
                value={form.name}
                onChange={handleChange}
                className="search-input"
              />

              <select
                name="className"
                value={form.className}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="">Select Class</option>
                <option>Primary 1</option>
                <option>Primary 2</option>
                <option>Primary 3</option>
                <option>Primary 4</option>
                <option>Primary 5</option>
                <option>Primary 6</option>
                <option>JSS 1</option>
                <option>JSS 2</option>
                <option>JSS 3</option>
                <option>SS 1</option>
                <option>SS 2</option>
                <option>SS 3</option>
              </select>

              <select
                name="term"
                value={form.term}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="">Select Term</option>
                <option>First Term</option>
                <option>Second Term</option>
                <option>Third Term</option>
              </select>

              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={form.amount}
                onChange={handleChange}
                className="search-input"
              />

              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                className="search-input"
              />

              <select
                name="session"
                value={form.session}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="">Select Session</option>
                <option>2025/2026</option>
                <option>2026/2027</option>
              </select>
            </div>

            <div style={{ marginTop: "20px" }}>
              <button
                type="submit"
                className="primary-btn"
              >
                Save Fee Account
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

      <div className="table-controls">

        <input
          type="text"
          placeholder="Search fee account..."
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option>All Classes</option>
          <option>Primary 1</option>
          <option>Primary 2</option>
          <option>Primary 3</option>
          <option>Primary 4</option>
          <option>Primary 5</option>
          <option>Primary 6</option>
          <option>JSS 1</option>
          <option>JSS 2</option>
          <option>JSS 3</option>
          <option>SS 1</option>
          <option>SS 2</option>
          <option>SS 3</option>
        </select>

        <select
          className="filter-select"
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
        >
          <option>All Terms</option>
          <option>First Term</option>
          <option>Second Term</option>
          <option>Third Term</option>
        </select>

        <select
          className="filter-select"
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
        >
          <option>All Sessions</option>
          <option>2025/2026</option>
          <option>2026/2027</option>
        </select>

      </div>

      <div className="page-card">

        <table>

          <thead>
            <tr>
              <th>Fee Name</th>
              <th>Class</th>
              <th>Term</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {filteredFees.length > 0 ? (
              filteredFees.map((fee) => (
                <tr key={fee.id}>
                  <td>{fee.name}</td>
                  <td>{fee.className}</td>
                  <td>{fee.term}</td>
                  <td>
                    ₦{fee.amount.toLocaleString()}
                  </td>
                  <td>{fee.dueDate}</td>
                  <td>{fee.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#64748b",
                  }}
                >
                  No fee accounts found.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}