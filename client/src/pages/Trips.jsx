import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

export default function Trips() {
  const { data, loading, error } = useApiResource("/trips");
  const trips = Array.isArray(data) ? data : [];
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
          { key: "scheduledStartTime", label: "Date", render: (row) => row.scheduledStartTime ? new Date(row.scheduledStartTime).toLocaleString() : "-" },
          { key: "status", label: "Status" },
          { key: "view", label: "View", render: (row) => <Link className="link link-primary" to={`/trips/${row._id}`}>Open</Link> }
        ]}
      />
    </section>
  );
}
