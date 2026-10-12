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

const getAttendanceRange = () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Find Monday of the current week, then build Monday through Friday in order.
  const monday = new Date(today);
  const dayOfWeek = monday.getDay();
  monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });

  const key = (value) =>
    [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");

  return { days, start: key(days[0]), end: key(days[days.length - 1]) };
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
  const [monthlyCollections, setMonthlyCollections] = useState([]);
  const [weeklyAttendance, setWeeklyAttendance] = useState([]);
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
      const attendanceRange = getAttendanceRange();
      const todayKey = getLocalDateKey();
      // Never count future-dated attendance, even if records exist in the database.
      const attendanceEnd =
        attendanceRange.end < todayKey ? attendanceRange.end : todayKey;

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
          .gte("attendance_date", attendanceRange.start)
          .lte("attendance_date", attendanceEnd),
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

      // Build a six-month trend from successful recorded payments.
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        const key = String(monthDate.getFullYear()) + "-" + String(monthDate.getMonth() + 1).padStart(2, "0");
        return {
          key,
          label: monthDate.toLocaleDateString("en-NG", { month: "short" }),
          total: 0,
        };
      });
      const monthTotals = new Map(months.map((month) => [month.key, month]));
      for (const payment of paymentRows) {
        if (!isSuccessfulPayment(payment.status) || !payment.payment_date) continue;
        const date = new Date(payment.payment_date);
        if (Number.isNaN(date.getTime())) continue;
        const key = String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
        const month = monthTotals.get(key);
        if (month) month.total += Number(payment.amount || 0);
      }

      const attendanceRows = attendanceResult.data || [];
      const weekDays = attendanceRange.days.map((date) => {
        const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
        return { key, label: date.toLocaleDateString("en-NG", { weekday: "short" }), present: 0, absent: 0 };
      });
      const dayMap = new Map(weekDays.map((day) => [day.key, day]));
      for (const record of attendanceRows) {
        const day = dayMap.get(record.attendance_date);
        if (!day) continue;
        const status = String(record.status || "").toLowerCase();
        if (status === "present") day.present += 1;
        if (status === "absent") day.absent += 1;
      }

      setWeeklyAttendance(weekDays);
      setMonthlyCollections(months);
      setActiveStudentCount(studentsResult.count || 0);
      setFeeAccounts(dashboardFeeAccounts);
      setPayments(enrichedPayments);
      setPaymentsTodayAmount(paymentsTodayTotal);
      setAttendance(attendanceRows.filter((record) => record.attendance_date === getLocalDateKey()));
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
          COLLECTION TRENDS
      ================================================= */}

      <div className="dashboard-charts-grid">
        <section className="table-section dashboard-chart-card">
          <div className="section-heading">
            <div>
              <h2>Monthly Fee Collections</h2>
              <p>Successful payments recorded over the last six months</p>
            </div>
          </div>

          {monthlyCollections.some((month) => month.total > 0) ? (
            <div className="collection-chart" role="img" aria-label="Monthly successful payment totals for the last six months">
              {monthlyCollections.map((month) => {
                const maxTotal = Math.max(...monthlyCollections.map((item) => item.total), 1);
                const height = Math.max((month.total / maxTotal) * 100, month.total > 0 ? 5 : 0);
                return (
                  <div className="collection-chart-column" key={month.key}>
                    <span className="collection-chart-value">
                      {month.total > 0 ? formatMoney(month.total) : "₦0"}
                    </span>
                    <div className="collection-chart-track">
                      <div className="collection-chart-bar" style={{ height: height + "%" }} />
                    </div>
                    <span className="collection-chart-label">{month.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-chart-empty">
              No successful payment data available for the last six months.
            </div>
          )}
        </section>

        <section className="table-section dashboard-chart-card attendance-chart-card">
          <div className="section-heading">
            <div>
              <h2>Weekly Attendance</h2>
              <p>Present and absent records over the last seven days</p>
            </div>
          </div>
          {weeklyAttendance.some((day) => day.present + day.absent > 0) ? (
            <div className="weekly-attendance-chart" role="img" aria-label="Present and absent attendance counts for the last seven days">
              {weeklyAttendance.map((day) => {
                const maxCount = Math.max(...weeklyAttendance.map((item) => Math.max(item.present, item.absent)), 1);
                return (
                  <div className="weekly-attendance-column" key={day.key}>
                    <div className="weekly-attendance-bars">
                      <div className="weekly-attendance-bar present" style={{ height: (day.present / maxCount * 100) + "%" }} title={"Present: " + day.present} />
                      <div className="weekly-attendance-bar absent" style={{ height: (day.absent / maxCount * 100) + "%" }} title={"Absent: " + day.absent} />
                    </div>
                    <span>{day.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-chart-empty">No attendance records found for the last seven days.</div>
          )}
          <div className="attendance-chart-legend">
            <span><i className="attendance-legend-dot present" /> Present</span>
            <span><i className="attendance-legend-dot absent" /> Absent</span>
          </div>
        </section>

        <section className="table-section dashboard-chart-card">
          <div className="section-heading">
            <div>
              <h2>Fee Collection Progress</h2>
              <p>Collected against total expected fees</p>
            </div>
          </div>

          <div className="fee-progress-summary">
            <strong>{financials.expected > 0 ? Math.min(Math.round((financials.collected / financials.expected) * 100), 100) : 0}%</strong>
            <span>of expected fees collected</span>
          </div>
          <div className="fee-progress-track" aria-label="Percentage of expected fees collected">
            <div
              className="fee-progress-fill"
              style={{ width: (financials.expected > 0 ? Math.min((financials.collected / financials.expected) * 100, 100) : 0) + "%" }}
            />
          </div>
          <div className="fee-progress-legend">
            <div><span className="fee-legend-dot collected" /> <span>Collected</span><strong>{formatMoney(financials.collected)}</strong></div>
            <div><span className="fee-legend-dot outstanding" /> <span>Outstanding</span><strong>{formatMoney(financials.outstanding)}</strong></div>
          </div>
        </section>
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

      <div className="table-section recent-payments-section">
        <div className="section-heading">
          <div>
            <h2>Recent Payments</h2>
            <p>Latest recorded school fee payments</p>
          </div>
        </div>

        <div className="recent-payments-table-wrap" role="region" aria-label="Recent payments table" tabIndex={0}>
          <table className="recent-payments-table">
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
        <p className="recent-payments-scroll-hint">Swipe horizontally to view all payment details.</p>
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
