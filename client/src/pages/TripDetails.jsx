import { Html5QrcodeScanner } from "html5-qrcode";
import { Navigation, QrCode, SquareCheckBig } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

export default function TripDetails() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const [trip, setTrip] = useState(null);
  const [qr, setQr] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ startKM: "", endKM: "", fuelUsed: "", actualCost: "" });
  const [loading, setLoading] = useState(true);
  const scannerRef = useRef(null);

  async function load() {
    try {
      const [tripResult, qrResult] = await Promise.all([api.get(`/trips/${id}`), api.get(`/trips/${id}/qr`)]);
      setTrip(tripResult.data);
      setQr(qrResult.data.qr);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (user.role !== "DRIVER" || trip?.status !== "SCHEDULED") return undefined;
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 200, height: 200 } }, false);
    scanner.render(
      (decoded) => {
        setToken(decoded);
        setMessage("QR captured");
        scanner.clear();
      },
      () => undefined
    );
    scannerRef.current = scanner;
    return () => {
      scannerRef.current?.clear().catch((error) => {
        console.warn("QR scanner cleanup failed", error);
      });
    };
  }, [user.role, trip?.status]);

  async function verify() {
    try {
      await api.post(`/trips/${id}/qr/verify`, { qrToken: token });
      setMessage("QR verified. You can now start the trip.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function start() {
    try {
      await api.post(`/trips/${id}/start`, {
        startKM: Number(form.startKM),
        qrToken: token,
        location: await currentLocation()
      });
      setMessage("Trip started. You can now share GPS updates.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function end() {
    try {
      await api.post(`/trips/${id}/end`, {
        endKM: Number(form.endKM),
        fuelUsed: Number(form.fuelUsed || 0),
        actualCost: form.actualCost ? Number(form.actualCost) : undefined,
        location: await currentLocation()
      });
      setMessage("Trip completed successfully.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{trip.tripId}</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <p>Faculty: {trip.facultyId?.name}</p>
          <p>Department: {trip.departmentId?.code}</p>
          <p>Vehicle: {trip.vehicleId?.vehicleId}</p>
          <p>Driver: {trip.driverId?.userId?.name}</p>
          <p>Destination: {trip.destination}</p>
          <p>Status: {trip.status}</p>
          <p>Passengers: {trip.passengerCount}</p>
          <p>Fuel efficiency: {trip.fuelEfficiency || "-"} km/L</p>
        </div>
        {message ? <div className="alert mt-4">{message}</div> : null}
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">QR Trip Verification</h3>
          </div>
          {qr ? <img className="mx-auto mt-4 h-56 w-56" src={qr} alt="Trip QR code" /> : null}
          {user.role === "DRIVER" && trip.status === "SCHEDULED" ? (
            <div className="mt-4 space-y-3">
              <div id="qr-reader" aria-label="Camera QR code scanner" />
              <input className="input input-bordered w-full" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Scanned QR token" />
              <button className="btn btn-secondary w-full" onClick={verify}>
                <SquareCheckBig className="h-4 w-4" />
                Verify QR
              </button>
            </div>
          ) : null}
        </div>
        {user.role === "DRIVER" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              {trip.status === "SCHEDULED" ? <>
                <input className="input input-bordered w-full" min="0" type="number" value={form.startKM} onChange={(event) => setForm((current) => ({ ...current, startKM: event.target.value }))} placeholder="Starting odometer (KM)" />
                <button className="btn btn-success w-full" onClick={start} disabled={!form.startKM || !token}>Start trip</button>
              </> : null}
              {trip.status === "TRIP_STARTED" ? <>
                <input className="input input-bordered w-full" min={trip.startKM || 0} type="number" value={form.endKM} onChange={(event) => setForm((current) => ({ ...current, endKM: event.target.value }))} placeholder="Ending odometer (KM)" />
                <input className="input input-bordered w-full" min="0" type="number" value={form.fuelUsed} onChange={(event) => setForm((current) => ({ ...current, fuelUsed: event.target.value }))} placeholder="Fuel used (liters)" />
                <input className="input input-bordered w-full" min="0" type="number" value={form.actualCost} onChange={(event) => setForm((current) => ({ ...current, actualCost: event.target.value }))} placeholder="Fuel cost (optional)" />
                <button className="btn btn-error w-full" onClick={end} disabled={!form.endKM}>End trip</button>
              </> : null}
              {!["SCHEDULED", "TRIP_STARTED"].includes(trip.status) ? <p className="text-sm text-slate-500">This trip is {trip.status.replaceAll("_", " ").toLowerCase()}.</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <Navigation className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-600">Live GPS updates appear in the tracking screen when the driver starts sending location records.</p>
          </div>
        )}
      </aside>
    </section>
  );
}

function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
      () => resolve(undefined)
    );
  });
}
