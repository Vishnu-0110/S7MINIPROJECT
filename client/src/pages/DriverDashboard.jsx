import { AlertTriangle, Fuel, Navigation, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";

export default function DriverDashboard() {
  const { data, loading, error, reload } = useApiResource("/trips");
  const activeTrip = data.find((trip) => trip.status === "TRIP_STARTED");
  const scheduledTrip = data.find((trip) => trip.status === "SCHEDULED");

  if (loading) return <LoadingState />;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Driver workspace</p>
          <h2 className="text-xl font-semibold text-slate-950">Today’s trips</h2>
          <p className="mt-1 text-sm text-slate-500">Verify the QR code before starting. Location sharing is available only while a trip is active.</p>
        </div>
        <Link className="btn btn-outline btn-sm" to="/fuel"><Fuel className="h-4 w-4" /> Fuel log</Link>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {activeTrip ? <TripActionCard trip={activeTrip} reload={reload} /> : null}
      {!activeTrip && scheduledTrip ? <TripActionCard trip={scheduledTrip} reload={reload} /> : null}
      {!activeTrip && !scheduledTrip ? <div className="app-surface p-5 text-sm text-slate-600">There are no scheduled or active trips assigned to you.</div> : null}
      <div>
      <h3 className="mb-3 font-semibold">Trip history</h3>
      <DataTable
        rows={data}
        columns={[
          { key: "tripId", label: "Trip" },
          { key: "vehicle", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId || "-" },
          { key: "pickup", label: "Pickup", render: (row) => row.source || "-" },
          { key: "destination", label: "Destination" },
          { key: "status", label: "Status" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => <Link className="btn btn-ghost btn-xs" to={`/trips/${row._id}`}>Open</Link>
          }
        ]}
      />
      </div>
    </section>
  );
}

function TripActionCard({ trip, reload }) {
  const isActive = trip.status === "TRIP_STARTED";

  async function reportEmergency() {
    if (!window.confirm("Send an emergency alert to transport operations?")) return;
    try {
      await api.post("/emergencies", {
        tripId: trip._id,
        vehicleId: trip.vehicleId?._id,
        driverId: trip.driverId?._id,
        message: "Driver emergency button pressed",
        location: await currentLocation()
      });
      window.alert("Emergency alert sent to transport operations.");
    } catch (error) {
      window.alert(error.message);
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
          <p className="text-sm font-medium text-primary">{isActive ? "Trip in progress" : "Next assigned trip"}</p>
          <h3 className="mt-1 text-lg font-semibold">{trip.destination}</h3>
          <p className="mt-1 text-sm text-slate-600">{trip.vehicleId?.vehicleId || "Vehicle pending"} · {trip.passengerCount} passengers · {trip.source}</p>
        </div>
        <span className="badge badge-primary">{trip.status.replaceAll("_", " ")}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary btn-sm" to={`/trips/${trip._id}`}><QrCode className="h-4 w-4" /> {isActive ? "Open trip" : "Verify & start"}</Link>
        {isActive ? <button className="btn btn-secondary btn-sm" onClick={sendLocation}><Navigation className="h-4 w-4" /> Share location</button> : null}
        <button className="btn btn-error btn-sm" onClick={reportEmergency}><AlertTriangle className="h-4 w-4" /> Emergency</button>
      </div>
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
