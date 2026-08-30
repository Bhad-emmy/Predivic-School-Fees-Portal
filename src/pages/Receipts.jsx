import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

const formatCurrency = (amount) =>
  `₦${Number(amount || 0).toLocaleString("en-NG")}`;

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function Receipts() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payments`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load receipts.");
        }

        setPayments(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load receipts.");
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, []);

  return (
    <div className="page receipts-page">
      {!selectedPayment ? (
        <>
          <div className="page-header receipts-list-header">
            <h1>Receipts</h1>
          </div>

          {error && (
            <p className="receipt-error">
              {error}
            </p>
          )}

          <div className="page-card receipt-list-card">
            {loading ? (
              <p>Loading receipts...</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Fee</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.receiptNumber || "—"}</td>

                        <td>{payment.studentName || "—"}</td>

                        <td>{payment.className || "—"}</td>

                        <td>School Fee</td>

                        <td>
                          {formatCurrency(payment.amount)}
                        </td>

                        <td>{payment.method || "—"}</td>

                        <td>
                          {formatDate(payment.paymentDate)}
                        </td>

                        <td>
                          <button
                            className="primary-btn"
                            onClick={() =>
                              setSelectedPayment({
                                ...payment,
                                receiptNumber:
                                  payment.receiptNumber || "—",
                              })
                            }
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "#64748b",
                        }}
                      >
                        No receipts available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="receipt-screen">
          <div className="receipt-actions">
            <button
              className="primary-btn"
              onClick={() => window.print()}
            >
              Print Receipt
            </button>

            <button
              className="secondary-btn"
              onClick={() => setSelectedPayment(null)}
            >
              Back to Receipts
            </button>
          </div>

          <div className="thermal-receipt">
            <div className="receipt-header">
              <h1>Predivic Schools</h1>
              <p>OFFICIAL PAYMENT RECEIPT</p>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-meta">
              <div>
                <span>Receipt No.</span>
                <strong>
                  {selectedPayment.receiptNumber || "—"}
                </strong>
              </div>

              <div>
                <span>Date</span>
                <strong>
                  {formatDate(selectedPayment.paymentDate)}
                </strong>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-info">
              <div>
                <span>Student</span>
                <strong>
                  {selectedPayment.studentName || "—"}
                </strong>
              </div>

              <div>
                <span>Class</span>
                <strong>
                  {selectedPayment.className || "—"}
                </strong>
              </div>

              {selectedPayment.admissionNumber && (
                <div>
                  <span>Admission No.</span>
                  <strong>
                    {selectedPayment.admissionNumber}
                  </strong>
                </div>
              )}

              <div>
                <span>Payment Method</span>
                <strong>
                  {selectedPayment.method || "—"}
                </strong>
              </div>

              {selectedPayment.reference && (
                <div>
                  <span>Reference</span>
                  <strong>
                    {selectedPayment.reference}
                  </strong>
                </div>
              )}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-items">
              <div className="receipt-item receipt-item-heading">
                <span>Description</span>
                <span>Amount</span>
              </div>

              <div className="receipt-item">
                <span>School Fee</span>
                <span>
                  {formatCurrency(selectedPayment.amount)}
                </span>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-total">
              <span>TOTAL PAID</span>
              <strong>
                {formatCurrency(selectedPayment.amount)}
              </strong>
            </div>

            <div className="receipt-status">
              STATUS: {selectedPayment.status || "Paid"}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-received">
              <span>Received by</span>
              <strong>Secretary</strong>
            </div>

            <div className="receipt-thanks">
              Thank you for your payment!
            </div>

            <div className="receipt-footer">
              <p>Please keep this receipt for your records.</p>
              <p>Predivic Schools</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}