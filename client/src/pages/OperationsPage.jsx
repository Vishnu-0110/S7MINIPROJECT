import { AlertTriangle, BellRing, CheckCircle2, Plus, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { connectSocket } from "../lib/socket.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";

const configs = {
  maintenance: {
    title: "Maintenance",
    columns: [
      { key: "vehicleId", label: "Vehicle", render: (row) => row.vehicleId?.registrationNumber || row.vehicleId?.vehicleId || row.vehicleId || "—" },
      { key: "type", label: "Type" },
      { key: "risk", label: "Risk" },
      { key: "status", label: "Status" },
      { key: "currentKM", label: "Current KM" },
      { key: "nextServiceKM", label: "Service due KM" },
      { key: "serviceDate", label: "Service due date", render: (row) => row.serviceDate ? new Date(row.serviceDate).toLocaleDateString() : "—" },
      { key: "expiresAt", label: "Expiry Date", render: (row) => row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—" }
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
      { key: "kind", label: "Type" },
      { key: "severity", label: "Severity" },
      { key: "message", label: "Message" },
      { key: "createdAt", label: "Reported", render: (row) => formatIndiaDateTime(row.createdAt, "—") },
      { key: "status", label: "Status" },
      { key: "location", label: "Location", render: (row) => {
        const location = row.location || row.lastKnownLocation;
        return location?.latitude !== undefined && location?.longitude !== undefined
          ? <a className="link link-primary" href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open map</a>
          : "Location unavailable";
      } }
    ],
    fields: ["tripId", "vehicleId", "driverId", "message"]
  }
};

export default function OperationsPage({ resource }) {
  const cfg = configs[resource];
  const { data, loading, error, reload } = useApiResource(resource === "maintenance" ? "/maintenance?limit=100" : `/${resource}`);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [options, setOptions] = useState({ vehicles: [], trips: [], drivers: [] });
  const user = useAuthStore((state) => state.user);
  const canAdd = resource !== "emergencies";
  const [alarmEnabled, setAlarmEnabled] = useState(false);

  useEffect(() => {
    if (resource !== "emergencies") return undefined;
    const socket = connectSocket();
    const onEmergency = () => {
      setMessage("A new emergency alert needs attention.");
      if (alarmEnabled) playAlarm();
      reload();
    };
    socket.on("emergency:new", onEmergency);
    socket.on("emergency:updated", reload);
    return () => {
      socket.off("emergency:new", onEmergency);
      socket.off("emergency:updated", reload);
    };
  }, [alarmEnabled, reload, resource]);

  useEffect(() => {
    Promise.all([api.get("/vehicles?limit=100"), api.get("/trips?limit=100"), api.get("/drivers?limit=100")])
      .then(([vehicles, trips, drivers]) => setOptions({ vehicles: vehicles.data || [], trips: trips.data || [], drivers: drivers.data || [] }))
      .catch((err) => setOptionsError(err.message || "Could not load form options."));
  }, []);

  useEffect(() => {
    if (resource !== "maintenance") return undefined;
    const timer = window.setInterval(reload, 60_000);
    return () => window.clearInterval(timer);
  }, [reload, resource]);

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

  async function acknowledgeEmergency(id) {
    try {
      await api.post(`/emergencies/${id}/acknowledge`);
      setMessage("Emergency acknowledged. The incident remains open until it is resolved.");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function silenceEmergency(id) {
    try {
      await api.post(`/emergencies/${id}/silence`);
      setMessage("Alarm stopped for your session. The incident is still active.");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function smartAllocateBreakdown(id) {
    try {
      await api.post(`/emergencies/${id}/smart-allocate`);
      setMessage("Replacement assignment completed. The faculty member can show the refreshed QR code to the new driver.");
      await reload();
    } catch (err) {
      setMessage(err.message);
      await reload();
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid workspace-grid">
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          {resource === "emergencies" ? <AlertTriangle className="h-5 w-5 text-error" /> : null}
          <h2 className="text-lg font-semibold">{cfg.title}</h2>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {optionsError ? <div className="alert alert-warning">Some selection lists could not be loaded: {optionsError}</div> : null}
        <div className="workspace-list-scroll flex-1"><DataTable
          rows={data}
          columns={resource === "emergencies" ? [...cfg.columns, { key: "action", label: "Action", render: (row) => row.status === "RESOLVED" || user?.role === "DRIVER" || user?.role === "FACULTY_STAFF" ? "-" : <div className="flex flex-wrap gap-2">{row.status === "OPEN" ? <button className="btn btn-warning btn-xs" onClick={() => acknowledgeEmergency(row._id)}><CheckCircle2 className="h-3 w-3" /> Acknowledge</button> : null}{row.kind === "BREAKDOWN" && user?.role === "TRANSPORT_ADMIN" && row.status !== "RESOLVED" ? <button className="btn btn-primary btn-xs" onClick={() => smartAllocateBreakdown(row._id)}>Smart allocate replacement</button> : null}<button className="btn btn-outline btn-xs" onClick={() => silenceEmergency(row._id)}><Volume2 className="h-3 w-3" /> Stop alarm</button><button className="btn btn-success btn-xs" onClick={() => resolveEmergency(row._id)}>Resolve</button></div> }] : cfg.columns}
        /></div>
      </div>
      {canAdd ? <aside className="workspace-side-panel rounded-lg border border-slate-200 bg-white p-5">
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
        : <aside className="workspace-side-panel rounded-lg border border-error/30 bg-error/5 p-5">
        <BellRing className="h-6 w-6 text-error" />
        <h3 className="mt-3 font-semibold">Emergency alerts</h3>
        <p className="mt-2 text-sm text-slate-600">Acknowledge takes responsibility, Stop alarm only silences your browser, and Resolve closes the incident after it is handled.</p>
        {user?.role !== "DRIVER" ? <button className={`btn mt-4 w-full ${alarmEnabled ? "btn-error" : "btn-outline"}`} onClick={() => setAlarmEnabled((enabled) => { const next = !enabled; if (next) playAlarm(); return next; })}><Volume2 className="h-4 w-4" /> {alarmEnabled ? "Audible alerts enabled" : "Enable audible alerts"}</button> : null}
      </aside>}
    </section>
  );
}

function playAlarm() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    oscillator.addEventListener("ended", () => context.close());
  } catch {}
}

function OperationField({ field, form, setForm, options }) {
  const value = form[field] || "";
  const update = (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const optionSets = {
    vehicleId: options.vehicles.map((item) => ({ value: item._id, label: `${item.vehicleId} — ${item.registrationNumber}` })),
    tripId: options.trips.map((item) => ({ value: item._id, label: `${item.requestId?.requestId || item.tripId} — ${item.destination}` })),
    driverId: options.drivers.map((item) => ({ value: item._id, label: item.driverId }))
  };
  if (optionSets[field]) {
    return <select className="select select-bordered w-full" value={value} onChange={update}><option value="">Select {field}</option>{optionSets[field].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
  }
  const type = ["currentKM", "nextServiceKM", "quantity", "pricePerLiter", "odometerReading", "amount"].includes(field) ? "number" : "text";
  return <input className="input input-bordered w-full" type={type} min={type === "number" ? "0" : undefined} placeholder={field} value={value} onChange={update} />;
}
