import { Download, Printer } from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { useState } from "react";

export default function Reports() {
  const { data: trips, loading, error } = useApiResource("/trips?limit=50");
  const token = useAuthStore((state) => state.token);
  const [message, setMessage] = useState("");

  async function downloadCsv() {
    try {
      setMessage("");
      const response = await fetch(`${api.defaults.baseURL}/reports/trips.csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Unable to download the report.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bit-smartfleet-trips.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-slate-500">CSV export and print-ready trip register from MongoDB Atlas data.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button className="btn btn-primary btn-sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-error">{message}</div> : null}
      <DataTable
        rows={trips}
        columns={[
          { key: "tripId", label: "Trip" },
          { key: "vehicle", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId || "-" },
          { key: "driver", label: "Driver", render: (row) => row.driverId?.userId?.name || "-" },
          { key: "destination", label: "Destination" },
          { key: "distance", label: "KM" },
          { key: "fuelEfficiency", label: "Fuel Eff." },
          { key: "status", label: "Status" }
        ]}
      />
    </section>
  );
}
