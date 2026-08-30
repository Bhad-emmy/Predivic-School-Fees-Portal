import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL = "https://predivic-school-fees-portal.onrender.com";

const formatMoney = (amount) =>
  `₦${Number(amount || 0).toLocaleString("en-NG")}`;

const formatDate = (date) => {
  if (!date) return "—";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "—";

  return value.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Reports() {
  const [students, setStudents] = useState([]);
  const [feeAccounts, setFeeAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [reportType, setReportType] = useState("finance");
  const [classFilter, setClassFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
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
          .limit(5000),
      ]);

      const studentsData =
        await studentsResponse.json();

      const feeAccountsData =
        await feeAccountsResponse.json();

      const paymentsData =
        await paymentsResponse.json();

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

      if (attendanceResponse.error) {
        throw new Error(
          attendanceResponse.error.message ||
            "Unable to load attendance."
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
        attendanceResponse.data || []
      );
    } catch (err) {
      console.error(
        "REPORTS LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  /* =====================================================
     STUDENT LOOKUP
  ===================================================== */

  const studentMap = useMemo(() => {
    const map = new Map();

    students.forEach((student) => {
      map.set(String(student.id), student);
    });

    return map;
  }, [students]);

  /* =====================================================
     CLASS LIST
  ===================================================== */

  const classes = useMemo(() => {
    const values = new Set();

    students.forEach((student) => {
      const className =
        student.className ||
        student.class_name ||
        student.class ||
        "";

      if (className) {
        values.add(className);
      }
    });

    return [...values].sort();
  }, [students]);

  /* =====================================================
     DATE FILTER
  ===================================================== */

  const isWithinDateRange = (date) => {
    if (!date) return false;

    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
      return false;
    }

    if (startDate) {
      const start = new Date(
        `${startDate}T00:00:00`
      );

      if (value < start) {
        return false;
      }
    }

    if (endDate) {
      const end = new Date(
        `${endDate}T23:59:59`
      );

      if (value > end) {
        return false;
      }
    }

    return true;
  };

  /* =====================================================
     ENRICH ATTENDANCE RECORDS
  ===================================================== */

  const enrichedAttendance = useMemo(() => {
    return attendance.map((record) => {
      const student = studentMap.get(
        String(record.student_id)
      );

      const studentName =
        student?.name ||
        student?.fullName ||
        student?.full_name ||
        "Unknown Student";

      const className =
        student?.className ||
        student?.class_name ||
        student?.class ||
        "Unknown Class";

      return {
        ...record,
        studentName,
        className,
      };
    });
  }, [attendance, studentMap]);

  /* =====================================================
     FILTERED PAYMENTS
  ===================================================== */

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const paymentClass =
        payment.className ||
        payment.class_name ||
        "";

      const classMatches =
        classFilter === "all" ||
        paymentClass === classFilter;

      const dateMatches =
        isWithinDateRange(
          payment.paymentDate
        );

      return classMatches && dateMatches;
    });
  }, [
    payments,
    classFilter,
    startDate,
    endDate,
  ]);

  /* =====================================================
     FILTERED ATTENDANCE
  ===================================================== */

  const filteredAttendance = useMemo(() => {
    return enrichedAttendance.filter(
      (record) => {
        const classMatches =
          classFilter === "all" ||
          record.className === classFilter;

        const dateMatches =
          isWithinDateRange(
            record.attendance_date
          );

        return classMatches && dateMatches;
      }
    );
  }, [
    enrichedAttendance,
    classFilter,
    startDate,
    endDate,
  ]);

  /* =====================================================
     FINANCE SUMMARY
  ===================================================== */

  const financeSummary = useMemo(() => {
    const expected = feeAccounts.reduce(
      (sum, account) =>
        sum +
        Number(account.totalAmount || 0),
      0
    );

    const collected =
      filteredPayments.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      );

    const outstanding = Math.max(
      expected - collected,
      0
    );

    return {
      expected,
      collected,
      outstanding,
    };
  }, [
    feeAccounts,
    filteredPayments,
  ]);

  /* =====================================================
     ATTENDANCE SUMMARY
  ===================================================== */

  const attendanceSummary = useMemo(() => {
    const present =
      filteredAttendance.filter(
        (record) =>
          String(record.status || "")
            .toLowerCase() === "present"
      ).length;

    const absent =
      filteredAttendance.filter(
        (record) =>
          String(record.status || "")
            .toLowerCase() === "absent"
      ).length;

    const total = present + absent;

    const rate =
      total > 0
        ? Math.round(
            (present / total) * 100
          )
        : 0;

    return {
      present,
      absent,
      total,
      rate,
    };
  }, [filteredAttendance]);

  /* =====================================================
     STUDENT SUMMARY
  ===================================================== */

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const className =
        student.className ||
        student.class_name ||
        student.class ||
        "";

      return (
        classFilter === "all" ||
        className === classFilter
      );
    });
  }, [students, classFilter]);

  const studentSummary = useMemo(() => {
    const active =
      filteredStudents.filter(
        (student) =>
          String(student.status || "")
            .toLowerCase() === "active"
      ).length;

    return {
      total: filteredStudents.length,
      active,
      inactive:
        filteredStudents.length - active,
    };
  }, [filteredStudents]);

  /* =====================================================
     PRINT
  ===================================================== */

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <h1>Reports</h1>
        </div>

        <div className="page-card">
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="page-header reports-header">
        <div>
          <h1>Reports</h1>

          <p>
            View school finance, attendance
            and student reports.
          </p>
        </div>

        <div className="reports-actions">
          <button
            className="secondary-btn"
            onClick={loadReports}
          >
            Refresh
          </button>

          <button
            className="primary-btn"
            onClick={handlePrint}
          >
            Print Report
          </button>
        </div>
      </div>

      {error && (
        <div className="report-error">
          {error}
        </div>
      )}

      {/* FILTERS */}

      <div className="page-card report-filters">
        <div className="report-filter">
          <label>Report Type</label>

          <select
            value={reportType}
            onChange={(event) =>
              setReportType(
                event.target.value
              )
            }
          >
            <option value="finance">
              Finance
            </option>

            <option value="attendance">
              Attendance
            </option>

            <option value="students">
              Students
            </option>
          </select>
        </div>

        <div className="report-filter">
          <label>Class</label>

          <select
            value={classFilter}
            onChange={(event) =>
              setClassFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Classes
            </option>

            {classes.map((className) => (
              <option
                key={className}
                value={className}
              >
                {className}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter">
          <label>From</label>

          <input
            type="date"
            value={startDate}
            onChange={(event) =>
              setStartDate(
                event.target.value
              )
            }
          />
        </div>

        <div className="report-filter">
          <label>To</label>

          <input
            type="date"
            value={endDate}
            onChange={(event) =>
              setEndDate(
                event.target.value
              )
            }
          />
        </div>

        <button
          className="secondary-btn"
          onClick={() => {
            setClassFilter("all");
            setStartDate("");
            setEndDate("");
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* =================================================
          FINANCE
      ================================================= */}

      {reportType === "finance" && (
        <div className="report-content">
          <div className="report-title">
            <h2>Fee Collection Report</h2>

            <p>
              {classFilter === "all"
                ? "All classes"
                : classFilter}
            </p>
          </div>

          <div className="report-summary-grid">
            <div className="report-summary-card">
              <span>Total Expected</span>

              <strong>
                {formatMoney(
                  financeSummary.expected
                )}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Total Collected</span>

              <strong>
                {formatMoney(
                  financeSummary.collected
                )}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Outstanding</span>

              <strong>
                {formatMoney(
                  financeSummary.outstanding
                )}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Transactions</span>

              <strong>
                {filteredPayments.length}
              </strong>
            </div>
          </div>

          <div className="page-card report-table-card">
            <h3>Payment History</h3>

            <div className="report-table-wrapper">
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
                  {filteredPayments.length >
                  0 ? (
                    filteredPayments.map(
                      (payment) => (
                        <tr key={payment.id}>
                          <td>
                            {payment.receiptNumber ||
                              "—"}
                          </td>

                          <td>
                            {payment.studentName ||
                              "—"}
                          </td>

                          <td>
                            {payment.className ||
                              payment.class_name ||
                              "—"}
                          </td>

                          <td>
                            {formatMoney(
                              payment.amount
                            )}
                          </td>

                          <td>
                            {payment.method ||
                              "—"}
                          </td>

                          <td>
                            {formatDate(
                              payment.paymentDate
                            )}
                          </td>

                          <td>
                            {payment.status ||
                              "—"}
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="empty-report"
                      >
                        No payments match
                        the selected
                        filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          ATTENDANCE
      ================================================= */}

      {reportType === "attendance" && (
        <div className="report-content">
          <div className="report-title">
            <h2>Attendance Report</h2>

            <p>
              {classFilter === "all"
                ? "All classes"
                : classFilter}
            </p>
          </div>

          <div className="report-summary-grid">
            <div className="report-summary-card">
              <span>Present</span>

              <strong>
                {attendanceSummary.present}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Absent</span>

              <strong>
                {attendanceSummary.absent}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Total Records</span>

              <strong>
                {attendanceSummary.total}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Attendance Rate</span>

              <strong>
                {attendanceSummary.rate}%
              </strong>
            </div>
          </div>

          <div className="page-card report-table-card">
            <h3>Attendance Records</h3>

            <div className="report-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length >
                  0 ? (
                    filteredAttendance.map(
                      (record) => (
                        <tr key={record.id}>
                          <td>
                            {record.studentName}
                          </td>

                          <td>
                            {record.className}
                          </td>

                          <td>
                            {formatDate(
                              record.attendance_date
                            )}
                          </td>

                          <td>
                            {record.status}
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="empty-report"
                      >
                        No attendance
                        records match the
                        selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          STUDENTS
      ================================================= */}

      {reportType === "students" && (
        <div className="report-content">
          <div className="report-title">
            <h2>Student Report</h2>

            <p>
              {classFilter === "all"
                ? "All classes"
                : classFilter}
            </p>
          </div>

          <div className="report-summary-grid">
            <div className="report-summary-card">
              <span>Total Students</span>

              <strong>
                {studentSummary.total}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Active</span>

              <strong>
                {studentSummary.active}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Inactive</span>

              <strong>
                {studentSummary.inactive}
              </strong>
            </div>

            <div className="report-summary-card">
              <span>Classes</span>

              <strong>
                {classes.length}
              </strong>
            </div>
          </div>

          <div className="page-card report-table-card">
            <h3>Student Register</h3>

            <div className="report-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.length >
                  0 ? (
                    filteredStudents.map(
                      (student) => (
                        <tr key={student.id}>
                          <td>
                            {student.name ||
                              student.fullName ||
                              student.full_name ||
                              "—"}
                          </td>

                          <td>
                            {student.className ||
                              student.class_name ||
                              student.class ||
                              "—"}
                          </td>

                          <td>
                            {student.status ||
                              "—"}
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="3"
                        className="empty-report"
                      >
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

