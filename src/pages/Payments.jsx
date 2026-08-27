import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000";
const EMPTY_PAYMENT = {
  studentFeeAccountId: "",
  amount: "",
  method: "Cash",
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: "",
  reference: "",
};

const formatAmount = (amount) =>
  "₦" + Number(amount || 0).toLocaleString();

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [studentFeeAccounts, setStudentFeeAccounts] =
    useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_PAYMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] =
    useState("All Classes");
  const [methodFilter, setMethodFilter] =
    useState("All Methods");

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      setError("");
      const responses = await Promise.all([
        fetch(API_URL + "/api/payments"),
        fetch(API_URL + "/api/student-fee-accounts"),
        fetch(API_URL + "/api/classes"),
      ]);
      const data = await Promise.all(
        responses.map((response) => response.json())
      );

      if (!responses[0].ok) {
        throw new Error(
          data[0].error || "Unable to load payments."
        );
      }
      if (!responses[1].ok) {
        throw new Error(
          data[1].error ||
            "Unable to load fee accounts."
        );
      }
      if (!responses[2].ok) {
        throw new Error(
          data[2].error || "Unable to load classes."
        );
      }

      setPayments(data[0]);
      setStudentFeeAccounts(data[1]);
      setClasses(data[2]);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to load payment data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentData();
  }, []);

  const payableAccounts = useMemo(
    () =>
      studentFeeAccounts.filter(
        (account) => Number(account.balance) > 0
      ),
    [studentFeeAccounts]
  );

  const selectedAccount = useMemo(
    () =>
      studentFeeAccounts.find(
        (account) =>
          account.id === form.studentFeeAccountId
      ) || null,
    [
      form.studentFeeAccountId,
      studentFeeAccounts,
    ]
  );

  const availableClasses = useMemo(
    () =>
      classes
        .map((schoolClass) => schoolClass.name)
        .filter(Boolean),
    [classes]
  );

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        [
          payment.studentName,
          payment.admissionNo,
          payment.receiptNumber,
          payment.reference,
        ]
          .filter(Boolean)
          .some((value) =>
            value.toLowerCase().includes(query)
          );

      return (
        matchesSearch &&
        (classFilter === "All Classes" ||
          payment.className === classFilter) &&
        (methodFilter === "All Methods" ||
          payment.method === methodFilter)
      );
    });
  }, [
    payments,
    search,
    classFilter,
    methodFilter,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_PAYMENT,
      paymentDate: new Date()
        .toISOString()
        .slice(0, 10),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedAccount) {
      setError("Select a student fee account.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        "Enter a payment amount greater than zero."
      );
      return;
    }
    if (amount > Number(selectedAccount.balance)) {
      setError(
        "Amount cannot exceed the outstanding balance of " +
          formatAmount(selectedAccount.balance) +
          "."
      );
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        API_URL + "/api/payments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentId: selectedAccount.studentId,
            studentFeeAccountId: selectedAccount.id,
            amount,
            method: form.method,
            paymentDate: form.paymentDate,
            notes: form.notes,
            reference: form.reference,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to record payment."
        );
      }

      setSuccess(
        "Payment recorded. Receipt number: " +
          data.receiptNumber +
          ". Remaining balance: " +
          formatAmount(data.balance) +
          "."
      );
      setShowForm(false);
      resetForm();
      await loadPaymentData();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Payments</h1>
        <button
          className="primary-btn"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(true);
          }}
        >
          + Record Payment
        </button>
      </div>

      {error && (
        <p
          style={{
            color: "#b91c1c",
            marginBottom: "15px",
          }}
        >
          {error}
        </p>
      )}
      {success && (
        <p
          style={{
            color: "#166534",
            marginBottom: "15px",
          }}
        >
          {success}
        </p>
      )}

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
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "15px",
              }}
            >
              <select
                name="studentFeeAccountId"
                value={form.studentFeeAccountId}
                onChange={handleChange}
                className="filter-select"
                required
              >
                <option value="">
                  Select student fee account
                </option>
                {payableAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.student?.fullName ||
                      "Unknown Student"}{" "}
                    — {account.className} —{" "}
                    {account.term} (
                    {formatAmount(account.balance)} due)
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                max={
                  selectedAccount?.balance || undefined
                }
                placeholder="Amount"
                value={form.amount}
                onChange={handleChange}
                className="search-input"
                required
              />

              <select
                name="method"
                value={form.method}
                onChange={handleChange}
                className="filter-select"
                required
              >
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>POS</option>
                <option>Online</option>
              </select>

              <input
                type="date"
                name="paymentDate"
                value={form.paymentDate}
                onChange={handleChange}
                className="search-input"
                required
              />

              <input
                type="text"
                name="reference"
                placeholder="Reference (optional)"
                value={form.reference}
                onChange={handleChange}
                className="search-input"
              />

              <input
                type="text"
                name="notes"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={handleChange}
                className="search-input"
              />
            </div>

            {selectedAccount && (
              <p
                style={{
                  marginTop: "15px",
                  color: "#475569",
                }}
              >
                Outstanding balance:{" "}
                {formatAmount(selectedAccount.balance)}
              </p>
            )}

            <div style={{ marginTop: "20px" }}>
              <button
                type="submit"
                className="primary-btn"
                disabled={saving}
              >
                {saving
                  ? "Recording..."
                  : "Save Payment"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={{ marginLeft: "10px" }}
                disabled={saving}
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
          placeholder="Search student, admission number, receipt, or reference..."
          className="search-input"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
        <select
          className="filter-select"
          value={classFilter}
          onChange={(event) =>
            setClassFilter(event.target.value)
          }
        >
          <option>All Classes</option>
          {availableClasses.map((className) => (
            <option key={className}>
              {className}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={methodFilter}
          onChange={(event) =>
            setMethodFilter(event.target.value)
          }
        >
          <option>All Methods</option>
          <option>Cash</option>
          <option>Bank Transfer</option>
          <option>POS</option>
          <option>Online</option>
        </select>
      </div>

      <div
        className="page-card"
        style={{ overflowX: "auto" }}
      >
        {loading ? (
          <p>Loading payments...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Student</th>
                <th>Class</th>
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
                    <td>
                      {payment.receiptNumber || "—"}
                    </td>
                    <td>{payment.studentName}</td>
                    <td>{payment.className}</td>
                    <td>
                      {formatAmount(payment.amount)}
                    </td>
                    <td>{payment.method}</td>
                    <td>
                      {new Date(
                        payment.paymentDate
                      ).toLocaleDateString("en-NG")}
                    </td>
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
        )}
      </div>
    </div>
  );
}
