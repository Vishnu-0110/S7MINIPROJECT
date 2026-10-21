import { Award, Bus, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { api } from "../lib/api.js";

export default function SmartAllocation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await api.post(`/requests/${id}/allocations`);
        setAllocations(result.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function assign(item) {
    setBusy(item._id);
    try {
      await api.post(`/requests/${id}/assign`, {
        allocationId: item._id,
        vehicleId: item.vehicleId._id,
        driverId: item.driverId._id
      });
      navigate("/trips");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Smart Allocation</h2>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {!allocations.length ? <EmptyState title="No eligible allocation" note="No available vehicle and driver combination met the trip requirements." /> : null}
        {allocations.map((item, index) => (
          <article key={item._id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {index === 0 ? <Award className="h-5 w-5 text-accent" /> : <Bus className="h-5 w-5 text-primary" />}
                <h3 className="font-semibold">{item.vehicleId?.vehicleId}</h3>
              </div>
              <span className="badge badge-primary">{item.score}%</span>
            </div>
            <div className="space-y-2 text-sm">
              <p>Capacity: {item.vehicleId?.capacity}</p>
              <p>Driver: {item.driverId?.userId?.name || "Available"}</p>
              <p>Maintenance: {item.maintenanceScore >= 80 ? "GOOD" : "CHECK"}</p>
              <p>Estimated Cost: Rs. {item.estimatedCost}</p>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {item.reasons?.map((reason) => (
                <li className="flex items-center gap-2" key={reason}>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {reason}
                </li>
              ))}
            </ul>
            <button className="btn btn-primary mt-5 w-full" disabled={busy === item._id} onClick={() => assign(item)}>
              Assign vehicle
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
