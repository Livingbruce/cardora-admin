import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Overview from "./pages/dashboard/Overview";
import AdminDashboard from "./_layout/AdminLayout";
import Payments from "./pages/dashboard/Payments";
import Orders from "./pages/dashboard/Orders";
import Tickets from "./pages/dashboard/Tickets";
import Cvv from "./pages/dashboard/inventory/cvv";
import Bins from "./pages/dashboard/inventory/bins";
import Dumps from "./pages/dashboard/inventory/dumps";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<AdminDashboard />}>
          <Route index element={<Overview />} />
          <Route path="Overview" element={<Overview />} />
          <Route path="Payments" element={<Payments />} />
          <Route path="Orders" element={<Orders />} />
          <Route path="Tickets" element={<Tickets />} />
          <Route path="inventory/cvv" element={<Cvv />} />
          <Route path="inventory/bins" element={<Bins />} />
          <Route path="inventory/dumps" element={<Dumps />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}