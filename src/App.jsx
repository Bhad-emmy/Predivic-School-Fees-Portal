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

  const renderPage = () => {
    switch (page) {
      case "students":
        return <Students />;

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

      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">

      <aside className="sidebar">

        <h2>Predvic Schools</h2>

        <button onClick={() => setPage("dashboard")}>Dashboard</button>

        <button onClick={() => setPage("students")}>Students</button>

        <button onClick={() => setPage("fees")}>Fee Accounts</button>

        <button onClick={() => setPage("payments")}>Payments</button>

        <button onClick={() => setPage("receipts")}>Receipts</button>

        <button onClick={() => setPage("reports")}>Reports</button>

        <button onClick={() => setPage("settings")}>Settings</button>

      </aside>

      <main className="content">
        {renderPage()}
      </main>

    </div>
  );
}

export default App;