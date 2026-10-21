import { MapPin, RadioTower } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";

export default function LiveTracking() {
  const [gps, setGps] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const [gpsResult, tripResult] = await Promise.all([api.get("/gps?limit=20"), api.get("/trips?status=TRIP_STARTED")]);
        setGps(gpsResult.data || []);
        setTrips(tripResult.data || []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const socket = connectSocket();
    socket.on("vehicle:location", (log) => setGps((current) => [log, ...current].slice(0, 20)));
    return () => socket.off("vehicle:location");
  }, []);

  if (loading) return <LoadingState />;
  const latest = gps[0];

  return (
    <section className="responsive-map-grid">
      <aside>
        {error ? <div className="alert alert-error mb-3">{error}</div> : null}
        <h2 className="mb-3 text-base font-semibold">Active trips</h2>
        <DataTable
          rows={trips}
          columns={[
            { key: "vehicle", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId },
            { key: "status", label: "Status" }
          ]}
        />
      </aside>
      <div className="min-h-[360px] rounded-lg border border-slate-200 bg-white p-4 sm:min-h-[520px] sm:p-5">
        <div className="relative grid h-full min-h-[320px] place-items-center overflow-hidden rounded-md bg-slate-100 sm:min-h-[460px]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,118,110,.12)_1px,transparent_1px),linear-gradient(rgba(37,99,235,.1)_1px,transparent_1px)] bg-[size:42px_42px]" />
          <div className="relative text-center">
            <MapPin className="mx-auto h-12 w-12 text-error" />
            <p className="mt-2 font-semibold">{latest ? `${latest.latitude?.toFixed?.(4)}, ${latest.longitude?.toFixed?.(4)}` : "Waiting for a location update"}</p>
            <p className="text-sm text-slate-500">Latest GPS location reported by a driver</p>
          </div>
        </div>
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <RadioTower className="mb-3 h-5 w-5 text-primary" />
        <h2 className="font-semibold">Latest location</h2>
        {latest ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>Status: Reported</p>
            <p>Speed: {latest.speed || 0} km/h</p>
            <p>Accuracy: {latest.accuracy || "-"} m</p>
            <p>GPS: Active</p>
            <p>Demo mode: {latest.demoMode ? "Yes" : "No"}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No live location has been received yet.</p>
        )}
      </aside>
    </section>
  );
}
