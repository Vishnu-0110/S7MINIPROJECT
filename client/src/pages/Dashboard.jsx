import { AlertTriangle, Bus, Clock, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import StatGrid from "../components/StatGrid.jsx";
import { api } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { useAuthStore } from "../store/authStore.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState({ requests: 0, activeTrips: 0, upcomingTrips: 0 });
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [reqs, notes, tripSummary] = await Promise.all([
          api.get("/requests?limit=5"),
          api.get("/notifications?limit=5"),
          user.role === "TRANSPORT_ADMIN" ? api.get("/trips/summary") : Promise.resolve({ data: {} })
        ]);
        setRequests(reqs.data || []);
        setNotifications(notes.data || []);
        setSummary(tripSummary.data || {});
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const socket = connectSocket();
    socket.on("notification:new", load);
    socket.on("trip:started", load);
    socket.on("trip:completed", load);
    return () => {
      socket.off("notification:new", load);
      socket.off("trip:started", load);
      socket.off("trip:completed", load);
    };
  }, [user.role]);

  const stats = useMemo(
    () => [
      { label: "Pending requests", value: summary.requests || requests.filter((item) => item.status === "PENDING_APPROVAL").length, note: "Awaiting approval", icon: Clock },
      { label: "Active trips", value: summary.activeTrips || 0, note: "Live operations", icon: Route },
      { label: "Upcoming trips", value: summary.upcomingTrips || 0, note: "Scheduled trips", icon: Bus },
      { label: "Notifications", value: notifications.length, note: "Recent alerts", icon: AlertTriangle }
    ],
    [summary, requests, notifications]
  );

  if (user.role === "DRIVER") return <DriverShortcut />;
  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-primary p-6 text-white shadow-xl shadow-slate-950/15 sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="absolute bottom-0 right-1/4 h-28 w-28 rounded-full bg-blue-400/10 blur-xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">BIT transport operations</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Good to see you, {user.name?.split(" ")[0] || "there"}.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Check requests, trips, and important notices in one place.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-300">Service status</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" /> Available</p>
          </div>
        </div>
      </section>
      <StatGrid stats={stats} />
      {error ? <div className="alert alert-error">{error}</div> : null}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1"><div><p className="page-kicker">Workflow</p><h2 className="font-bold text-slate-900">Recent requests</h2></div><Link className="link link-primary text-sm font-semibold" to="/requests">View all</Link></div>
          <DataTable
            rows={requests}
            columns={[
              { key: "requestId", label: "Request" },
              { key: "tripType", label: "Type" },
              { key: "destination", label: "Destination" },
              { key: "departureTime", label: "Scheduled departure", render: (row) => formatIndiaDateTime(row.departureTime, "—") },
              { key: "returnTime", label: "Scheduled return", render: (row) => formatIndiaDateTime(row.returnTime, "—") },
              { key: "status", label: "Status" }
            ]}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1"><div><p className="page-kicker">Activity</p><h2 className="font-bold text-slate-900">Recent notifications</h2></div><Link className="link link-primary text-sm font-semibold" to="/notifications">View all</Link></div>
          <DataTable
            rows={notifications}
            columns={[
              { key: "title", label: "Title" },
              { key: "message", label: "Message" },
              { key: "createdAt", label: "Received", render: (row) => formatIndiaDateTime(row.createdAt, "—") },
              { key: "type", label: "Type" }
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function DriverShortcut() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-primary p-7 text-white shadow-xl shadow-slate-950/15 sm:p-10">
      <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-teal-300/20 blur-2xl" />
      <div className="relative max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">Driver workspace</p><h2 className="mt-3 text-2xl font-bold">Your trips, in one place.</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Start and complete assigned trips, verify QR codes, share GPS updates, log fuel, and raise an emergency alert.</p>
      <Link className="btn btn-primary mt-6 rounded-xl border-0 bg-white text-slate-900 hover:bg-teal-50" to="/driver">Open driver dashboard</Link></div>
    </div>
  );
}
