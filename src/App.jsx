import { useState } from "react";

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
  const { user, staff, loading, signOut } = useAuth();
  const [page, setPage] = useState("dashboard");

  if (loading) {
    return <main className="auth-page">Loading secure session…</main>;
  }

  if (!user || !staff) {
    return <Login />;
  }

  const renderPage = () => {
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

      {/* SIDEBAR */}

      <aside className="sidebar">

        <h2>Predivic Schools</h2>

        <div className="sidebar-user">
          <strong>{[staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Staff"}</strong>
          <span>{staff.role}</span>
        </div>

        <button
          onClick={() =>
            setPage("dashboard")
          }
        >
          Dashboard
        </button>

        <button
          onClick={() =>
            setPage("students")
          }
        >
          Students
        </button>

        <button
          onClick={() =>
            setPage("student-attendance")
          }
        >
          Student Attendance
        </button>

        <button
          onClick={() =>
            setPage("teacher-attendance")
          }
        >
          Teacher Attendance
        </button>

        <button
          onClick={() =>
            setPage("fees")
          }
        >
          Fee Accounts
        </button>

        <button
          onClick={() =>
            setPage("payments")
          }
        >
          Payments
        </button>

        <button
          onClick={() =>
            setPage("receipts")
          }
        >
          Receipts
        </button>

        <button
          onClick={() =>
            setPage("reports")
          }
        >
          Reports
        </button>

        <button
          onClick={() =>
            setPage("settings")
          }
        >
          Settings
        </button>

        <button className="sidebar-signout" onClick={signOut}>
          Sign out
        </button>

      </aside>

      {/* MAIN CONTENT */}

      <main className="content">
        {renderPage()}
      </main>

    </div>
  );
}

export default App;
