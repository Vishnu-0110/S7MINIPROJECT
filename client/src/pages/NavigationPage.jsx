import { ArrowLeft, LocateFixed, MapPin, Navigation, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export default function NavigationPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRoute = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const currentTrip = trip || (await api.get(`/trips/${id}`)).data;
      setTrip(currentTrip);
      const current = await currentLocation();
      const start = current || currentTrip.startLocation;
      if (!start?.latitude || !start?.longitude) throw new Error("Allow location access to calculate the route from the driver’s current position.");
      const destination = await geocode(currentTrip.destination);
      const response = await fetch(`${OSRM_URL}/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true&alternatives=false`);
      if (!response.ok) throw new Error("The route service is temporarily unavailable. Try refreshing in a moment.");
      const data = await response.json();
      if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("No driving route was found for this destination.");
      setRoute({ ...data.routes[0], destination });
    } catch (loadError) {
      setError(loadError.message || "Unable to calculate the route.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, trip]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  const routePoints = useMemo(() => {
    const coordinates = route?.geometry?.coordinates || [];
    if (!coordinates.length) return [];
    const longitudes = coordinates.map(([longitude]) => longitude);
    const latitudes = coordinates.map(([, latitude]) => latitude);
    const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
    const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
    const lonSpan = Math.max(maxLon - minLon, 0.0001); const latSpan = Math.max(maxLat - minLat, 0.0001);
    return coordinates.map(([longitude, latitude]) => ({ x: 55 + ((longitude - minLon) / lonSpan) * 890, y: 545 - ((latitude - minLat) / latSpan) * 490 }));
  }, [route]);

  if (loading) return <LoadingState />;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link className="btn btn-ghost btn-sm mb-2" to={`/trips/${id}`}><ArrowLeft className="h-4 w-4" /> Back to trip</Link>
          <p className="page-kicker">In-app navigation</p>
          <h2 className="page-title">Navigate to {trip?.destination}</h2>
          <p className="page-description">Live driving route calculated from your current position.</p>
        </div>
        <button className="btn btn-outline" onClick={loadRoute} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh route</button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {route ? <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat rounded-xl border border-slate-200 bg-white shadow-sm"><div className="stat-title">Distance</div><div className="stat-value text-2xl">{formatDistance(route.distance)}</div></div>
          <div className="stat rounded-xl border border-slate-200 bg-white shadow-sm"><div className="stat-title">Estimated time</div><div className="stat-value text-2xl">{formatDuration(route.duration)}</div></div>
          <div className="stat rounded-xl border border-slate-200 bg-white shadow-sm"><div className="stat-title">Destination</div><div className="stat-value truncate text-lg">{trip.destination}</div></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[#e8f0e8] shadow-sm">
            <div className="relative aspect-[16/9] min-h-[22rem]">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(30deg, #cbdcca 12%, transparent 12.5%, transparent 87%, #cbdcca 87.5%), linear-gradient(150deg, #cbdcca 12%, transparent 12.5%, transparent 87%, #cbdcca 87.5%)", backgroundSize: "80px 140px" }} />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-label="Driving route map">
                <polyline points={routePoints.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={routePoints.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
                {routePoints.length ? <><circle cx={routePoints[0].x} cy={routePoints[0].y} r="18" fill="#0f766e" stroke="#fff" strokeWidth="7" /><circle cx={routePoints[routePoints.length - 1].x} cy={routePoints[routePoints.length - 1].y} r="18" fill="#dc2626" stroke="#fff" strokeWidth="7" /></> : null}
              </svg>
              <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow"><LocateFixed className="mr-1 inline h-4 w-4 text-teal-700" /> Your location</div>
              <div className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow"><MapPin className="mr-1 inline h-4 w-4 text-red-600" /> {trip.destination}</div>
            </div>
          </div>
          <div className="app-surface p-4">
            <div className="flex items-center gap-2"><Navigation className="h-5 w-5 text-primary" /><h3 className="font-semibold">Driving directions</h3></div>
            <p className="mt-1 text-xs text-slate-500">Follow the route shown below. Refresh to recalculate from your latest position.</p>
            <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {(route.legs?.[0]?.steps || []).map((step, index) => <div className="flex gap-3 border-b border-slate-100 pb-3 text-sm" key={`${index}-${step.name}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span>{instruction(step)} <span className="block text-xs text-slate-500">{formatDistance(step.distance)}</span></span></div>)}
            </div>
          </div>
        </div>
      </> : <div className="app-surface p-6 text-sm text-slate-600">No route is available yet. Allow GPS access and refresh the route.</div>}
    </section>
  );
}

async function geocode(destination) {
  const response = await fetch(`${NOMINATIM_URL}?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(destination)}`, { headers: { Accept: "application/json" } });
  const results = await response.json();
  if (!response.ok || !results[0]) throw new Error(`Could not locate “${destination}”. Check the trip destination.`);
  return { latitude: Number(results[0].lat), longitude: Number(results[0].lon) };
}

function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve(undefined), { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  });
}

function formatDistance(metres) { return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`; }
function formatDuration(seconds) { const minutes = Math.max(1, Math.round(seconds / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`; }
function instruction(step) {
  const type = step.maneuver?.type; const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : "";
  if (type === "arrive") return "Arrive at your destination";
  if (type === "depart") return `Start${modifier} on ${step.name || "the route"}`;
  if (type === "roundabout" || type === "rotary") return `Enter the roundabout${step.maneuver.exit ? ` and take exit ${step.maneuver.exit}` : ""}${step.name ? ` onto ${step.name}` : ""}`;
  const action = type === "merge" ? "Merge" : type === "fork" ? "Keep" : type === "new name" ? "Continue" : "Turn";
  return `${action}${modifier}${step.name ? ` onto ${step.name}` : ""}`;
}
