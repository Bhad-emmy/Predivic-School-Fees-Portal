import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

export default function Receipts() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const response = await fetch(
          API_URL + "/api/payments"
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load receipts."
          );
        }

        setPayments(data);
      } catch (err) {
        console.error(err);
        setError(
          err.message ||
            "Unable to load receipts."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, []);

  return (
    <div className="page">

      <div className="page-header">
        <h1>Receipts</h1>
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

      {!selectedPayment ? (
        <div className="page-card">

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

                    <td>
                      {payment.receiptNumber || "—"}
                    </td>

                    <td>{payment.studentName}</td>

                    <td>{payment.className}</td>

                    <td>School Fee</td>

                    <td>
                      ₦{Number(payment.amount).toLocaleString()}
                    </td>

                    <td>{payment.method}</td>

                    <td>
                      {new Date(
                        payment.paymentDate
                      ).toLocaleDateString("en-NG")}
                    </td>

                    <td>
                      <button
                        className="primary-btn"
                        onClick={() =>
                          setSelectedPayment({
                            ...payment,
                            receiptNumber:
                              payment.receiptNumber ||
                              "—",
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
      ) : (
        <div className="page-card">

          <div
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              padding: "40px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#ffffff",
            }}
          >

            {/* RECEIPT HEADER */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "30px",
              }}
            >
              <h1
                style={{
                  marginBottom: "8px",
                  color: "#1f2a44",
                }}
              >
                Predivic Schools
              </h1>

              <p
                style={{
                  color: "#64748b",
                  marginBottom: "5px",
                }}
              >
                Official Payment Receipt
              </p>

              <strong>
                {selectedPayment.receiptNumber}
              </strong>
            </div>

            {/* STUDENT INFORMATION */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
                marginBottom: "25px",
              }}
            >

              <div>
                <strong>Student</strong>
                <p>{selectedPayment.studentName}</p>
              </div>

              <div>
                <strong>Class</strong>
                <p>{selectedPayment.className}</p>
              </div>

              <div>
                <strong>Payment Date</strong>
                <p>
                  {new Date(
                    selectedPayment.paymentDate
                  ).toLocaleDateString("en-NG")}
                </p>
              </div>

              <div>
                <strong>Payment Method</strong>
                <p>{selectedPayment.method}</p>
              </div>

            </div>

            {/* PAYMENT DETAILS */}
            <table style={{ marginBottom: "25px" }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>School Fee</td>

                  <td>
                    ₦{Number(
                      selectedPayment.amount
                    ).toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <th>Total Paid</th>

                  <th>
                    ₦{Number(
                      selectedPayment.amount
                    ).toLocaleString()}
                  </th>
                </tr>
              </tbody>
            </table>

            {/* STATUS */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "30px",
              }}
            >
              <strong>
                Status: {selectedPayment.status}
              </strong>
            </div>

            {/* ACTIONS */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
              }}
            >

              <button
                className="primary-btn"
                onClick={() => window.print()}
              >
                Print Receipt
              </button>

              <button
                className="primary-btn"
                onClick={() => setSelectedPayment(null)}
                style={{
                  background: "#64748b",
                }}
              >
                Back to Receipts
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
