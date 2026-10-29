import { Link, useParams } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

export default function AssetHistory({ asset }) {
  const { id } = useParams();
  const { data, loading, error } = useApiResource(`/${asset}s/${id}/history`);
  if (loading) return <LoadingState />;
  const item = data?.[asset];
  const title = asset === "driver" ? item?.userId?.name || "Driver" : item?.vehicleId || "Vehicle";
  return <section className="space-y-6">
    <div><Link className="link link-primary text-sm" to={`/${asset}s`}>Back to {asset}s</Link><h2 className="mt-2 text-xl font-semibold">{title} trip record</h2><p className="mt-1 text-sm text-slate-600">{asset === "driver" ? `${item?.userId?.email || ""} · Licence: ${item?.licenseNumber || "—"} · Rating: ${item?.rating ?? "—"} / 5` : `${item?.registrationNumber || "—"} · ${item?.type || "—"} · Current odometer: ${item?.currentKM ?? "—"} km`}</p></div>
    {error ? <div className="alert alert-error">{error}</div> : null}
    <div><h3 className="mb-3 text-lg font-semibold">Trip history</h3><DataTable rows={data?.trips || []} columns={[{ key: "requestId", label: "Request", render: (row) => row.requestId?.requestId || row.tripId }, { key: "scheduledStartTime", label: "Date", render: (row) => row.scheduledStartTime ? new Date(row.scheduledStartTime).toLocaleString() : "—" }, { key: "destination", label: "Route", render: (row) => `${row.source || "—"} → ${row.destination || "—"}` }, { key: "startKM", label: "Start odometer" }, { key: "endKM", label: "End odometer" }, { key: "distance", label: "Distance" }, { key: "facultyRating", label: "Rating", render: (row) => row.facultyRating ? `${row.facultyRating} / 5` : "—" }, { key: "status", label: "Status" }, { key: "open", label: "Details", render: (row) => <Link className="link link-primary" to={`/trips/${row._id}`}>Open</Link> }]} /></div>
    <div><h3 className="mb-3 text-lg font-semibold">Emergency and breakdown alerts</h3><DataTable rows={data?.alerts || []} columns={[{ key: "alertId", label: "Alert" }, { key: "kind", label: "Type" }, { key: "severity", label: "Severity" }, { key: "message", label: "Details" }, { key: "status", label: "Status" }, { key: "createdAt", label: "Reported", render: (row) => new Date(row.createdAt).toLocaleString() }]} /></div>
  </section>;
}
