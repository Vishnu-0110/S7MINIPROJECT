import { AlertTriangle, Fuel, KeyRound, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";
import { connectSocket } from "../lib/socket.js";

export default function DriverDashboard() {
  const { data, loading, error, reload } = useApiResource("/trips");
  const activeTrip = data.find((trip) => ["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status));
  const assignedTrip = activeTrip || data.find((trip) => ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status)) || data.find((trip) => trip.status === "TRIP_COMPLETION_PENDING");

  useEffect(() => {
    if (!activeTrip) return undefined;
    let cancelled = false;
    async function shareLocationSilently() {
      const location = await currentLocation();
      if (!location || cancelled) return;
      await api.post(`/trips/${activeTrip._id}/gps`, { ...location, speed: 0 }, { silentToast: true }).catch(() => undefined);
    }
    shareLocationSilently();
    const timer = window.setInterval(shareLocationSilently, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeTrip?._id]);

  useEffect(() => {
    const socket = connectSocket();
    socket.on("trip:cancelled", reload);
    socket.on("trip:updated", reload);
    return () => {
      socket.off("trip:cancelled", reload);
      socket.off("trip:updated", reload);
    };
  }, [reload]);

  if (loading) return <LoadingState />;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Driver workspace</p>
          <h2 className="text-xl font-semibold text-slate-950">Today’s trips</h2>
          <p className="mt-1 text-sm text-slate-500">Verify the faculty OTP before starting. Location sharing is available only while a trip is active.</p>
        </div>
        <Link className="btn btn-outline btn-sm" to="/fuel"><Fuel className="h-4 w-4" /> Fuel log</Link>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {assignedTrip ? <TripActionCard trip={assignedTrip} reload={reload} /> : null}
      {!assignedTrip ? <div className="app-surface p-5 text-sm text-slate-600">There is no trip assigned to you today.</div> : null}
    </section>
  );
}

function TripActionCard({ trip, reload }) {
  const isActive = ["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status);
  const isCompletionPending = trip.status === "TRIP_COMPLETION_PENDING";
  const [incidentPanelOpen, setIncidentPanelOpen] = useState(false);
  const [incidentKind, setIncidentKind] = useState("ACCIDENT");
  const [incidentDetails, setIncidentDetails] = useState("");
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitIncident() {
    const labels = { ACCIDENT: "Accident", TRAFFIC: "Traffic delay", BREAKDOWN: "Vehicle breakdown", OTHER: "Other emergency" };
    const details = incidentDetails.trim() || `${labels[incidentKind]} reported by the driver.`;
    setIncidentBusy(true);
    try {
      const location = await currentLocation();
      if (incidentKind === "BREAKDOWN") {
        await api.post("/breakdowns", { tripId: trip._id, message: details, severity: "HIGH", location });
        setMessage("Breakdown reported. Transport operations will arrange a replacement vehicle and driver.");
      } else {
        await api.post("/emergencies", {
          tripId: trip._id,
          vehicleId: trip.vehicleId?._id,
          driverId: trip.driverId?._id,
          message: `${labels[incidentKind]}: ${details}`,
          severity: incidentKind === "ACCIDENT" ? "CRITICAL" : "HIGH",
          location
        });
        setMessage(`${labels[incidentKind]} alert sent to transport operations.`);
      }
      setIncidentPanelOpen(false);
      setIncidentDetails("");
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIncidentBusy(false);
    }
  }

  async function sendLocation() {
    try {
      const location = await currentLocation();
      if (!location) throw new Error("Location permission is unavailable. Enable GPS access and try again.");
      await api.post(`/trips/${trip._id}/gps`, { ...location, speed: 0 });
      window.alert("Your current location was shared.");
      await reload();
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <article className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">{isActive ? "Trip in progress" : isCompletionPending ? "Awaiting faculty confirmation" : "Next assigned trip"}</p>
          <h3 className="mt-1 text-lg font-semibold">{trip.destination}</h3>
          <p className="mt-1 text-sm text-slate-600">{trip.vehicleId?.vehicleId || "Vehicle pending"} · {trip.passengerCount} passengers · {trip.source}</p>
          <p className="mt-1 text-sm text-slate-600">Scheduled departure: {formatIndiaDateTime(trip.scheduledStartTime, "—")}</p>
          <p className="mt-1 text-sm text-slate-600">Scheduled return: {formatIndiaDateTime(trip.scheduledEndTime, "—")}</p>
        </div>
        <span className="badge badge-primary">{trip.status.replaceAll("_", " ")}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary btn-sm" to={`/trips/${trip._id}`}><KeyRound className="h-4 w-4" /> {isActive ? "Open trip" : isCompletionPending ? "Open completion OTP" : "Enter OTP & start"}</Link>
        {isActive ? <button className="btn btn-secondary btn-sm" onClick={sendLocation}><Navigation className="h-4 w-4" /> Share location</button> : null}
        {!isCompletionPending ? <button className="btn btn-error btn-sm" onClick={() => setIncidentPanelOpen((open) => !open)} disabled={incidentBusy}><AlertTriangle className="h-4 w-4" /> Emergency alert</button> : null}
      </div>
      {message ? <div className="alert mt-4">{message}</div> : null}
      {!isCompletionPending && incidentPanelOpen ? <div className="mt-4 rounded-xl border border-error/30 bg-error/5 p-4"><p className="font-semibold text-error">Report an incident</p><p className="mt-1 text-sm text-slate-600">Choose the situation so transport operations can respond correctly.</p><div className="mt-3 grid grid-cols-2 gap-2">{[["ACCIDENT", "Accident"], ["TRAFFIC", "Traffic"], ["BREAKDOWN", "Breakdown"], ["OTHER", "Other"]].map(([value, label]) => <button key={value} type="button" className={`btn btn-sm ${incidentKind === value ? "btn-error" : "btn-outline"}`} onClick={() => setIncidentKind(value)} disabled={incidentBusy}>{label}</button>)}</div><textarea className="textarea textarea-bordered mt-3 w-full" value={incidentDetails} onChange={(event) => setIncidentDetails(event.target.value)} placeholder="Add details for transport operations (optional)" disabled={incidentBusy} /><div className="mt-3 flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => setIncidentPanelOpen(false)} disabled={incidentBusy}>Cancel</button><button className="btn btn-error flex-1" onClick={submitIncident} disabled={incidentBusy}>{incidentBusy ? "Sending…" : incidentKind === "BREAKDOWN" ? "Report breakdown" : "Send alert"}</button></div></div> : null}
    </article>
  );
}

function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, demoMode: false }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}
