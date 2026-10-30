import { ArrowLeft, LocateFixed, MapPin, Minus, Navigation, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
      const currentTrip = (await api.get(`/trips/${id}`)).data;
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
  }, [id]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  useEffect(() => {
    const timer = window.setInterval(loadRoute, 30000);
    return () => window.clearInterval(timer);
  }, [loadRoute]);

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
          <RouteMap route={route} destinationName={trip.destination} />
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

function RouteMap({ route, destinationName }) {
  const mapRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 560 });
  const [view, setView] = useState(() => fitView(route.geometry.coordinates, 1000, 560));
  const coordinates = route.geometry.coordinates;

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const resize = () => setViewport({ width: mapRef.current.clientWidth || 1000, height: mapRef.current.clientHeight || 560 });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setView(fitView(coordinates, viewport.width, viewport.height)); }, [route, viewport.width, viewport.height]);

  const origin = project(view.center[0], view.center[1], view.zoom);
  const topLeft = { x: origin.x - viewport.width / 2, y: origin.y - viewport.height / 2 };
  const routePixels = coordinates.map(([longitude, latitude]) => {
    const point = project(longitude, latitude, view.zoom);
    return `${point.x - topLeft.x},${point.y - topLeft.y}`;
  }).join(" ");
  const start = routePixels.split(" ")[0]?.split(",") || [];
  const end = routePixels.split(" ").at(-1)?.split(",") || [];
  const tiles = [];
  const firstX = Math.floor(topLeft.x / 256) - 1;
  const firstY = Math.floor(topLeft.y / 256) - 1;
  const lastX = Math.ceil((topLeft.x + viewport.width) / 256) + 1;
  const lastY = Math.ceil((topLeft.y + viewport.height) / 256) + 1;
  for (let x = firstX; x <= lastX; x += 1) for (let y = firstY; y <= lastY; y += 1) tiles.push({ x, y, key: `${x}-${y}` });
  const maxTile = 2 ** view.zoom;
  const clampTile = (value) => ((value % maxTile) + maxTile) % maxTile;

  return (
    <div className="relative h-[28rem] overflow-hidden rounded-2xl border border-slate-300 bg-slate-200 shadow-sm" ref={mapRef}>
      {tiles.map((tile) => <img key={tile.key} className="absolute h-64 w-64 max-w-none" style={{ left: tile.x * 256 - topLeft.x, top: tile.y * 256 - topLeft.y }} src={`https://tile.openstreetmap.org/${view.zoom}/${clampTile(tile.x)}/${clampTile(tile.y)}.png`} alt="" draggable="false" />)}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Driving route map">
        <polyline points={routePixels} fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={routePixels} fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        {start.length === 2 ? <circle cx={start[0]} cy={start[1]} r="12" fill="#0f766e" stroke="#fff" strokeWidth="5" /> : null}
        {end.length === 2 ? <circle cx={end[0]} cy={end[1]} r="12" fill="#dc2626" stroke="#fff" strokeWidth="5" /> : null}
      </svg>
      <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow"><LocateFixed className="mr-1 inline h-4 w-4 text-teal-700" /> Your location</div>
      <div className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow"><MapPin className="mr-1 inline h-4 w-4 text-red-600" /> {destinationName}</div>
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg bg-white shadow">
        <button className="btn btn-square btn-sm rounded-none" onClick={() => setView((current) => ({ ...current, zoom: Math.min(18, current.zoom + 1) }))} aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button className="btn btn-square btn-sm rounded-none" onClick={() => setView((current) => ({ ...current, zoom: Math.max(4, current.zoom - 1) }))} aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <button className="btn btn-square btn-sm rounded-none border-t" onClick={() => setView(fitView(coordinates, viewport.width, viewport.height))} aria-label="Fit route"><LocateFixed className="h-4 w-4" /></button>
      </div>
      <p className="absolute bottom-1 left-2 text-[10px] text-slate-700 drop-shadow">© OpenStreetMap contributors</p>
    </div>
  );
}

function project(longitude, latitude, zoom) {
  const scale = 256 * (2 ** zoom);
  const safeLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const radians = safeLatitude * Math.PI / 180;
  return { x: ((longitude + 180) / 360) * scale, y: (1 - Math.log(Math.tan(radians) + (1 / Math.cos(radians))) / Math.PI) / 2 * scale };
}

function fitView(coordinates, width, height) {
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const center = [(Math.min(...longitudes) + Math.max(...longitudes)) / 2, (Math.min(...latitudes) + Math.max(...latitudes)) / 2];
  let zoom = 18;
  while (zoom > 4) {
    const projected = coordinates.map(([longitude, latitude]) => project(longitude, latitude, zoom));
    if (Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x)) < width * 0.78 && Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y)) < height * 0.78) break;
    zoom -= 1;
  }
  return { center, zoom };
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
