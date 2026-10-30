import { Download, Printer } from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { useState } from "react";
import { formatIndiaDateTime } from "../lib/dateTime.js";

export default function Reports() {
  const { data: trips, loading, error } = useApiResource("/trips?limit=50");
  const { data: costs, loading: costsLoading, error: costsError } = useApiResource("/reports/trip-costs");
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
      {costsError ? <div className="alert alert-error">{costsError}</div> : null}
      <section className="space-y-3">
        <div><p className="page-kicker">Financial view</p><h3 className="text-lg font-semibold">Trip cost summary</h3><p className="page-description">Fuel and other expenses are calculated from records linked to each trip.</p></div>
        {costsLoading ? <LoadingState label="Loading trip costs" /> : <DataTable rows={costs || []} columns={[
          { key: "tripId", label: "Trip" },
          { key: "vehicle", label: "Vehicle" },
          { key: "driver", label: "Driver" },
          { key: "distance", label: "KM", render: (row) => row.distance ? `${row.distance} km` : "—" },
          { key: "fuelCost", label: "Fuel", render: (row) => `₹${row.fuelCost.toFixed(2)}` },
          { key: "otherExpenses", label: "Other", render: (row) => `₹${row.otherExpenses.toFixed(2)}` },
          { key: "totalCost", label: "Total", render: (row) => `₹${row.totalCost.toFixed(2)}` },
          { key: "costPerKm", label: "Cost/KM", render: (row) => row.costPerKm === null ? "—" : `₹${row.costPerKm.toFixed(2)}` }
        ]} />}
      </section>
      <section className="space-y-3">
        <div><p className="page-kicker">Operational view</p><h3 className="text-lg font-semibold">Trip register</h3></div>
      <DataTable
        rows={trips}
        columns={[
          { key: "requestId", label: "Request", render: (row) => row.requestId?.requestId || row.tripId },
          { key: "vehicle", label: "Vehicle", render: (row) => row.vehicleId?.vehicleId || "-" },
          { key: "driver", label: "Driver", render: (row) => row.driverId?.userId?.name || "-" },
          { key: "destination", label: "Destination" },
          { key: "scheduledStartTime", label: "Scheduled departure", render: (row) => formatIndiaDateTime(row.scheduledStartTime, "—") },
          { key: "scheduledEndTime", label: "Scheduled return", render: (row) => formatIndiaDateTime(row.scheduledEndTime, "—") },
          { key: "distance", label: "KM" },
          { key: "fuelEfficiency", label: "Fuel Eff." },
          { key: "status", label: "Status" }
        ]}
      />
      </section>
    </section>
  );
}
