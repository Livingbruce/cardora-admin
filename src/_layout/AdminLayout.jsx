import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { clearTabSessionId, getTabSessionId } from "../utils/sessionGuard";
import "../styles/dashboard/layout.css";

const isMissingTableError = (err) => {
  if (!err) return false;
  const code = String(err.code || "").trim();
  const msg = String(err.message || "").toLowerCase();
  const status = Number(err.status || err.statusCode || 0);
  return (
    status === 404 ||
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
};

const isMeaningfulError = (err) => {
  if (!err || isMissingTableError(err)) return false;
  const code = String(err.code || "").trim();
  const msg = String(err.message || "").trim();
  if (code === "PGRST116") return false;
  return Boolean(code || msg);
};

const isStockAvailable = (row) => {
  if (!row) return false;
  if (row.is_sold === true || row.sold === true) return false;
  const status = String(row.status || "").toLowerCase();
  if (status === "sold" || status === "purchased" || status === "deleted") {
    return false;
  }
  return true;
};

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminRole, setAdminRole] = useState("admin");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [layoutError, setLayoutError] = useState("");

  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeStock: 0,
    pendingTickets: 0
  });

  const isLoggingOutRef = useRef(false);
  const activeAdminIdRef = useRef(null);
  const activeUidRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const loadDashboardStats = useCallback(async (isActiveRef = { current: true }) => {
    try {
      const [
        paymentsRes,
        cvvRes,
        dumpsRes,
        binsRes,
        ticketsRes
      ] = await Promise.all([
        supabase.from("payments").select("package_amount, package_amount, status"),
        supabase.from("cvv_stock").select("*"),
        supabase.from("dumps_stock").select("*"),
        supabase.from("bins_stock").select("*"),
        supabase.from("tickets").select("id, status")
      ]);

      if (!isActiveRef.current) return;

      [paymentsRes.error, cvvRes.error, dumpsRes.error, binsRes.error, ticketsRes.error]
        .filter(isMeaningfulError)
        .forEach((err) => {
          console.error("Dashboard stats query error:", err.message || err.code);
        });

      const totalRevenue = (paymentsRes.data || []).reduce((sum, row) => {
        if (String(row.status || "").toLowerCase() !== "approved") {
          return sum;
        }
        const rawAmount = row.package_amount ?? row.amount ?? 0;
        const numAmount = Number(rawAmount);
        return Number.isFinite(numAmount) ? sum + numAmount : sum;
      }, 0);

      const cvvCount = isMissingTableError(cvvRes.error)
        ? 0
        : (cvvRes.data || []).filter(isStockAvailable).length;
      const dumpsCount = isMissingTableError(dumpsRes.error)
        ? 0
        : (dumpsRes.data || []).filter(isStockAvailable).length;
      const binsCount = isMissingTableError(binsRes.error)
        ? 0
        : (binsRes.data || []).filter(isStockAvailable).length;

      const activeStock = cvvCount + dumpsCount + binsCount;

      const pendingTickets = (ticketsRes.data || []).filter((row) => {
        const status = String(row.status || "").toLowerCase();
        return status === "open" || status === "pending";
      }).length;

      setStats({
        totalRevenue,
        activeStock,
        pendingTickets
      });
    } catch (err) {
      if (isActiveRef.current && isMeaningfulError(err)) {
        console.error("Error computing dashboard stats:", err.message || err);
      }
    }
  }, []);

  const terminateSessionAndLogout = useCallback(
    async (adminIdToClear = null, uidToClear = null) => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      const tabSessionAtLogout = getTabSessionId();
      clearTabSessionId();

      setSidebarOpen(false);
      setAdminUsername("admin");
      setAdminRole("admin");
      setCheckingAuth(true);

      const targetAdminId = adminIdToClear || activeAdminIdRef.current;
      const targetUid = uidToClear || activeUidRef.current;

      activeAdminIdRef.current = null;
      activeUidRef.current = null;

      const withTimeout = (promise, ms = 2500) =>
        Promise.race([
          promise,
          new Promise((resolve) => setTimeout(resolve, ms))
        ]);

      try {
        if (targetAdminId) {
          let clearQuery = supabase
            .from("admins")
            .update({ active_session_id: null })
            .eq("id", targetAdminId);

          if (tabSessionAtLogout) {
            clearQuery = clearQuery.eq("active_session_id", tabSessionAtLogout);
          }

          await withTimeout(clearQuery);
        } else if (targetUid) {
          let clearByUidQuery = supabase
            .from("admins")
            .update({ active_session_id: null })
            .eq("uid", targetUid);

          if (tabSessionAtLogout) {
            clearByUidQuery = clearByUidQuery.eq("active_session_id", tabSessionAtLogout);
          }

          await withTimeout(clearByUidQuery);
        }

        await withTimeout(supabase.auth.signOut({ scope: "local" }));
      } catch (err) {
        if (isMeaningfulError(err)) {
          console.error("Admin logout cleanup error:", err.message || err);
        }
      } finally {
        navigate("/login", { replace: true });
        setTimeout(() => {
          isLoggingOutRef.current = false;
        }, 300);
      }
    },
    [navigate]
  );

  const verifyAdminSession = useCallback(
    async (isActiveRef = { current: true }) => {
      if (isLoggingOutRef.current) return;

      const tabSessionId = getTabSessionId();
      if (!tabSessionId) {
        if (isActiveRef.current) {
          await terminateSessionAndLogout();
        }
        return;
      }

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (isMeaningfulError(sessionError)) {
          if (isActiveRef.current) {
            setLayoutError("Unable to verify authentication session.");
            await terminateSessionAndLogout();
          }
          return;
        }

        const currentUser = sessionData?.session?.user;
        if (!currentUser) {
          if (isActiveRef.current) {
            await terminateSessionAndLogout();
          }
          return;
        }

        activeUidRef.current = currentUser.id;

        const { data: adminRecord, error: adminError } = await supabase
          .from("admins")
          .select("id, uid, username, role, is_active, active_session_id")
          .eq("uid", currentUser.id)
          .maybeSingle();

        if (!isActiveRef.current || isLoggingOutRef.current) return;

        if (isMeaningfulError(adminError)) {
          setLayoutError("Error verifying admin account.");
          await terminateSessionAndLogout(null, currentUser.id);
          return;
        }

        if (
          !adminRecord ||
          adminRecord.role !== "admin" ||
          adminRecord.is_active === false ||
          !adminRecord.active_session_id ||
          adminRecord.active_session_id !== tabSessionId
        ) {
          await terminateSessionAndLogout(adminRecord?.id || null, currentUser.id);
          return;
        }

        activeAdminIdRef.current = adminRecord.id;
        setAdminUsername(adminRecord.username || "admin");
        setAdminRole(adminRecord.role || "admin");
        setLayoutError("");
        setCheckingAuth(false);
        await loadDashboardStats(isActiveRef);
      } catch (err) {
        if (!isActiveRef.current || isLoggingOutRef.current) return;
        if (isMeaningfulError(err)) {
          console.error("Admin session guard error:", err.message || err);
          setLayoutError("Session verification failed.");
        }
        await terminateSessionAndLogout(
          activeAdminIdRef.current,
          activeUidRef.current
        );
      }
    },
    [terminateSessionAndLogout, loadDashboardStats]
  );

  useEffect(() => {
    const activeRef = { current: true };

    const initialCheck = setTimeout(() => {
      if (activeRef.current) {
        void verifyAdminSession(activeRef);
      }
    }, 0);

    const pollInterval = setInterval(() => {
      if (activeRef.current) {
        void verifyAdminSession(activeRef);
      }
    }, 8000);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_OUT" ||
          (!session?.user && !isLoggingOutRef.current)
        ) {
          if (activeRef.current) {
            terminateSessionAndLogout(
              activeAdminIdRef.current,
              activeUidRef.current
            );
          }
        }
      }
    );

    return () => {
      activeRef.current = false;
      clearTimeout(initialCheck);
      clearInterval(pollInterval);
      authListener?.subscription?.unsubscribe();
    };
  }, [verifyAdminSession, terminateSessionAndLogout, location.pathname]);

  const handleLogout = (e) => {
    e.preventDefault();
    terminateSessionAndLogout(activeAdminIdRef.current, activeUidRef.current);
  };

  const isInventoryActive = location.pathname.startsWith("/dashboard/Inventory");

  if (checkingAuth) {
    return null;
  }

  return (
    <div className="dashboard-container">
      {/* Mobile Top Navigation Header */}
      <header className="dashboard-header">
        <button
          type="button"
          className="hamburger-btn"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <h2 style={{ margin: 0, fontSize: "1.05rem", letterSpacing: "0.5px" }}>
          CARDORA
        </h2>
      </header>

      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={closeSidebar}
      />

      {/* Admin Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-welcome">
          <p>Welcome @{adminUsername}</p>
          <span
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              textTransform: "uppercase"
            }}
          >
            {adminRole}
          </span>
        </div>

        <nav className="dashboard-nav">
          <NavLink
            to="/dashboard/Overview"
            className={({ isActive }) =>
              `dashboard-nav-link ${isActive ? "active" : ""}`
            }
            onClick={closeSidebar}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Overview
          </NavLink>

          {/* Inventory Accordion Dropdown matching shop style */}
          <div className="nav-dropdown-container">
            <button
              type="button"
              className={`nav-dropdown-header ${isInventoryActive ? "active" : ""}`}
              onClick={() => setInventoryOpen(!inventoryOpen)}
            >
              <div className="nav-dropdown-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                <span>Inventory</span>
              </div>
              <span className={`dropdown-arrow ${inventoryOpen || isInventoryActive ? "open" : ""}`}>
                ▲
              </span>
            </button>

            {(inventoryOpen || isInventoryActive) && (
              <div className="nav-submenu">
                <NavLink
                  to="/dashboard/inventory/cvv"
                  className="nav-submenu-link"
                  onClick={closeSidebar}
                >
                  CVV
                </NavLink>
                <NavLink
                  to="/dashboard/inventory/dumps"
                  className="nav-submenu-link"
                  onClick={closeSidebar}
                >
                  Dumps
                </NavLink>
                <NavLink
                  to="/dashboard/inventory/bins"
                  className="nav-submenu-link"
                  onClick={closeSidebar}
                >
                  Bins
                </NavLink>
              </div>
            )}
          </div>

          <NavLink
            to="/dashboard/Payments"
            className={({ isActive }) =>
              `dashboard-nav-link ${isActive ? "active" : ""}`
            }
            onClick={closeSidebar}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Payments
          </NavLink>

          <NavLink
            to="/dashboard/Orders"
            className={({ isActive }) =>
              `dashboard-nav-link ${isActive ? "active" : ""}`
            }
            onClick={closeSidebar}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            Orders
          </NavLink>

          <NavLink
            to="/dashboard/Tickets"
            className={({ isActive }) =>
              `dashboard-nav-link ${isActive ? "active" : ""}`
            }
            onClick={closeSidebar}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Tickets
          </NavLink>

          <button
            type="button"
            className="dashboard-nav-link"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              textAlign: "left",
              cursor: "pointer"
            }}
            onClick={handleLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {layoutError && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "0.88rem",
                fontWeight: 600
              }}
            >
              {layoutError}
            </div>
          )}

          {/* Dark Top Stats Grid */}
          <div className="dashboard-stats-grid">
            <div className="stat-card">
              <h4>Total Revenue</h4>
              <p>${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h4>Active Stock</h4>
              <p>{stats.activeStock} Items</p>
            </div>
            <div className="stat-card">
              <h4>Pending Tickets</h4>
              <p>{stats.pendingTickets} Open</p>
            </div>
            <div className="stat-card">
              <h4>Platform Status</h4>
              <p>v1.0 Online</p>
            </div>
          </div>

          <div className="dashboard-view-area">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}