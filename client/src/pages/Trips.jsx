import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";
import { connectSocket } from "../lib/socket.js";
import { useEffect } from "react";

export default function Trips() {
  const { data, loading, error, reload } = useApiResource("/trips");
  const trips = Array.isArray(data) ? data : [];
  useEffect(() => {
    const socket = connectSocket();
    socket.on("trip:reallocated", reload);
    return () => socket.off("trip:reallocated", reload);
  }, [reload]);
  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Trip Management</h2>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <DataTable
        rows={trips}
        columns={[
          { key: "requestId", label: "Request", render: (row) => row.requestId?.requestId || row.tripId },
          { key: "vehicleId", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId || "-" },
          { key: "driverId", label: "Driver", render: (row) => row.driverId?.userId?.name || "-" },
          { key: "destination", label: "Destination" },
          { key: "scheduledStartTime", label: "Scheduled departure", render: (row) => formatIndiaDateTime(row.scheduledStartTime, "—") },
          { key: "scheduledEndTime", label: "Scheduled return", render: (row) => formatIndiaDateTime(row.scheduledEndTime, "—") },
          { key: "status", label: "Status" },
          { key: "view", label: "View", render: (row) => <Link className="link link-primary" to={`/trips/${row._id}`}>Open</Link> }
        ]}
      />
    </section>
  );
}
