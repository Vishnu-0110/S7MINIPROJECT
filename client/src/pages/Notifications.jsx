import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";

export default function Notifications() {
  const { data, loading, error, reload } = useApiResource("/notifications");
  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    await reload();
  }
  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Notifications</h2>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <DataTable
        rows={data}
        columns={[
          { key: "title", label: "Title" },
          { key: "message", label: "Message" },
          { key: "type", label: "Type" },
          { key: "isRead", label: "Read", render: (row) => (row.isRead ? "Yes" : "No") },
          { key: "action", label: "Action", render: (row) => row.isRead ? "-" : <button className="btn btn-ghost btn-xs" onClick={() => markRead(row._id)}>Mark read</button> }
        ]}
      />
    </section>
  );
}
