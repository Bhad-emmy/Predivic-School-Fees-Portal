import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL = "https://predivic-school-fees-portal.onrender.com";
const formatMoney = (amount) =>
  `\u20A6${Number(amount || 0).toLocaleString("en-NG")}`;

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isToday = (date) => {
  if (!date) return "-";

  const today = new Date();
  const value = new Date(date);

  return (
    today.getFullYear() === value.getFullYear() &&
    today.getMonth() === value.getMonth() &&
    today.getDate() === value.getDate()
  );
};

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [feeAccounts, setFeeAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        studentsResponse,
        feeAccountsResponse,
        paymentsResponse,
        attendanceResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/api/students`),
        fetch(`${API_URL}/api/student-fee-accounts`),
        fetch(`${API_URL}/api/payments`),

        supabase
          .from("student_attendance")
          .select(`
            id,
            student_id,
            class_id,
            attendance_date,
            status
          `)
          .order("attendance_date", {
            ascending: false,
          })
          .limit(1000),
      ]);

      const studentsData =
        await studentsResponse.json();

      const feeAccountsData =
        await feeAccountsResponse.json();

      const paymentsData =
        await paymentsResponse.json();

      const attendanceResult =
        attendanceResponse;

      if (!studentsResponse.ok) {
        throw new Error(
          studentsData.error ||
            "Unable to load students."
        );
      }

      if (!feeAccountsResponse.ok) {
        throw new Error(
          feeAccountsData.error ||
            "Unable to load fee accounts."
        );
      }

      if (!paymentsResponse.ok) {
        throw new Error(
          paymentsData.error ||
            "Unable to load payments."
        );
      }

      if (attendanceResult.error) {
        console.warn(
          "Attendance could not be loaded:",
          attendanceResult.error
        );
      }

      setStudents(
        Array.isArray(studentsData)
          ? studentsData
          : studentsData.records || []
      );

      setFeeAccounts(
        Array.isArray(feeAccountsData)
          ? feeAccountsData
          : feeAccountsData.records || []
      );

      setPayments(
        Array.isArray(paymentsData)
          ? paymentsData
          : paymentsData.records || []
      );

      setAttendance(
        attendanceResult.data || []
      );
    } catch (err) {
      console.error(
        "DASHBOARD LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =====================================================
     STUDENT METRICS
  ===================================================== */

  const activeStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          String(student.status || "")
            .toLowerCase() === "active"
      ),
    [students]
  );

  /* =====================================================
     FINANCIAL METRICS
  ===================================================== */

  const financials = useMemo(() => {
    return feeAccounts.reduce(
      (totals, account) => {
        totals.expected += Number(
          account.totalAmount || 0
        );

        totals.collected += Number(
          account.totalPaid || 0
        );

        totals.outstanding += Number(
          account.balance || 0
        );

        return totals;
      },
      {
        expected: 0,
        collected: 0,
        outstanding: 0,
      }
    );
  }, [feeAccounts]);

  const paymentsToday = useMemo(
    () =>
      payments
        .filter((payment) =>
          isToday(payment.paymentDate)
        )
        .reduce(
          (sum, payment) =>
            sum + Number(payment.amount || 0),
          0
        ),
    [payments]
  );

  /* =====================================================
     ATTENDANCE METRICS
  ===================================================== */

  const todaysAttendance = useMemo(
    () =>
      attendance.filter((record) =>
        isToday(record.attendance_date)
      ),
    [attendance]
  );

  const presentToday = useMemo(
    () =>
      todaysAttendance.filter(
        (record) =>
          String(record.status || "")
            .toLowerCase() === "present"
      ).length,
    [todaysAttendance]
  );

  const absentToday = useMemo(
    () =>
      todaysAttendance.filter(
        (record) =>
          String(record.status || "")
            .toLowerCase() === "absent"
      ).length,
    [todaysAttendance]
  );

  const attendanceRate =
    presentToday + absentToday > 0
      ? Math.round(
          (presentToday /
            (presentToday + absentToday)) *
            100
        )
      : 0;

  /* =====================================================
     RECENT PAYMENTS
  ===================================================== */

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort(
          (a, b) =>
            new Date(
              b.paymentDate || 0
            ) -
            new Date(
              a.paymentDate || 0
            )
        )
        .slice(0, 5),
    [payments]
  );

  /* =====================================================
     RENDER
  ===================================================== */

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>

        <div className="page-card">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>

          <p
            style={{
              color: "#64748b",
              marginTop: "5px",
            }}
          >
            School overview and daily activity
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={loadData}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="page-card"
          style={{
            marginBottom: "20px",
            borderColor: "#fecaca",
          }}
        >
          <p
            style={{
              color: "#b91c1c",
              margin: 0,
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* =================================================
          MAIN STAT CARDS
      ================================================= */}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Students</h3>
          <h2 style={{ color: "#2563eb" }}>
            {activeStudents.length.toLocaleString()}
          </h2>
          <p>
            Active students
          </p>
        </div>

        <div className="stat-card">
          <h3>Total Fees Expected</h3>
          <h2 style={{ color: "#7c3aed" }}>
            {formatMoney(
              financials.expected
            )}
          </h2>
          <p>
            Assigned fee accounts
          </p>
        </div>

        <div className="stat-card">
          <h3>Total Collected</h3>
          <h2 style={{ color: "#16a34a" }}>
            {formatMoney(
              financials.collected
            )}
          </h2>
          <p>
            Recorded payments
          </p>
        </div>

        <div className="stat-card">
          <h3>Outstanding Fees</h3>
          <h2 style={{ color: "#dc2626" }}>
            {formatMoney(
              financials.outstanding
            )}
          </h2>
          <p>
            Remaining balance
          </p>
        </div>

        <div className="stat-card">
          <h3>Payments Today</h3>
          <h2 style={{ color: "#f59e0b" }}>
            {formatMoney(
              paymentsToday
            )}
          </h2>
          <p>
            Today's collections
          </p>
        </div>
      </div>

      {/* =================================================
          ATTENDANCE
      ================================================= */}

      <div className="dashboard-section-grid">
        <div className="table-section">
          <div className="section-heading">
            <div>
              <h2>Today's Attendance</h2>
              <p>
                Student attendance recorded today
              </p>
            </div>
          </div>

          <div className="attendance-summary">
            <div className="attendance-box">
              <span>Present</span>
              <strong>
                {presentToday}
              </strong>
            </div>

            <div className="attendance-box">
              <span>Absent</span>
              <strong>
                {absentToday}
              </strong>
            </div>

            <div className="attendance-box">
              <span>Rate</span>
              <strong>
                {attendanceRate}%
              </strong>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="section-heading">
            <div>
              <h2>Fee Collection</h2>
              <p>
                Current student fee accounts
              </p>
            </div>
          </div>

          <div className="attendance-summary">
            <div className="attendance-box">
              <span>Expected</span>
              <strong>
                {formatMoney(
                  financials.expected
                )}
              </strong>
            </div>

            <div className="attendance-box">
              <span>Collected</span>
              <strong>
                {formatMoney(
                  financials.collected
                )}
              </strong>
            </div>

            <div className="attendance-box">
              <span>Outstanding</span>
              <strong>
                {formatMoney(
                  financials.outstanding
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================
          RECENT PAYMENTS
      ================================================= */}

      <div className="table-section">
        <div className="section-heading">
          <div>
            <h2>Recent Payments</h2>
            <p>
              Latest recorded school fee payments
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {recentPayments.length > 0 ? (
                recentPayments.map(
                  (payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>
                          {payment.studentName ||
                            "Unknown Student"}
                        </strong>
                      </td>

                      <td>
                        {payment.className ||
                          "-"}
                      </td>

                      <td>
                        {formatMoney(
                          payment.amount
                        )}
                      </td>

                      <td>
                        {payment.method ||
                          ""-""}
                      </td>

                      <td>
                        {formatDate(
                          payment.paymentDate
                        )}
                      </td>

                      <td>
                        {payment.status ||
                          "-"}
                      </td>
                    </tr>
                  )
                )
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
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================
          EMPTY ATTENDANCE NOTICE
      ================================================= */}

      {todaysAttendance.length === 0 && (
        <div
          className="page-card"
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          No student attendance has been recorded
          today.
        </div>
      )}
    </div>
  );
}
