import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
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

const userDepartments = ["CSE", "ECE", "EEE", "CSD", "AIDS", "AIML", "ISE"];

const config = {
  vehicles: {
    title: "Vehicle Management",
    defaults: { fuelType: "Diesel", fuelLevel: 75, mileageKmPerLiter: 4, currentKM: 0 },
    columns: [
      { key: "vehicleId", label: "Vehicle" },
      { key: "registrationNumber", label: "Registration" },
      { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" },
      { key: "status", label: "Status" }
    ],
    fields: ["vehicleId", "registrationNumber", "name", "type", "capacity", "facilities", "fuelType", "fuelLevel", "mileageKmPerLiter", "currentKM"]
  },
  drivers: {
    title: "Driver Management",
    defaults: { assignedVehicleTypes: [] },
    columns: [
      { key: "driverId", label: "Driver" },
      { key: "licenseNumber", label: "License" },
      { key: "status", label: "Status" },
      { key: "rating", label: "Rating" }
    ],
    fields: ["userId", "driverId", "licenseNumber", "phone"],
    selects: { userId: "drivers" }
  },
  users: {
    title: "User Management",
    defaults: { role: "FACULTY_STAFF", password: "SmartFleet@123", department: "" },
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "departmentId", label: "Department", render: (row) => row.departmentId?.code || "—" },
      { key: "isActive", label: "Active", render: (row) => (row.isActive ? "Yes" : "No") }
    ],
    fields: ["name", "email", "password", "department", "phone"]
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
    title: "Vehicle Documents",
    defaults: {},
    columns: [
      { key: "type", label: "Document Type" },
      { key: "vehicleType", label: "Vehicle Type" },
      { key: "vehicleId", label: "Vehicle Number", render: (row) => row.vehicleId?.registrationNumber || "—" },
      { key: "expiresAt", label: "Expiry Date", render: (row) => row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—" }
    ],
    fields: ["type", "vehicleType", "vehicleId", "expiresAt"],
    selects: { type: "documentTypes", vehicleType: "vehicleTypes", vehicleId: "vehicleNumbers" }
  }
};

export default function ManagementPage({ resource }) {
  const cfg = config[resource];
  const { data, loading, error, reload } = useApiResource(resource === "users" ? "/users?limit=100" : `/${resource}`);
  const [form, setForm] = useState(cfg.defaults || {});
  const [message, setMessage] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [options, setOptions] = useState({ vehicles: [], users: [], departments: [] });
  const [selectedUserType, setSelectedUserType] = useState("FACULTY_STAFF");

  useEffect(() => {
    Promise.all([api.get("/vehicles?limit=100"), api.get("/users?limit=100"), api.get("/departments?limit=100")])
      .then(([vehicles, users, departments]) => setOptions({ vehicles: vehicles.data || [], users: users.data || [], departments: departments.data || [] }))
      .catch((err) => setOptionsError(err.message || "Could not load form options."));
  }, []);

  async function submit(event) {
    event.preventDefault();
    try {
      const payload = resource === "users"
        ? { ...form, role: selectedUserType }
        : resource === "vehicle-documents"
        ? { ...form, vehicleType: options.vehicles.find((vehicle) => vehicle._id === form.vehicleId)?.type }
        : resource === "vehicles" && typeof form.facilities === "string"
        ? { ...form, facilities: form.facilities.split(",").map((value) => value.trim()).filter(Boolean) }
        : form;
      await api.post(`/${resource}`, payload);
      setForm(resource === "users" ? { ...cfg.defaults, role: selectedUserType } : cfg.defaults || {});
      setMessage("Saved");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{cfg.title}</h2>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {optionsError ? <div className="alert alert-warning">Some selection lists could not be loaded: {optionsError}</div> : null}
        {resource === "users" ? <>
          <label className="form-control max-w-sm">
            <span className="label-text mb-1 font-medium">What type of user do you want?</span>
            <select className="select select-bordered w-full" value={selectedUserType} onChange={(event) => setSelectedUserType(event.target.value)}>
              {userTypes.map((type) => <option key={type.role} value={type.role}>{type.label}</option>)}
            </select>
          </label>
          <DataTable rows={data.filter((user) => user.role === selectedUserType)} columns={cfg.columns} />
        </> : <DataTable rows={data} columns={cfg.columns} />}
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">{resource === "users" ? `Add ${userTypes.find((type) => type.role === selectedUserType)?.label}` : resource === "vehicle-documents" ? "Add vehicle document" : `Add ${resource.slice(0, -1)}`}</h3>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          {[...cfg.fields, ...(resource === "users" && selectedUserType === "DRIVER" ? ["licenseNumber"] : [])].map((field) => <ManagementField key={field} field={field} kind={cfg.selects?.[field]} form={form} setForm={setForm} options={options} />)}
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
  const update = (event) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === "vehicleType" ? { vehicleId: "" } : {}) }));
  const choices = {
    vehicles: options.vehicles.map((item) => ({ value: item._id, label: `${item.vehicleId} — ${item.registrationNumber}` })),
    departments: options.departments.map((item) => ({ value: item._id, label: `${item.code} — ${item.name}` })),
    drivers: options.users.filter((item) => item.role === "DRIVER").map((item) => ({ value: item._id, label: `${item.name} (${item.email})` })),
    coordinators: options.users.filter((item) => item.role === "DEPARTMENT_COORDINATOR").map((item) => ({ value: item._id, label: `${item.name} (${item.email})` })),
    documentTypes: [
      { value: "RC", label: "RC" },
      { value: "INSURANCE", label: "Insurance" },
      { value: "FC", label: "FC" },
      { value: "POLLUTION_CERTIFICATE", label: "Pollution Certificate" }
    ],
    vehicleTypes: [...new Set(options.vehicles.map((item) => item.type).filter(Boolean))].map((item) => ({ value: item, label: item })),
    vehicleNumbers: options.vehicles.filter((item) => !form.vehicleType || item.type === form.vehicleType).map((item) => ({ value: item._id, label: `${item.registrationNumber} (${item.vehicleId})` }))
  };
  if (kind) {
    const label = field === "type" ? "Document type" : field === "vehicleType" ? "Vehicle type" : field === "vehicleId" ? "Vehicle number" : field;
    return <label className="form-control w-full"><span className="label-text mb-1 capitalize">{label}</span><select className="select select-bordered w-full" value={value} onChange={update} required={["type", "vehicleType", "vehicleId"].includes(field)}><option value="">Select {label.toLowerCase()}</option>{choices[kind].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
  }
  const type = ["capacity", "fuelLevel", "mileageKmPerLiter", "currentKM"].includes(field) ? "number" : field === "expiresAt" ? "date" : "text";
  if (field === "password") return <label className="form-control w-full"><span className="label-text mb-1 capitalize">Password</span><PasswordField className="input input-bordered w-full" placeholder={field} value={value} onChange={update} required /></label>;
  const inputType = field === "email" ? "email" : type;
  const label = field === "expiresAt" ? "Expiry date" : field;
  return <label className="form-control w-full"><span className="label-text mb-1 capitalize">{label}</span><input className="input input-bordered w-full" type={inputType} min={type === "number" ? "0" : undefined} placeholder={field === "facilities" ? "facilities, separated by commas" : field} value={value} onChange={update} required={field === "name" || field === "email" || field === "licenseNumber" || field === "expiresAt"} /></label>;
}
