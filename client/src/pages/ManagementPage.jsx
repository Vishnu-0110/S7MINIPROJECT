import { Ban, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import PasswordField from "../components/PasswordField.jsx";

const userTypes = [
  { role: "FACULTY_STAFF", label: "Faculty" },
  { role: "DRIVER", label: "Driver" },
  { role: "DEPARTMENT_COORDINATOR", label: "Department Coordinator" },
  { role: "TRANSPORT_ADMIN", label: "Transport Admin" }
];

const config = {
  vehicles: {
    title: "Vehicle Management",
    defaults: { fuelType: "Diesel", currentKM: 0 },
    columns: [
      { key: "vehicleId", label: "Vehicle" },
      { key: "registrationNumber", label: "Registration" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" },
      { key: "facilities", label: "Facilities", render: (row) => row.facilities?.length ? row.facilities.join(", ") : "—" },
      { key: "fuelType", label: "Fuel Type" },
      { key: "currentKM", label: "Current Odometer", render: (row) => row.currentKM !== undefined ? `${row.currentKM} km` : "—" },
      { key: "nextServiceKM", label: "Service Due", render: (row) => row.nextServiceKM !== undefined ? `${row.nextServiceKM} km` : "—" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Added", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—" },
      { key: "history", label: "Details", render: (row) => <Link className="link link-primary" to={`/vehicles/${row._id}/history`}>View history</Link> }
    ],
    fields: ["registrationNumber", "type", "capacity", "facilities", "fuelType", "currentKM"],
    selects: { type: "vehicleTypes" }
  },
  drivers: {
    title: "Driver Management",
    defaults: {},
    columns: [
      { key: "driverId", label: "Driver" },
      { key: "userId", label: "Name", render: (row) => row.userId?.name || "—" },
      { key: "userId", label: "Email", render: (row) => row.userId?.email || "—" },
      { key: "licenseNumber", label: "License" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
      { key: "rating", label: "Rating" },
      { key: "history", label: "Details", render: (row) => <Link className="link link-primary" to={`/drivers/${row._id}/history`}>View history</Link> }
    ],
    fields: ["name", "licenseNumber", "phone", "address"]
  },
  users: {
    title: "User Management",
    defaults: { role: "FACULTY_STAFF", password: "SmartFleet@123" },
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "isActive", label: "Active", render: (row) => (row.isActive ? "Yes" : "No") }
    ],
    fields: ["name", "email", "password", "phone"]
  },
  departments: {
    title: "Department Management",
    defaults: { isActive: true },
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "isActive", label: "Active", render: (row) => (row.isActive ? "Yes" : "No") }
    ],
    fields: ["code", "name", "coordinatorId"],
    selects: { coordinatorId: "coordinators" }
  },
  "vehicle-documents": {
    title: "Vehicle Document History",
    defaults: {},
    columns: [
      { key: "type", label: "Document Type" },
      { key: "vehicleType", label: "Vehicle Type" },
      { key: "vehicleId", label: "Vehicle Number", render: (row) => row.vehicleId?.registrationNumber || "—" },
      { key: "expiresAt", label: "Expiry Date", render: (row) => row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—" },
      { key: "createdAt", label: "Added", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—" },
      { key: "status", label: "Status", render: (row) => new Date(row.expiresAt) < new Date() ? "Expired" : "Current" }
    ],
    fields: ["type", "vehicleType", "vehicleNumber", "expiresAt"],
    selects: { type: "documentTypes", vehicleType: "vehicleTypes" }
  }
};

export default function ManagementPage({ resource }) {
  const cfg = config[resource];
  const { data, loading, error, reload } = useApiResource(resource === "users" ? "/users?limit=100" : `/${resource}`);
  const { data: trips, reload: reloadTrips } = useApiResource("/trips?limit=100");
  const [form, setForm] = useState(cfg.defaults || {});
  const [message, setMessage] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [options, setOptions] = useState({ vehicles: [], users: [], drivers: [] });
  const [selectedUserType, setSelectedUserType] = useState("FACULTY_STAFF");
  const [cancellingTripId, setCancellingTripId] = useState("");

  const assignedTripStatuses = ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"];
  const assignmentFor = (row) => (trips || []).find((trip) => assignedTripStatuses.includes(trip.status) && String(resource === "vehicles" ? trip.vehicleId?._id || trip.vehicleId : trip.driverId?._id || trip.driverId) === String(row._id));

  async function cancelAssignment(trip) {
    if (!trip || cancellingTripId) return;
    if (!window.confirm(`Cancel the assignment for ${trip.tripId}? The faculty member, driver, and fleet records will be updated.`)) return;
    setCancellingTripId(trip._id);
    try {
      await api.post(`/trips/${trip._id}/cancel`, {});
      setMessage("Trip assignment cancelled. The vehicle and driver are available again.");
      await Promise.all([reload(), reloadTrips()]);
    } catch (err) {
      setMessage(err.message || "Could not cancel the trip assignment.");
    } finally {
      setCancellingTripId("");
    }
  }

  const columns = (resource === "vehicles" || resource === "drivers") ? [
    ...cfg.columns,
    { key: "assignment", label: "Current assignment", render: (row) => {
      const trip = assignmentFor(row);
      return trip ? `${trip.tripId} — ${trip.facultyId?.name || "Faculty"}` : "Available";
    } },
    { key: "cancelAssignment", label: "Assignment action", render: (row) => {
      const trip = assignmentFor(row);
      return trip ? <button className="btn btn-error btn-xs" disabled={cancellingTripId === trip._id} onClick={() => cancelAssignment(trip)}><Ban className="h-3 w-3" /> {cancellingTripId === trip._id ? "Cancelling…" : "Cancel trip"}</button> : "—";
    } }
  ] : cfg.columns;

  useEffect(() => {
    Promise.all([api.get("/vehicles?limit=100"), api.get("/users?limit=100"), api.get("/drivers?limit=100")])
      .then(([vehicles, users, drivers]) => setOptions({ vehicles: vehicles.data || [], users: users.data || [], drivers: drivers.data || [] }))
      .catch((err) => setOptionsError(err.message || "Could not load form options."));
  }, []);

  async function submit(event) {
    event.preventDefault();
    try {
      const isDriverUser = resource === "users" && selectedUserType === "DRIVER";
      const payload = resource === "users" && !isDriverUser
        ? { ...form, role: selectedUserType, department: undefined, departmentId: undefined }
        : resource === "vehicles" && typeof form.facilities === "string"
        ? { ...form, facilities: form.facilities.split(",").map((value) => value.trim()).filter(Boolean) }
        : form;
      const result = await api.post(isDriverUser ? "/drivers" : `/${resource}`, payload);
      setForm(resource === "users" ? (isDriverUser ? {} : { ...cfg.defaults, role: selectedUserType }) : cfg.defaults || {});
      const credentials = resource === "drivers" || isDriverUser ? result.data?.credentials : null;
      setMessage(credentials ? `Driver added. Login: ${credentials.email} | Default password: ${credentials.password}` : "Saved");
      await reload();
      if (isDriverUser) {
        const drivers = await api.get("/drivers?limit=100");
        setOptions((current) => ({ ...current, drivers: drivers.data || [] }));
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid workspace-grid">
      <div className="flex min-h-0 flex-col gap-4">
        <h2 className="text-lg font-semibold">{cfg.title}</h2>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {optionsError ? <div className="alert alert-warning">Some selection lists could not be loaded: {optionsError}</div> : null}
        {resource === "users" ? <>
          <label className="form-control max-w-sm">
            <span className="label-text mb-1 font-medium">What type of user do you want?</span>
            <select className="select select-bordered w-full" value={selectedUserType} onChange={(event) => {
              const role = event.target.value;
              setSelectedUserType(role);
              setForm(role === "DRIVER" ? {} : { ...cfg.defaults, role });
              setMessage("");
            }}>
              {userTypes.map((type) => <option key={type.role} value={type.role}>{type.label}</option>)}
            </select>
          </label>
          <div className="workspace-list-scroll flex-1"><DataTable rows={selectedUserType === "DRIVER" ? options.drivers : data.filter((user) => user.role === selectedUserType)} columns={selectedUserType === "DRIVER" ? config.drivers.columns : cfg.columns} /></div>
        </> : <div className="workspace-list-scroll flex-1"><DataTable rows={data} columns={columns} /></div>}
      </div>
      <aside className="workspace-side-panel rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">{resource === "users" ? `Add ${userTypes.find((type) => type.role === selectedUserType)?.label}` : resource === "vehicle-documents" ? "Add vehicle document" : `Add ${resource.slice(0, -1)}`}</h3>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          {(resource === "drivers" || (resource === "users" && selectedUserType === "DRIVER")) ? <p className="text-sm text-slate-500">A BIT account will be created automatically using the driver’s name and the default password SmartFleet@123.</p> : null}
          {(resource === "users" && selectedUserType === "DRIVER" ? config.drivers.fields : cfg.fields).map((field) => <ManagementField key={field} field={field} kind={cfg.selects?.[field]} form={form} setForm={setForm} options={options} />)}
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
          <button className="btn btn-primary w-full">
            <Plus className="h-4 w-4" />
            Save
          </button>
        </form>
      </aside>
    </section>
  );
}

function ManagementField({ field, kind, form, setForm, options }) {
  const value = form[field] || "";
  const update = (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const choices = {
    vehicles: options.vehicles.map((item) => ({ value: item._id, label: `${item.vehicleId} — ${item.registrationNumber}` })),
    drivers: options.users.filter((item) => item.role === "DRIVER").map((item) => ({ value: item._id, label: `${item.name} (${item.email})` })),
    coordinators: options.users.filter((item) => item.role === "DEPARTMENT_COORDINATOR").map((item) => ({ value: item._id, label: `${item.name} (${item.email})` })),
    documentTypes: [
      { value: "RC", label: "RC" },
      { value: "INSURANCE", label: "Insurance" },
      { value: "FC", label: "FC" },
      { value: "POLLUTION_CERTIFICATE", label: "Pollution Certificate" }
    ],
    vehicleTypes: ["Bus", "Van"].map((item) => ({ value: item, label: item }))
  };
  if (kind) {
    const label = kind === "documentTypes" ? "Document type" : field === "type" || field === "vehicleType" ? "Vehicle type" : field;
    return <label className="form-control w-full"><span className="label-text mb-1 capitalize">{label}</span><select className="select select-bordered w-full" value={value} onChange={update} required={["type", "vehicleType"].includes(field)}><option value="">Select {label.toLowerCase()}</option>{choices[kind].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
  }
  const type = ["capacity", "fuelLevel", "mileageKmPerLiter", "currentKM"].includes(field) ? "number" : field === "expiresAt" ? "date" : "text";
  if (field === "password") return <label className="form-control w-full"><span className="label-text mb-1 capitalize">Password</span><PasswordField className="input input-bordered w-full" placeholder={field} value={value} onChange={update} required /></label>;
  const inputType = field === "email" ? "email" : type;
  const label = field === "expiresAt" ? "Expiry date" : field === "vehicleNumber" ? "Vehicle number" : field;
  if (field === "address") return <label className="form-control w-full"><span className="label-text mb-1 capitalize">Address</span><textarea className="textarea textarea-bordered w-full" placeholder="Address" value={value} onChange={update} required /></label>;
  return <label className="form-control w-full"><span className="label-text mb-1 capitalize">{label}</span><input className="input input-bordered w-full" type={inputType} min={type === "number" ? "0" : undefined} placeholder={field === "facilities" ? "facilities, separated by commas" : field === "vehicleNumber" ? "Enter registration number" : field} value={value} onChange={update} required={field === "name" || field === "email" || field === "licenseNumber" || field === "phone" || field === "expiresAt" || field === "vehicleNumber"} /></label>;
}
