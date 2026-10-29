import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

export default function DriverLeaves() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "TRANSPORT_ADMIN";
  const { data, loading, error, reload } = useApiResource("/driver-leaves");
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      setMessage("");
      await api.post("/driver-leaves", form);
      setForm({ fromDate: "", toDate: "", reason: "" });
      setMessage("Leave request submitted for transport-admin approval.");
      await reload();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  async function decide(id, status) {
    setBusy(id);
    try {
      await api.patch(`/driver-leaves/${id}`, { status });
      setMessage(`Leave request ${status.toLowerCase()}.`);
      await reload();
    } catch (decisionError) {
      setMessage(decisionError.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingState />;
  const columns = [
    ...(isAdmin ? [{ key: "driverId", label: "Driver", render: (row) => row.driverId?.userId?.name || "—" }] : []),
    { key: "fromDate", label: "From", render: (row) => new Date(row.fromDate).toLocaleDateString() },
    { key: "toDate", label: "To", render: (row) => new Date(row.toDate).toLocaleDateString() },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status" },
    ...(isAdmin ? [{ key: "action", label: "Action", render: (row) => row.status !== "PENDING" ? "—" : <div className="flex gap-2"><button className="btn btn-success btn-xs" disabled={busy === row._id} onClick={() => decide(row._id, "APPROVED")}><CheckCircle2 className="h-3 w-3" /> Approve</button><button className="btn btn-error btn-xs" disabled={busy === row._id} onClick={() => decide(row._id, "REJECTED")}><XCircle className="h-3 w-3" /> Reject</button></div> }] : [])
  ];

  return <section className="responsive-panel-grid workspace-grid">
    <div className="flex min-h-0 flex-col gap-4"><div><h2 className="text-lg font-semibold">{isAdmin ? "Driver Leave Approvals" : "My Leave Requests"}</h2><p className="mt-1 text-sm text-slate-500">Approved leave dates prevent the driver from being allocated to trips.</p></div>{error ? <div className="alert alert-error">{error}</div> : null}<div className="workspace-list-scroll flex-1"><DataTable rows={data} columns={columns} /></div></div>
    {!isAdmin ? <aside className="workspace-side-panel rounded-lg border border-slate-200 bg-white p-5"><h3 className="font-semibold">Apply for leave</h3><form className="mt-4 space-y-3" onSubmit={submit}><label className="form-control"><span className="label-text mb-1">From date</span><input className="input input-bordered" type="date" value={form.fromDate} onChange={(event) => setForm((current) => ({ ...current, fromDate: event.target.value }))} required /></label><label className="form-control"><span className="label-text mb-1">To date</span><input className="input input-bordered" type="date" value={form.toDate} min={form.fromDate} onChange={(event) => setForm((current) => ({ ...current, toDate: event.target.value }))} required /></label><label className="form-control"><span className="label-text mb-1">Reason for leave</span><textarea className="textarea textarea-bordered" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required /></label>{message ? <p className="text-sm text-slate-600">{message}</p> : null}<button className="btn btn-primary w-full"><Send className="h-4 w-4" /> Submit leave request</button></form></aside> : <aside className="workspace-side-panel rounded-lg border border-primary/20 bg-primary/5 p-5"><h3 className="font-semibold">Allocation rule</h3><p className="mt-2 text-sm text-slate-600">Approved leave requests automatically exclude the driver from allocations that overlap those dates.</p>{message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}</aside>}
  </section>;
}
