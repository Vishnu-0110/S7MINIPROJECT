import { Bus, ExternalLink, MapPin, RadioTower } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";

export default function LiveTracking() {
  const [gps, setGps] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const [gpsResult, tripResult] = await Promise.all([api.get("/gps?limit=20"), api.get("/trips?limit=100")]);
        setGps(gpsResult.data || []);
        setTrips((tripResult.data || []).filter((trip) => ["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status)));
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
  const activeTripIds = new Set(trips.map((trip) => String(trip._id)));
  const latest = gps.find((log) => activeTripIds.has(String(log.tripId?._id || log.tripId))) || null;
  const liveTrip = latest?.tripId;
  const hasCoordinates = Number.isFinite(latest?.latitude) && Number.isFinite(latest?.longitude);
  const mapUrl = hasCoordinates ? mapEmbedUrl(latest.latitude, latest.longitude) : "";
  const mapLink = hasCoordinates ? `https://www.openstreetmap.org/?mlat=${latest.latitude}&mlon=${latest.longitude}#map=16/${latest.latitude}/${latest.longitude}` : "";

  return (
    <section className="responsive-map-grid">
      <aside>
        {error ? <div className="alert alert-error mb-3">{error}</div> : null}
        <h2 className="mb-3 text-base font-semibold">Active trips</h2>
        <DataTable
          rows={trips}
          columns={[
            { key: "vehicle", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId },
            { key: "scheduledStartTime", label: "Scheduled departure", render: (row) => formatIndiaDateTime(row.scheduledStartTime, "—") },
            { key: "scheduledEndTime", label: "Scheduled return", render: (row) => formatIndiaDateTime(row.scheduledEndTime, "—") },
            { key: "status", label: "Status" }
          ]}
        />
      </aside>
      <div className="min-h-[360px] rounded-lg border border-slate-200 bg-white p-4 sm:min-h-[520px] sm:p-5">
        <div className="relative h-full min-h-[320px] overflow-hidden rounded-md bg-slate-100 sm:min-h-[460px]">
          {hasCoordinates ? <iframe title="Live vehicle location map" className="absolute inset-0 h-full w-full border-0" src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /> : <div className="grid h-full place-items-center bg-[linear-gradient(90deg,rgba(15,118,110,.12)_1px,transparent_1px),linear-gradient(rgba(37,99,235,.1)_1px,transparent_1px)] bg-[size:42px_42px]"><div className="max-w-sm px-5 text-center"><MapPin className="mx-auto h-12 w-12 text-error" /><p className="mt-2 font-semibold">Waiting for a live location update</p><p className="mt-1 text-sm text-slate-600">The map appears when the active driver shares GPS from the Driver workspace.</p></div></div>}
          {hasCoordinates ? <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/85 px-3 py-2 text-sm text-white shadow-lg"><span>{liveTrip?.vehicleId?.vehicleId || latest.vehicleId?.vehicleId || "Vehicle"} location is live</span><a className="btn btn-xs border-0 bg-white text-slate-900 hover:bg-slate-100" href={mapLink} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Open map</a></div> : null}
        </div>
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <RadioTower className="mb-3 h-5 w-5 text-primary" />
        <h2 className="font-semibold">Latest location</h2>
        {latest ? (
          <div className="mt-4 space-y-2 text-sm">
            <p><Bus className="mr-1 inline h-4 w-4" />Vehicle: {liveTrip?.vehicleId?.vehicleId || latest.vehicleId?.vehicleId || "—"}</p>
            <p>Trip: {liveTrip?.tripId || "—"}</p>
            <p>Destination: {liveTrip?.destination || "—"}</p>
            <p>Status: {liveTrip?.status?.replaceAll("_", " ") || "Reported"}</p>
            <p>Speed: {latest.speed || 0} km/h</p>
            <p>Accuracy: {latest.accuracy || "-"} m</p>
            <p>Last update: {formatIndiaDateTime(latest.timestamp || latest.createdAt, "Unknown")}</p>
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

function mapEmbedUrl(latitude, longitude) {
  const span = 0.01;
  const bbox = [longitude - span, latitude - span, longitude + span, latitude + span].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
