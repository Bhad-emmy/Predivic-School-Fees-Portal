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
import ParentPayment from "./pages/ParentPayment";
import ParentPortal from "./pages/ParentPortal";
import BankTransfers from "./pages/BankTransfers";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles/App.css";

function App() {
  if (window.location.pathname === "/pay") {
    return <ParentPayment />;
  }

  if (window.location.pathname === "/parent") {
    return <ParentPortal />;
  }

  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}

function ProtectedApp() {
  const { user, staff, loading, signOut, isAdmin, isAttendanceOnly } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = String(staff?.role || "").toLowerCase();
  const isSecretary = role === "secretary";
  const isTeacherRole = role === "teacher" || role === "attendance";
  const isRestrictedStaff = isTeacherRole && !isAdmin;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [user?.id, staff?.id]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (isRestrictedStaff) {
      setPage((currentPage) =>
        currentPage === "student-attendance" || currentPage === "teacher-attendance"
          ? currentPage
          : "teacher-attendance"
      );
    } else if (isSecretary) {
      setPage("students");
    } else {
      setPage("dashboard");
    }
  }, [isRestrictedStaff, isSecretary]);

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
    if (isRestrictedStaff) {
      return page === "student-attendance" ? <StudentAttendance /> : <TeacherAttendance />;
    }

    if (isSecretary && (page === "settings" || page === "dashboard")) {
      return <Students />;
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
      case "bank-transfers":
        return <BankTransfers />;
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
        <div className="mobile-brand">
          <span className="meka-logo-mark" aria-hidden="true">M</span>
          <strong>MEKA School</strong>
        </div>
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

      {mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}>
        <h2>MEKA School</h2>

        <div className="sidebar-user">
          <strong>
            {[staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Staff"}
          </strong>
          <span>{isAttendanceOnly ? "Teacher Attendance" : staff.role}</span>
        </div>

        {isRestrictedStaff ? (
          <>
            <button
              className={page === "teacher-attendance" ? "active" : ""}
              onClick={() => navigateTo("teacher-attendance")}
            >
              Teacher Attendance
            </button>
            <button
              className={page === "student-attendance" ? "active" : ""}
              onClick={() => navigateTo("student-attendance")}
            >
              Student Attendance
            </button>
          </>
        ) : (
          <>
            {!isSecretary && <button className={page === "dashboard" ? "active" : ""} onClick={() => navigateTo("dashboard")}>Dashboard</button>}
            <button className={page === "students" ? "active" : ""} onClick={() => navigateTo("students")}>Students</button>
            <button className={page === "student-attendance" ? "active" : ""} onClick={() => navigateTo("student-attendance")}>Student Attendance</button>
            <button className={page === "teacher-attendance" ? "active" : ""} onClick={() => navigateTo("teacher-attendance")}>Teacher Attendance</button>
            <button className={page === "fees" ? "active" : ""} onClick={() => navigateTo("fees")}>Fee Accounts</button>
            <button className={page === "payments" ? "active" : ""} onClick={() => navigateTo("payments")}>Payments</button>
            {isAdmin || isSecretary ? <button className={page === "bank-transfers" ? "active" : ""} onClick={() => navigateTo("bank-transfers")}>Bank Transfers</button> : null}
            <button className={page === "receipts" ? "active" : ""} onClick={() => navigateTo("receipts")}>Receipts</button>
            <button className={page === "reports" ? "active" : ""} onClick={() => navigateTo("reports")}>Reports</button>
            {isAdmin && (
              <button className={page === "settings" ? "active" : ""} onClick={() => navigateTo("settings")}>Settings</button>
            )}
          </>
        )}

        <button className="sidebar-signout" onClick={signOut}>
          Sign out
        </button>

        <div className="sidebar-developer-credit" aria-label="Developer attribution">
          <span>Powered by</span>
          <strong>MEKA LOGIC</strong>
        </div>
      </aside>

      <main className="content">{renderPage()}</main>
    </div>
  );
}

export default App;
