import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ClientsPage from "./pages/ClientsPage";
import CalendarPage from "./pages/CalendarPage";
import PresupuestosPage from "./pages/PresupuestosPage";
import DashboardPage from "./pages/DashboardPage";
import InvoicesPage from "./pages/InvoicesPage";
import LoginPage from "./pages/LoginPage";
import PresupuestoPortal from "./presupuesto/PresupuestoPortal";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token"),
  );

  // Shared structural trigger loop to clear stale financial cache states
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleGlobalLedgerUpdate = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <Router>
      <Routes>
        {/* Public portal routes — no auth check, no sidebar */}
        <Route
          path="/portal/presupuesto/:token"
          element={<PresupuestoPortal />}
        />

        {/* Everything else goes through auth */}
        <Route
          path="/*"
          element={
            !isAuthenticated ? (
              <LoginPage onLogin={() => setIsAuthenticated(true)} />
            ) : (
              <div className="flex h-screen bg-gray-50 overflow-hidden">
                <Sidebar />
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route
                    path="/presupuestos"
                    element={
                      <PresupuestosPage refreshTrigger={refreshTrigger} />
                    }
                  />
                  <Route
                    path="/invoices"
                    element={
                      <InvoicesPage
                        onInvoiceStatusChange={handleGlobalLedgerUpdate}
                      />
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                </Routes>
              </div>
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
