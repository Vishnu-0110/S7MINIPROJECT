import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";

export default function ApprovalCenter() {
  const { data, loading, error, reload } = useApiResource("/requests?status=PENDING_APPROVAL&actionable=true");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function decide(row, action) {
    setBusy(row._id);
    setMessage("");
    try {
      await api.post(`/requests/${row._id}/${action}`, { comments: action === "approve" ? "Approved" : "Rejected from approval center" });
      await reload();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingState />;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Approval Center</h2>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-error">{message}</div> : null}
      <DataTable
        rows={data}
        columns={[
          { key: "requestId", label: "Request" },
          { key: "tripType", label: "Type" },
          { key: "destination", label: "Destination" },
          { key: "priority", label: "Priority" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <button className="btn btn-success btn-xs" disabled={busy === row._id} onClick={() => decide(row, "approve")}>
                  <CheckCircle2 className="h-3 w-3" />
                  Approve
                </button>
                <button className="btn btn-error btn-xs" disabled={busy === row._id} onClick={() => decide(row, "reject")}>
                  <XCircle className="h-3 w-3" />
                  Reject
                </button>
              </div>
            )
          }
        ]}
      />
    </section>
  );
}
