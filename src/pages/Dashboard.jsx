const stats = [
  {
    title: "Total Students",
    value: "1,250",
    color: "#2563eb",
  },
  {
    title: "Total Revenue",
    value: "₦12,500,000",
    color: "#16a34a",
  },
  {
    title: "Outstanding Fees",
    value: "₦2,300,000",
    color: "#dc2626",
  },
  {
    title: "Payments Today",
    value: "₦450,000",
    color: "#f59e0b",
  },
];

const recentPayments = [
  {
    student: "John Doe",
    class: "JSS 2",
    amount: "₦35,000",
    date: "Today",
    status: "Paid",
  },
  {
    student: "Mary Obi",
    class: "SS 1",
    amount: "₦50,000",
    date: "Today",
    status: "Paid",
  },
  {
    student: "David Okeke",
    class: "Primary 5",
    amount: "₦20,000",
    date: "Yesterday",
    status: "Paid",
  },
];

export default function Dashboard() {
  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.title}>
            <h3>{stat.title}</h3>
            <h2 style={{ color: stat.color }}>{stat.value}</h2>
          </div>
        ))}
      </div>

      <div className="table-section">
        <h2>Recent Payments</h2>

        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {recentPayments.map((payment, index) => (
              <tr key={index}>
                <td>{payment.student}</td>
                <td>{payment.class}</td>
                <td>{payment.amount}</td>
                <td>{payment.date}</td>
                <td>{payment.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}