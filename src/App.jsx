import { useEffect, useState } from "react";

import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentAttendance from "./pages/StudentAttendance";
import TeacherAttendance from "./pages/TeacherAttendance";
import FeeAccounts from "./pages/FeeAccounts";
import Payments from "./pages/Payments";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles/App.css";

function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}

function ProtectedApp() {
  const { user, staff, loading, signOut, isAttendanceOnly } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isAttendanceOnly) {
      setPage("student-attendance");
    } else if (page === "student-attendance") {
      setPage("dashboard");
    }
  }, [isAttendanceOnly]);

  const navigateTo = (nextPage) => {
    setPage(nextPage);
    setMobileNavOpen(false);
  };

  if (loading) {
    return <main className="auth-page">Loading secure session...</main>;
  }

  if (!user || !staff) {
    return <Login />;
  }

  const renderPage = () => {
    if (isAttendanceOnly) {
      return <StudentAttendance />;
    }

    switch (page) {
      case "students":
        return <Students />;
      case "student-attendance":
        return <StudentAttendance />;
      case "teacher-attendance":
        return <TeacherAttendance />;
      case "fees":
        return <FeeAccounts />;
      case "payments":
        return <Payments />;
      case "receipts":
        return <Receipts />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <header className="mobile-header">
        <strong>MEKA School</strong>
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span>
        </button>
      </header>

      <aside className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}>
        <h2>MEKA School</h2>

        <div className="sidebar-user">
          <strong>
            {[staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Staff"}
          </strong>
          <span>{isAttendanceOnly ? "Teacher Attendance" : staff.role}</span>
        </div>

        {isAttendanceOnly ? (
          <button
            className={page === "student-attendance" ? "active" : ""}
            onClick={() => navigateTo("student-attendance")}
          >
            Student Attendance
          </button>
        ) : (
          <>
            <button className={page === "dashboard" ? "active" : ""} onClick={() => navigateTo("dashboard")}>Dashboard</button>
            <button className={page === "students" ? "active" : ""} onClick={() => navigateTo("students")}>Students</button>
            <button className={page === "student-attendance" ? "active" : ""} onClick={() => navigateTo("student-attendance")}>Student Attendance</button>
            <button className={page === "teacher-attendance" ? "active" : ""} onClick={() => navigateTo("teacher-attendance")}>Teacher Attendance</button>
            <button className={page === "fees" ? "active" : ""} onClick={() => navigateTo("fees")}>Fee Accounts</button>
            <button className={page === "payments" ? "active" : ""} onClick={() => navigateTo("payments")}>Payments</button>
            <button className={page === "receipts" ? "active" : ""} onClick={() => navigateTo("receipts")}>Receipts</button>
            <button className={page === "reports" ? "active" : ""} onClick={() => navigateTo("reports")}>Reports</button>
            <button className={page === "settings" ? "active" : ""} onClick={() => navigateTo("settings")}>Settings</button>
          </>
        )}

        <button className="sidebar-signout" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <main className="content">{renderPage()}</main>
    </div>
  );
}

export default App;
