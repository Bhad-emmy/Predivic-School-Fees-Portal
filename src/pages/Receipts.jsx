import { useState } from "react";

export default function Receipts({ payments }) {
  const [selectedPayment, setSelectedPayment] = useState(null);

  const formatReceiptNumber = (index) => {
    return `REC-${String(index + 1).padStart(4, "0")}`;
  };

  return (
    <div className="page">

      <div className="page-header">
        <h1>Receipts</h1>
      </div>

      {!selectedPayment ? (
        <div className="page-card">

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
                payments.map((payment, index) => (
                  <tr key={payment.id}>

                    <td>
                      {formatReceiptNumber(index)}
                    </td>

                    <td>{payment.student}</td>

                    <td>{payment.className}</td>

                    <td>{payment.feeAccount}</td>

                    <td>
                      ₦{payment.amount.toLocaleString()}
                    </td>

                    <td>{payment.method}</td>

                    <td>{payment.date}</td>

                    <td>
                      <button
                        className="primary-btn"
                        onClick={() =>
                          setSelectedPayment({
                            ...payment,
                            receiptNumber:
                              formatReceiptNumber(index),
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
                Predvic Schools
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
                <p>{selectedPayment.student}</p>
              </div>

              <div>
                <strong>Class</strong>
                <p>{selectedPayment.className}</p>
              </div>

              <div>
                <strong>Payment Date</strong>
                <p>{selectedPayment.date}</p>
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
                  <td>{selectedPayment.feeAccount}</td>

                  <td>
                    ₦{selectedPayment.amount.toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <th>Total Paid</th>

                  <th>
                    ₦{selectedPayment.amount.toLocaleString()}
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