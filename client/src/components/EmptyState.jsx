import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No records found", note = "New data will appear here when it is available." }) {
  return (
    <div className="empty-panel">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100"><Inbox className="h-6 w-6 text-slate-400" aria-hidden="true" /></div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}
