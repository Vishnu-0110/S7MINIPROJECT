import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AiAssistant from "./pages/AiAssistant.jsx";
import Analytics from "./pages/Analytics.jsx";
import ApprovalCenter from "./pages/ApprovalCenter.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DriverDashboard from "./pages/DriverDashboard.jsx";
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

function Shell({ children, roles }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Shell><Layout /></Shell>}>
        <Route index element={<Dashboard />} />
        <Route path="driver" element={<Shell roles={["DRIVER"]}><DriverDashboard /></Shell>} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id/allocation" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><SmartAllocation /></Shell>} />
        <Route path="request/new" element={<Shell roles={["FACULTY_STAFF", "SUPER_ADMIN"]}><RequestForm /></Shell>} />
        <Route path="approvals" element={<Shell roles={["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ApprovalCenter /></Shell>} />
        <Route path="trips" element={<Trips />} />
        <Route path="trips/:id" element={<TripDetails />} />
        <Route path="tracking" element={<Shell roles={["FACULTY_STAFF", "TRANSPORT_ADMIN", "SUPER_ADMIN"]}><LiveTracking /></Shell>} />
        <Route path="vehicles" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ManagementPage resource="vehicles" /></Shell>} />
        <Route path="drivers" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ManagementPage resource="drivers" /></Shell>} />
        <Route path="vehicle-documents" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ManagementPage resource="vehicle-documents" /></Shell>} />
        <Route path="users" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ManagementPage resource="users" /></Shell>} />
        <Route path="departments" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><ManagementPage resource="departments" /></Shell>} />
        <Route path="maintenance" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><OperationsPage resource="maintenance" /></Shell>} />
        <Route path="fuel" element={<Shell roles={["DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"]}><OperationsPage resource="fuel" /></Shell>} />
        <Route path="expenses" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><OperationsPage resource="expenses" /></Shell>} />
        <Route path="emergencies" element={<Shell roles={["DRIVER", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"]}><OperationsPage resource="emergencies" /></Shell>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="analytics" element={<Shell roles={["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"]}><Analytics /></Shell>} />
        <Route path="reports" element={<Shell roles={["TRANSPORT_ADMIN", "SUPER_ADMIN"]}><Reports /></Shell>} />
        <Route path="ai" element={<AiAssistant />} />
      </Route>
    </Routes>
  );
}
