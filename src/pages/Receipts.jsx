import { useEffect, useState } from "react";

const API_URL = "https://predivic-school-fees-portal.onrender.com";

const formatCurrency = (amount) =>
  `\u20A6${Number(amount || 0).toLocaleString("en-NG")}`;

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getReceiptPrintMarkup = (payment) => `
  <div class="thermal-receipt">
    <div class="receipt-header">
      <h1>Predivic Schools</h1>
      <p>OFFICIAL PAYMENT RECEIPT</p>
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-meta">
      <div>
        <span>Receipt No.</span>
        <strong>${escapeHtml(payment.receiptNumber || "-")}</strong>
      </div>
      <div>
        <span>Date</span>
        <strong>${escapeHtml(formatDate(payment.paymentDate))}</strong>
      </div>
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-info">
      <div>
        <span>Student</span>
        <strong>${escapeHtml(payment.studentName || "-")}</strong>
      </div>
      <div>
        <span>Class</span>
        <strong>${escapeHtml(payment.className || "-")}</strong>
      </div>
      ${
        payment.admissionNumber
          ? `
            <div>
              <span>Admission No.</span>
              <strong>${escapeHtml(payment.admissionNumber)}</strong>
            </div>
          `
          : ""
      }
      <div>
        <span>Payment Method</span>
        <strong>${escapeHtml(payment.method || "-")}</strong>
      </div>
      ${
        payment.reference
          ? `
            <div>
              <span>Reference</span>
              <strong>${escapeHtml(payment.reference)}</strong>
            </div>
          `
          : ""
      }
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-items">
      <div class="receipt-item receipt-item-heading">
        <span>Description</span>
        <span>Amount</span>
      </div>
      <div class="receipt-item">
        <span>School Fee</span>
        <span>${escapeHtml(formatCurrency(payment.amount))}</span>
      </div>
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-total">
      <span>TOTAL PAID</span>
      <strong>${escapeHtml(formatCurrency(payment.amount))}</strong>
    </div>

    <div class="receipt-status">
      STATUS: ${escapeHtml(payment.status || "Paid")}
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-received">
      <span>Received by</span>
      <strong>Secretary</strong>
    </div>

    <div class="receipt-thanks">Thank you for your payment!</div>

    <div class="receipt-footer">
      <p>Please keep this receipt for your records.</p>
      <p>Predivic Schools</p>
    </div>
  </div>
`;

const printReceipt = (payment) => {
  const printWindow = window.open(
    "",
    "_blank",
    "width=302,height=800"
  );

  if (!printWindow) {
    throw new Error(
      "Unable to open the print window. Please allow pop-ups and try again."
    );
  }

  printWindow.addEventListener("afterprint", () => {
    printWindow.close();
  });

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(
          payment.receiptNumber || "Payment Receipt"
        )}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 80mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }

          .thermal-receipt {
            width: 80mm;
            padding: 3mm;
          }

          .receipt-header {
            text-align: center;
          }

          .receipt-header h1 {
            margin: 0 0 4px;
            font-size: 20px;
          }

          .receipt-header p {
            margin: 0;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .receipt-divider {
            border-top: 1px dashed #000000;
            margin: 10px 0;
          }

          .receipt-meta,
          .receipt-info {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .receipt-meta > div,
          .receipt-info > div,
          .receipt-received {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .receipt-meta strong,
          .receipt-info strong,
          .receipt-received strong {
            text-align: right;
          }

          .receipt-items {
            width: 100%;
          }

          .receipt-item {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 4px 0;
          }

          .receipt-item span:last-child {
            text-align: right;
            white-space: nowrap;
          }

          .receipt-item-heading {
            font-weight: 700;
            border-bottom: 1px solid #000000;
            padding-bottom: 5px;
          }

          .receipt-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 15px;
            font-weight: 700;
          }

          .receipt-total strong {
            font-size: 17px;
          }

          .receipt-status {
            text-align: center;
            margin-top: 8px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .receipt-received {
            margin-top: 8px;
          }

          .receipt-thanks {
            text-align: center;
            margin-top: 18px;
            font-weight: 700;
            font-size: 13px;
          }

          .receipt-footer {
            text-align: center;
            margin-top: 14px;
            font-size: 9px;
          }

          .receipt-footer p {
            margin: 3px 0;
          }
        </style>
      </head>
      <body>${getReceiptPrintMarkup(payment)}</body>
    </html>
  `);
  printWindow.document.close();
};

export default function Receipts() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handlePrint = (payment) => {
    try {
      printReceipt(payment);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to open the print window.");
    }
  };

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
              <div className="receipt-list-wrapper">
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
                        <td>{payment.receiptNumber || "-"}</td>

                        <td>{payment.studentName || "-"}</td>

                        <td>{payment.className || "-"}</td>

                        <td>School Fee</td>

                        <td>
                          {formatCurrency(payment.amount)}
                        </td>

                        <td>{payment.method || "-"}</td>

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
                                  payment.receiptNumber || "-"
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
            )}
          </div>
        </>
      ) : (
        <div className="receipt-screen">
          <div className="receipt-actions">
            <button
              className="primary-btn"
              onClick={() => handlePrint(selectedPayment)}
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
                  {selectedPayment.receiptNumber || "-"}
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
                  {selectedPayment.studentName || "-"}
                </strong>
              </div>

              <div>
                <span>Class</span>
                <strong>
                  {selectedPayment.className || "-"}
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
                  {selectedPayment.method || "-"}
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
