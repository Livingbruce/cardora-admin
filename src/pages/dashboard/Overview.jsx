import "../../styles/dashboard/Overview.css";

export default function Overview() {
  return (
    <div className="overview-container">
      <h2 className="overview-header">Dashboard Overview</h2>

      <div className="overview-grid">
        <div className="overview-card">
          <h3>Recent System Activity</h3>
          <ul className="overview-list">
            <li className="overview-list-item">
              <span>New user deposit ($150.00)</span>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>2 mins ago</span>
            </li>
            <li className="overview-list-item">
              <span>Support ticket #104 opened</span>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>15 mins ago</span>
            </li>
            <li className="overview-list-item">
              <span>Inventory batch #402 uploaded</span>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>1 hour ago</span>
            </li>
          </ul>
        </div>

        <div className="overview-card">
          <h3>Quick Quick Stats</h3>
          <ul className="overview-list">
            <li className="overview-list-item">
              <span>Pending approval</span>
              <strong>5</strong>
            </li>
            <li className="overview-list-item">
              <span>Pending Orders</span>
              <strong>$0.00</strong>
            </li>
            <li className="overview-list-item">
              <span>Active Users</span>
              <strong>10</strong>
            </li>
            <li className="overview-list-item">
              <span>Server Health</span>
              <strong style={{ color: "#10b981" }}>Optimal</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}