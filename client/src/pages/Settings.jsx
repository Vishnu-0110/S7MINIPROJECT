import { Plus } from "lucide-react";
import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { api } from "../lib/api.js";

export default function Settings() {
  const { data, loading, error, reload } = useApiResource("/settings");
  const [form, setForm] = useState({ key: "", value: "", description: "" });
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      let value = form.value;
      try {
        value = JSON.parse(form.value);
      } catch {
        // Plain-text values are valid settings too.
      }
      await api.post("/settings", { ...form, value });
      setForm({ key: "", value: "", description: "" });
      setMessage("Setting saved.");
      await reload();
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="responsive-panel-grid">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">System Settings</h2>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <DataTable
          rows={data}
          columns={[
            { key: "key", label: "Key" },
            { key: "value", label: "Value", render: (row) => JSON.stringify(row.value) },
            { key: "description", label: "Description" }
          ]}
        />
      </div>
      <aside className="app-surface p-5">
        <h3 className="font-semibold">Add setting</h3>
        <p className="mt-1 text-sm text-slate-500">Use valid JSON for structured values, or enter normal text.</p>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <input className="input input-bordered w-full" required placeholder="Setting key" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} />
          <textarea className="textarea textarea-bordered w-full" required placeholder='Value, e.g. {"enabled":true}' value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} />
          <input className="input input-bordered w-full" placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <button className="btn btn-primary w-full"><Plus className="h-4 w-4" /> Save setting</button>
        </form>
      </aside>
    </section>
  );
}
