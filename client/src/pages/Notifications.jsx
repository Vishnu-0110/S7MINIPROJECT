import { useEffect } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";

export default function Notifications() {
  const { data, loading, error, reload } = useApiResource("/notifications");
  useEffect(() => {
    const socket = connectSocket();
    socket.on("notification:new", reload);
    return () => socket.off("notification:new", reload);
  }, [reload]);
  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    await reload();
  }
  async function markAllRead() {
    await api.patch("/notifications/read-all");
    await reload();
  }
  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Notifications</h2><button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={!data.some((notification) => !notification.isRead)}>Mark all as read</button></div>
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
