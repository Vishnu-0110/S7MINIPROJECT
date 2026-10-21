import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const configs = {
  maintenance: {
    title: "Maintenance",
    columns: [
      { key: "vehicleId", label: "Vehicle" },
      { key: "type", label: "Type" },
      { key: "risk", label: "Risk" },
      { key: "status", label: "Status" }
    ],
    fields: ["vehicleId", "type", "currentKM", "nextServiceKM", "notes"]
  },
  fuel: {
    title: "Fuel Management",
    columns: [
      { key: "vehicleId", label: "Vehicle" },
      { key: "quantity", label: "Liters" },
      { key: "totalAmount", label: "Amount" },
      { key: "efficiency", label: "Efficiency" }
    ],
    fields: ["vehicleId", "tripId", "quantity", "pricePerLiter", "odometerReading", "fuelStation"]
  },
  expenses: {
    title: "Expense Management",
    columns: [
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount" },
      { key: "notes", label: "Notes" }
    ],
    fields: ["vehicleId", "tripId", "category", "amount", "notes"]
  },
  emergencies: {
    title: "Emergency Center",
    columns: [
      { key: "alertId", label: "Alert" },
      { key: "message", label: "Message" },
      { key: "status", label: "Status" }
    ],
    fields: ["tripId", "vehicleId", "driverId", "message"]
  }
};

export default function OperationsPage({ resource }) {
  const cfg = configs[resource];
  const { data, loading, error, reload } = useApiResource(`/${resource}`);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [options, setOptions] = useState({ vehicles: [], trips: [], drivers: [] });
  const user = useAuthStore((state) => state.user);
  const canAdd = resource !== "emergencies" || user?.role !== "DRIVER";

  useEffect(() => {
    Promise.all([api.get("/vehicles"), api.get("/trips"), api.get("/drivers")])
      .then(([vehicles, trips, drivers]) => setOptions({ vehicles: vehicles.data || [], trips: trips.data || [], drivers: drivers.data || [] }))
      .catch((err) => setOptionsError(err.message || "Could not load form options."));
  }, []);

  async function submit(event) {
    event.preventDefault();
    try {
      await api.post(`/${resource}`, form);
      setForm({});
      setMessage("Saved");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function resolveEmergency(id) {
    try {
      await api.patch(`/emergencies/${id}`, { status: "RESOLVED" });
      setMessage("Emergency marked as resolved");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {resource === "emergencies" ? <AlertTriangle className="h-5 w-5 text-error" /> : null}
          <h2 className="text-lg font-semibold">{cfg.title}</h2>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {optionsError ? <div className="alert alert-warning">Some selection lists could not be loaded: {optionsError}</div> : null}
        <DataTable
          rows={data}
          columns={resource === "emergencies" ? [...cfg.columns, { key: "action", label: "Action", render: (row) => row.status === "RESOLVED" || user?.role === "DRIVER" ? "-" : <button className="btn btn-success btn-xs" onClick={() => resolveEmergency(row._id)}>Resolve</button> }] : cfg.columns}
        />
      </div>
      {canAdd ? <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Add record</h3>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          {cfg.fields.map((field) => <OperationField key={field} field={field} form={form} setForm={setForm} options={options} />)}
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
          <button className="btn btn-primary w-full">
            <Plus className="h-4 w-4" />
            Save
          </button>
        </form>
      </aside>
        : <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Need urgent help?</h3>
        <p className="mt-2 text-sm text-slate-600">Use the Emergency action in your Driver Workspace. It automatically sends the active trip, vehicle, driver, and location details.</p>
      </aside>}
    </section>
  );
}

function OperationField({ field, form, setForm, options }) {
  const value = form[field] || "";
  const update = (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const optionSets = {
    vehicleId: options.vehicles.map((item) => ({ value: item._id, label: `${item.vehicleId} — ${item.registrationNumber}` })),
    tripId: options.trips.map((item) => ({ value: item._id, label: `${item.tripId} — ${item.destination}` })),
    driverId: options.drivers.map((item) => ({ value: item._id, label: item.driverId }))
  };
  if (optionSets[field]) {
    return <select className="select select-bordered w-full" value={value} onChange={update}><option value="">Select {field}</option>{optionSets[field].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
  }
  const type = ["currentKM", "nextServiceKM", "quantity", "pricePerLiter", "odometerReading", "amount"].includes(field) ? "number" : "text";
  return <input className="input input-bordered w-full" type={type} min={type === "number" ? "0" : undefined} placeholder={field} value={value} onChange={update} />;
}
