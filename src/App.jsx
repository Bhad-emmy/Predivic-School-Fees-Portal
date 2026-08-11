import { useState } from "react";

import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import FeeAccounts from "./pages/FeeAccounts";
import Payments from "./pages/Payments";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import "./styles/App.css";

function App() {
  const [page, setPage] = useState("dashboard");

  // Shared application data
  const [students, setStudents] = useState([]);
  const [feeAccounts, setFeeAccounts] = useState([]);
  const [payments, setPayments] = useState([]);

  const renderPage = () => {
    switch (page) {
      case "students":
        return (
          <Students
            students={students}
            setStudents={setStudents}
          />
        );

      case "fees":
        return (
          <FeeAccounts
            feeAccounts={feeAccounts}
            setFeeAccounts={setFeeAccounts}
          />
        );

      case "payments":
        return (
          <Payments
            students={students}
            feeAccounts={feeAccounts}
            payments={payments}
            setPayments={setPayments}
          />
        );

      case "receipts":
        return (
          <Receipts
            payments={payments}
          />
        );

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

        <h2>Predvic Schools</h2>

        <button
          onClick={() => setPage("dashboard")}
        >
          Dashboard
        </button>

        <button
          onClick={() => setPage("students")}
        >
          Students
        </button>

        <button
          onClick={() => setPage("fees")}
        >
          Fee Accounts
        </button>

        <button
          onClick={() => setPage("payments")}
        >
          Payments
        </button>

        <button
          onClick={() => setPage("receipts")}
        >
          Receipts
        </button>

        <button
          onClick={() => setPage("reports")}
        >
          Reports
        </button>

        <button
          onClick={() => setPage("settings")}
        >
          Settings
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