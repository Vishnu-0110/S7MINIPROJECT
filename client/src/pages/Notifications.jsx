import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { formatIndiaDateTime } from "../lib/dateTime.js";
import { useNotificationStore } from "../store/notificationStore.js";

export default function Notifications() {
  const data = useNotificationStore((state) => state.notifications);
  const loading = useNotificationStore((state) => state.loading);
  const error = useNotificationStore((state) => state.error);
  const markingAll = useNotificationStore((state) => state.markingAll);
  const markReadAction = useNotificationStore((state) => state.markRead);
  const markAllReadAction = useNotificationStore((state) => state.markAllRead);
  async function markRead(id) {
    await markReadAction(id).catch(() => undefined);
  }
  async function markAllRead() {
    await markAllReadAction().catch(() => undefined);
  }
  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <div className="page-heading"><div><p className="page-kicker">Inbox</p><h2 className="page-title">Notifications</h2><p className="page-description">Updates about your requests, trips, and fleet activity.</p></div><button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={markingAll || !data.some((notification) => !notification.isRead)}>{markingAll ? "Marking as read…" : "Mark all as read"}</button></div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {!data.length ? <div className="empty-panel">You have no notifications yet.</div> : null}
      {data.length ? <DataTable
        rows={data}
        columns={[
          { key: "title", label: "Title" },
          { key: "message", label: "Message" },
          { key: "type", label: "Type" },
          { key: "createdAt", label: "Received", render: (row) => formatIndiaDateTime(row.createdAt, "—") },
          { key: "isRead", label: "Read", render: (row) => (row.isRead ? "Yes" : "No") },
          { key: "action", label: "Action", render: (row) => row.isRead ? "-" : <button className="btn btn-ghost btn-xs" onClick={() => markRead(row._id)}>Mark read</button> }
        ]}
      /> : null}
    </section>
  );
}
