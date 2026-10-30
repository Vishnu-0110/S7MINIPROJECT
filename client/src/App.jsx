import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AiAssistant from "./pages/AiAssistant.jsx";
import AssetHistory from "./pages/AssetHistory.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DriverDashboard from "./pages/DriverDashboard.jsx";
import DriverLeaves from "./pages/DriverLeaves.jsx";
import LiveTracking from "./pages/LiveTracking.jsx";
import Login from "./pages/Login.jsx";
import ManagementPage from "./pages/ManagementPage.jsx";
import Notifications from "./pages/Notifications.jsx";
import OperationsPage from "./pages/OperationsPage.jsx";
import Register from "./pages/Register.jsx";
import RequestForm from "./pages/RequestForm.jsx";
import Requests from "./pages/Requests.jsx";
import Reports from "./pages/Reports.jsx";
import SmartAllocation from "./pages/SmartAllocation.jsx";
import TripDetails from "./pages/TripDetails.jsx";
import Trips from "./pages/Trips.jsx";
import { useAuthStore } from "./store/authStore.js";

function Shell({ children, roles }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

function Home() {
  const user = useAuthStore((state) => state.user);
  return user?.role === "DRIVER" ? <Navigate to="/driver" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Shell><Layout /></Shell>}>
        <Route index element={<Home />} />
        <Route path="driver" element={<Shell roles={["DRIVER"]}><DriverDashboard /></Shell>} />
        <Route path="driver-leaves" element={<Shell roles={["DRIVER", "TRANSPORT_ADMIN"]}><DriverLeaves /></Shell>} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id/allocation" element={<Shell roles={["TRANSPORT_ADMIN"]}><SmartAllocation /></Shell>} />
        <Route path="request/new" element={<Shell roles={["FACULTY_STAFF"]}><RequestForm /></Shell>} />
        <Route path="approvals" element={<Navigate to="/requests" replace />} />
        <Route path="trips" element={<Trips />} />
        <Route path="trips/:id" element={<TripDetails />} />
        <Route path="tracking" element={<Shell roles={["FACULTY_STAFF", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]}><LiveTracking /></Shell>} />
        <Route path="vehicles" element={<Shell roles={["TRANSPORT_ADMIN"]}><ManagementPage resource="vehicles" /></Shell>} />
        <Route path="vehicles/:id/history" element={<Shell roles={["TRANSPORT_ADMIN"]}><AssetHistory asset="vehicle" /></Shell>} />
        <Route path="drivers" element={<Shell roles={["TRANSPORT_ADMIN"]}><ManagementPage resource="drivers" /></Shell>} />
        <Route path="drivers/:id/history" element={<Shell roles={["TRANSPORT_ADMIN"]}><AssetHistory asset="driver" /></Shell>} />
        <Route path="vehicle-documents" element={<Shell roles={["TRANSPORT_ADMIN"]}><ManagementPage resource="vehicle-documents" /></Shell>} />
        <Route path="users" element={<Shell roles={["TRANSPORT_ADMIN"]}><ManagementPage resource="users" /></Shell>} />
        <Route path="departments" element={<Shell roles={["TRANSPORT_ADMIN"]}><ManagementPage resource="departments" /></Shell>} />
        <Route path="maintenance" element={<Shell roles={["TRANSPORT_ADMIN"]}><OperationsPage resource="maintenance" /></Shell>} />
        <Route path="fuel" element={<Shell roles={["DRIVER", "TRANSPORT_ADMIN"]}><OperationsPage resource="fuel" /></Shell>} />
        <Route path="expenses" element={<Shell roles={["DRIVER", "TRANSPORT_ADMIN"]}><OperationsPage resource="expenses" /></Shell>} />
        <Route path="emergencies" element={<Shell roles={["DRIVER", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]}><OperationsPage resource="emergencies" /></Shell>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="reports" element={<Shell roles={["TRANSPORT_ADMIN"]}><Reports /></Shell>} />
        <Route path="ai" element={<AiAssistant />} />
      </Route>
    </Routes>
  );
}
