import { useState } from "react";

export default function Payments({
  students,
  feeAccounts,
  payments,
  setPayments,
}) {
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const [form, setForm] = useState({
    student: "",
    feeAccount: "",
    amount: "",
    method: "",
    date: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleStudentChange = (e) => {
    setForm({
      ...form,
      student: e.target.value,
    });
  };

  const handleFeeChange = (e) => {
    const selectedFee = feeAccounts.find(
      (fee) => fee.id === Number(e.target.value)
    );

    setForm({
      ...form,
      feeAccount: e.target.value,
      amount: selectedFee ? selectedFee.amount : "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !form.student ||
      !form.feeAccount ||
      !form.amount ||
      !form.method ||
      !form.date
    ) {
      alert("Please fill in all fields.");
      return;
    }

    const selectedStudent = students.find(
      (student) => student.name === form.student
    );

    const selectedFee = feeAccounts.find(
      (fee) => fee.id === Number(form.feeAccount)
    );

    if (!selectedStudent || !selectedFee) {
      alert("Please select a valid student and fee account.");
      return;
    }

    const newPayment = {
      id: Date.now(),
      student: selectedStudent.name,
      className: selectedStudent.className,
      feeAccount: selectedFee.name,
      amount: Number(form.amount),
      method: form.method,
      date: form.date,
      status: "Paid",
    };

    setPayments([...payments, newPayment]);

    setForm({
      student: "",
      feeAccount: "",
      amount: "",
      method: "",
      date: "",
    });

    setShowForm(false);
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.student
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      payment.feeAccount
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesClass =
      classFilter === "All Classes" ||
      payment.className === classFilter;

    const matchesMethod =
      methodFilter === "All Methods" ||
      payment.method === methodFilter;

    const matchesStatus =
      statusFilter === "All Status" ||
      payment.status === statusFilter;

    return (
      matchesSearch &&
      matchesClass &&
      matchesMethod &&
      matchesStatus
    );
  });

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <h1>Payments</h1>

        <button
          className="primary-btn"
          onClick={() => setShowForm(true)}
        >
          + Record Payment
        </button>
      </div>

      {/* RECORD PAYMENT FORM */}
      {showForm && (
        <div
          className="page-card"
          style={{ marginBottom: "25px" }}
        >
          <h2 style={{ marginBottom: "20px" }}>
            Record Payment
          </h2>

          <form onSubmit={handleSubmit}>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "15px",
              }}
            >

              {/* STUDENT */}
              <select
                name="student"
                value={form.student}
                onChange={handleStudentChange}
                className="filter-select"
              >
                <option value="">
                  Select Student
                </option>

                {students.map((student) => (
                  <option
                    key={student.id}
                    value={student.name}
                  >
                    {student.name} - {student.className}
                  </option>
                ))}
              </select>

              {/* FEE ACCOUNT */}
              <select
                name="feeAccount"
                value={form.feeAccount}
                onChange={handleFeeChange}
                className="filter-select"
              >
                <option value="">
                  Select Fee Account
                </option>

                {feeAccounts.map((fee) => (
                  <option
                    key={fee.id}
                    value={fee.id}
                  >
                    {fee.name} - {fee.className}
                  </option>
                ))}
              </select>

              {/* AMOUNT */}
              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={form.amount}
                onChange={handleChange}
                className="search-input"
              />

              {/* PAYMENT METHOD */}
              <select
                name="method"
                value={form.method}
                onChange={handleChange}
                className="filter-select"
              >
                <option value="">
                  Select Payment Method
                </option>

                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>POS</option>
                <option>Online</option>
              </select>

              {/* PAYMENT DATE */}
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="search-input"
              />

            </div>

            {/* FORM BUTTONS */}
            <div style={{ marginTop: "20px" }}>

              <button
                type="submit"
                className="primary-btn"
              >
                Save Payment
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

      {/* SEARCH AND FILTERS */}
      <div className="table-controls">

        <input
          type="text"
          placeholder="Search payment..."
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
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
        >
          <option>All Methods</option>
          <option>Cash</option>
          <option>Bank Transfer</option>
          <option>POS</option>
          <option>Online</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>Paid</option>
          <option>Pending</option>
          <option>Failed</option>
        </select>

      </div>

      {/* PAYMENTS TABLE */}
      <div className="page-card">

        <table>

          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Fee</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => (
                <tr key={payment.id}>

                  <td>{payment.student}</td>

                  <td>{payment.className}</td>

                  <td>{payment.feeAccount}</td>

                  <td>
                    ₦{payment.amount.toLocaleString()}
                  </td>

                  <td>{payment.method}</td>

                  <td>{payment.date}</td>

                  <td>{payment.status}</td>

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
                  No payments recorded yet.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}