import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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
  if (!date) return false;

  const today = new Date();
  const value = new Date(date);

  return (
    today.getFullYear() === value.getFullYear() &&
    today.getMonth() === value.getMonth() &&
    today.getDate() === value.getDate()
  );
};

const getLocalDateKey = () => {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
};

const isSuccessfulPayment = (status) =>
  ["paid", "successful", "completed"].includes(
    String(status || "").toLowerCase()
  );

export default function Dashboard() {
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [feeAccounts, setFeeAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentsTodayAmount, setPaymentsTodayAmount] = useState(0);
  const [attendance, setAttendance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      // Dashboard-specific queries only. Avoid loading full student,
      // fee-account, payment, and attendance datasets just to calculate
      // a small set of dashboard metrics.
      const [
        studentsResult,
        feeAccountsResult,
        paymentsResult,
        attendanceResult,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .ilike("status", "active"),
        supabase
          .from("student_fee_accounts")
          .select("id, fee_account_id, total_amount"),
        supabase
          .from("payments")
          .select(
            "id, student_id, student_fee_account_id, fee_account_id, amount, payment_date, method, status"
          )
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("student_attendance")
          .select("id, student_id, class_id, attendance_date, status")
          .eq("attendance_date", getLocalDateKey()),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (feeAccountsResult.error) throw feeAccountsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      if (attendanceResult.error) {
        console.warn(
          "Attendance could not be loaded:",
          attendanceResult.error
        );
      }

      const feeAccountRows = feeAccountsResult.data || [];
      const paymentRows = paymentsResult.data || [];

      const paidByFeeAccount = new Map();

      for (const payment of paymentRows) {
        if (!isSuccessfulPayment(payment.status)) continue;

        const accountId = payment.student_fee_account_id;
        if (!accountId) continue;

        paidByFeeAccount.set(
          accountId,
          (paidByFeeAccount.get(accountId) || 0) +
            Number(payment.amount || 0)
        );
      }

      const dashboardFeeAccounts = feeAccountRows.map((account) => {
        const totalAmount = Number(account.total_amount || 0);
        const totalPaid = Number(paidByFeeAccount.get(account.id) || 0);

        return {
          id: account.id,
          feeAccountId: account.fee_account_id,
          totalAmount,
          totalPaid,
          balance: Math.max(totalAmount - totalPaid, 0),
        };
      });

      // Only enrich the five rows actually displayed in the dashboard.
      const recentBase = paymentRows.slice(0, 5);
      const recentStudentIds = [
        ...new Set(
          recentBase.map((payment) => payment.student_id).filter(Boolean)
        ),
      ];

      const recentFeeAccountIds = [
        ...new Set(
          recentBase
            .map(
              (payment) =>
                payment.fee_account_id ||
                feeAccountRows.find(
                  (account) => account.id === payment.student_fee_account_id
                )?.fee_account_id
            )
            .filter(Boolean)
        ),
      ];

      const [recentStudentsResult, recentFeeAccountsResult] =
        await Promise.all([
          recentStudentIds.length
            ? supabase
                .from("students")
                .select("id, first_name, middle_name, last_name")
                .in("id", recentStudentIds)
            : Promise.resolve({ data: [], error: null }),
          recentFeeAccountIds.length
            ? supabase
                .from("fee_accounts")
                .select("id, class_id")
                .in("id", recentFeeAccountIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (recentStudentsResult.error) throw recentStudentsResult.error;
      if (recentFeeAccountsResult.error) throw recentFeeAccountsResult.error;

      const classIds = [
        ...new Set(
          (recentFeeAccountsResult.data || [])
            .map((account) => account.class_id)
            .filter(Boolean)
        ),
      ];

      const classesResult = classIds.length
        ? await supabase
            .from("classes")
            .select("id, name")
            .in("id", classIds)
        : { data: [], error: null };

      if (classesResult.error) throw classesResult.error;

      const studentMap = new Map(
        (recentStudentsResult.data || []).map((student) => [
          student.id,
          student,
        ])
      );

      const feeAccountMap = new Map(
        (recentFeeAccountsResult.data || []).map((account) => [
          account.id,
          account,
        ])
      );

      const classMap = new Map(
        (classesResult.data || []).map((item) => [item.id, item.name])
      );

      const enrichedPayments = recentBase.map((payment) => {
        const student = studentMap.get(payment.student_id);
        const feeAccountId =
          payment.fee_account_id ||
          feeAccountRows.find(
            (account) => account.id === payment.student_fee_account_id
          )?.fee_account_id;
        const feeAccount = feeAccountMap.get(feeAccountId);

        return {
          id: payment.id,
          studentName: student
            ? [student.first_name, student.middle_name, student.last_name]
                .filter(Boolean)
                .join(" ")
            : "Unknown Student",
          className: classMap.get(feeAccount?.class_id) || "Unknown Class",
          amount: Number(payment.amount || 0),
          method: payment.method || "",
          paymentDate: payment.payment_date,
          status: isSuccessfulPayment(payment.status)
            ? "Paid"
            : payment.status || "Unknown",
        };
      });

      const paymentsTodayTotal = paymentRows
        .filter((payment) => isToday(payment.payment_date))
        .reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0
        );

      setActiveStudentCount(studentsResult.count || 0);
      setFeeAccounts(dashboardFeeAccounts);
      setPayments(enrichedPayments);
      setPaymentsTodayAmount(paymentsTodayTotal);
      setAttendance(attendanceResult.data || []);
    } catch (err) {
      console.error("DASHBOARD LOAD ERROR:", err);
      setError(err.message || "Unable to load dashboard data.");
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

  const activeStudents = activeStudentCount;

  /* =====================================================
     FINANCIAL METRICS
  ===================================================== */

  const financials = useMemo(() => {
    return feeAccounts.reduce(
      (totals, account) => {
        totals.expected += Number(account.totalAmount || 0);
        totals.collected += Number(account.totalPaid || 0);
        totals.outstanding += Number(account.balance || 0);

        return totals;
      },
      {
        expected: 0,
        collected: 0,
        outstanding: 0,
      }
    );
  }, [feeAccounts]);

  const paymentsToday = paymentsTodayAmount;

  /* =====================================================
     ATTENDANCE METRICS
  ===================================================== */

  const todaysAttendance = attendance;

  const presentToday = useMemo(
    () =>
      todaysAttendance.filter(
        (record) =>
          String(record.status || "").toLowerCase() === "present"
      ).length,
    [todaysAttendance]
  );

  const absentToday = useMemo(
    () =>
      todaysAttendance.filter(
        (record) =>
          String(record.status || "").toLowerCase() === "absent"
      ).length,
    [todaysAttendance]
  );

  const attendanceRate =
    presentToday + absentToday > 0
      ? Math.round(
          (presentToday / (presentToday + absentToday)) * 100
        )
      : 0;

  /* =====================================================
     RECENT PAYMENTS
  ===================================================== */

  const recentPayments = payments;

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

        <button className="primary-btn" onClick={loadData}>
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
            {activeStudents.toLocaleString()}
          </h2>
          <p>Active students</p>
        </div>

        <div className="stat-card">
          <h3>Total Fees Expected</h3>
          <h2 style={{ color: "#7c3aed" }}>
            {formatMoney(financials.expected)}
          </h2>
          <p>Assigned fee accounts</p>
        </div>

        <div className="stat-card">
          <h3>Total Collected</h3>
          <h2 style={{ color: "#16a34a" }}>
            {formatMoney(financials.collected)}
          </h2>
          <p>Recorded payments</p>
        </div>

        <div className="stat-card">
          <h3>Outstanding Fees</h3>
          <h2 style={{ color: "#dc2626" }}>
            {formatMoney(financials.outstanding)}
          </h2>
          <p>Remaining balance</p>
        </div>

        <div className="stat-card">
          <h3>Payments Today</h3>
          <h2 style={{ color: "#f59e0b" }}>
            {formatMoney(paymentsToday)}
          </h2>
          <p>Today's collections</p>
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
              <p>Student attendance recorded today</p>
            </div>
          </div>

          <div className="attendance-summary">
            <div className="attendance-box">
              <span>Present</span>
              <strong>{presentToday}</strong>
            </div>

            <div className="attendance-box">
              <span>Absent</span>
              <strong>{absentToday}</strong>
            </div>

            <div className="attendance-box">
              <span>Rate</span>
              <strong>{attendanceRate}%</strong>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="section-heading">
            <div>
              <h2>Fee Collection</h2>
              <p>Current student fee accounts</p>
            </div>
          </div>

          <div className="attendance-summary">
            <div className="attendance-box">
              <span>Expected</span>
              <strong>{formatMoney(financials.expected)}</strong>
            </div>

            <div className="attendance-box">
              <span>Collected</span>
              <strong>{formatMoney(financials.collected)}</strong>
            </div>

            <div className="attendance-box">
              <span>Outstanding</span>
              <strong>{formatMoney(financials.outstanding)}</strong>
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
            <p>Latest recorded school fee payments</p>
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
                recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>
                        {payment.studentName || "Unknown Student"}
                      </strong>
                    </td>

                    <td>{payment.className || "-"}</td>

                    <td>{formatMoney(payment.amount)}</td>

                    <td>{payment.method || "-"}</td>

                    <td>{formatDate(payment.paymentDate)}</td>

                    <td>{payment.status || "-"}</td>
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
          No student attendance has been recorded today.
        </div>
      )}
    </div>
  );
}
