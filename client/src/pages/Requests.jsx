import { CheckCircle2, Clock3, Eye, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { useAuthStore } from "../store/authStore.js";
import { api } from "../lib/api.js";

export default function Requests() {
  const { data, loading, error, reload } = useApiResource("/requests");
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === "FACULTY_STAFF";
  const canAllocate = user?.role === "TRANSPORT_ADMIN";
  const [message, setMessage] = useState("");
  const [approvalDetails, setApprovalDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function showApprovalDetails(id) {
    setDetailsLoading(true);
    setMessage("");
    try {
      const result = await api.get(`/requests/${id}`);
      setApprovalDetails(result.data);
    } catch (detailsError) {
      setMessage(detailsError.message);
    } finally {
      setDetailsLoading(false);
    }
  }
  async function cancelRequest(id) {
    if (!window.confirm("Cancel this request?")) return;
    try {
      setMessage("");
      await api.post(`/requests/${id}/cancel`);
      setMessage("Request cancelled.");
      await reload();
    } catch (cancelError) {
      setMessage(cancelError.message);
    }
  }
  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Vehicle Requests</h2>
        {canCreate ? <Link className="btn btn-primary btn-sm" to="/request/new">New request</Link> : null}
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-info">{message}</div> : null}
      <DataTable
        rows={data}
        columns={[
          { key: "requestId", label: "Request" },
          { key: "facultyId", label: "Faculty", render: (row) => row.facultyId?.name || "Faculty" },
          { key: "tripType", label: "Type" },
          { key: "destination", label: "Destination" },
          { key: "passengerCount", label: "Passengers" },
          { key: "status", label: "Status" },
          {
            key: "action",
            label: "Action",
            render: (row) =>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-ghost btn-xs" onClick={() => showApprovalDetails(row._id)} disabled={detailsLoading} title="View approval progress"><Eye className="h-3 w-3" />Progress</button>
                {canAllocate && row.status === "APPROVED_AWAITING_VEHICLE" ? <Link className="link link-primary" to={`/requests/${row._id}/allocation`}>Find vehicle</Link> : null}
                {["PENDING_APPROVAL", "APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(row.status) && (user?.role === "FACULTY_STAFF" || canAllocate) ? <button className="link link-error" onClick={() => cancelRequest(row._id)}>Cancel</button> : null}
              </div>
          }
        ]}
      />
      {approvalDetails ? <ApprovalTimeline details={approvalDetails} onClose={() => setApprovalDetails(null)} /> : null}
    </section>
  );
}

function ApprovalTimeline({ details, onClose }) {
  const { request, approvals = [] } = details;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker">Approval progress</p>
          <h3 className="text-lg font-semibold">{request.requestId} · {request.status.replaceAll("_", " ")}</h3>
          <p className="mt-1 text-sm text-slate-500">Approval version {request.approvalVersion || 1}. Both the Department Coordinator and Transport Administrator must approve before a vehicle is assigned.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {approvals.map((approval) => <ApprovalStep key={approval._id} approval={approval} />)}
      </div>
    </div>
  );
}

function ApprovalStep({ approval }) {
  const approved = approval.status === "APPROVED";
  const rejected = approval.status === "REJECTED";
  const Icon = approved ? CheckCircle2 : rejected ? XCircle : Clock3;
  const tone = approved ? "text-success" : rejected ? "text-error" : "text-warning";
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${tone}`} />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Step {approval.level}</span>
      </div>
      <p className="mt-3 font-semibold">{approval.approverRole.replaceAll("_", " ")}</p>
      <p className={`mt-1 text-sm font-medium ${tone}`}>{approval.status}</p>
      {approval.approverId?.name ? <p className="mt-2 text-xs text-slate-500">Handled by {approval.approverId.name}</p> : null}
      {approval.comments ? <p className="mt-2 text-xs text-slate-500">{approval.comments}</p> : null}
    </div>
  );
}
