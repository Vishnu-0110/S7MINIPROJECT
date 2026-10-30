import { AlertTriangle, KeyRound, Navigation, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";
import { googleMapsDirectionsUrl } from "../lib/navigation.js";
import { connectSocket } from "../lib/socket.js";

export default function TripDetails() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const [trip, setTrip] = useState(null);
  const [tripOtp, setTripOtp] = useState("");
  const [completionOtp, setCompletionOtp] = useState("");
  const [completionBusy, setCompletionBusy] = useState(false);
  const [replacementOtpBusy, setReplacementOtpBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ startKM: "", endKM: "", rating: "", feedback: "" });
  const [loading, setLoading] = useState(true);
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [incidentPanelOpen, setIncidentPanelOpen] = useState(false);
  const [incidentKind, setIncidentKind] = useState("ACCIDENT");
  const [incidentDetails, setIncidentDetails] = useState("");

  async function load() {
    try {
      const tripResult = await api.get(`/trips/${id}`);
      setTrip(tripResult.data);
      if (user.role === "DRIVER" && tripResult.data.status === "TRIP_COMPLETION_PENDING") {
        const result = await api.get(`/trips/${id}/completion-otp`);
        setCompletionOtp(result.data?.otp || "");
        setTripOtp("");
      } else if (user.role !== "DRIVER" && ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(tripResult.data.status)) {
        const result = await api.get(`/trips/${id}/otp`);
        setTripOtp(result.data?.otp || "");
        setCompletionOtp("");
      } else {
        setTripOtp("");
        setCompletionOtp("");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id, user.role]);

  useEffect(() => {
    const socket = connectSocket();
    const joinTrip = () => socket.emit("trip:join", id);
    const onReallocated = (event) => {
      if (String(event?.tripId) !== String(id)) return;
      setTripOtp("");
      setCompletionOtp("");
      setMessage("A replacement vehicle and driver have been assigned. The faculty member has a refreshed six-digit OTP for the new driver.");
      load();
    };
    const onCancelled = (event) => {
      if (String(event?.tripId) !== String(id)) return;
      setTripOtp("");
      setCompletionOtp("");
      setMessage(event?.reason || "This trip assignment was cancelled by Transport Administration.");
      load();
    };
    socket.on("connect", joinTrip);
    socket.on("trip:reallocated", onReallocated);
    socket.on("trip:cancelled", onCancelled);
    if (socket.connected) joinTrip();
    return () => {
      socket.emit("trip:leave", id);
      socket.off("connect", joinTrip);
      socket.off("trip:reallocated", onReallocated);
      socket.off("trip:cancelled", onCancelled);
    };
  }, [id, user.role]);

  async function verify(otp) {
    if (!scannedToken) {
      setMessage("Enter the six-digit OTP shown in the faculty portal.");
      return false;
    }
    try {
      await api.post(`/trips/${id}/otp/verify`, { otp });
      setMessage(trip.status === "SCHEDULED" ? "OTP verified. Enter the starting kilometre reading, then start the trip." : "Replacement OTP verified. The trip has resumed.");
      await load();
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    }
  }

  async function verifyReplacementOtp() {
    if (replacementOtpBusy) return;
    const otp = form.startOtp?.trim();
    if (!/^\d{6}$/.test(otp || "")) {
      setMessage("Enter the six-digit replacement OTP supplied by the faculty member.");
      return;
    }
    setReplacementOtpBusy(true);
    try {
      await api.post(`/trips/${id}/replacement-otp/verify`, { otp });
      setForm((current) => ({ ...current, startOtp: "" }));
      setMessage("Replacement OTP verified. This trip has resumed with the new vehicle and driver.");
      await load();
    } catch (error) {
      setMessage(error.message || "The replacement OTP could not be verified.");
    } finally {
      setReplacementOtpBusy(false);
    }
  }

  async function startTrip(otp) {
    const startKM = Number(form.startKM);
    if (!form.startKM || !Number.isFinite(startKM) || startKM < 0) {
      setMessage("Enter a valid starting kilometre reading before starting the trip.");
      return;
    }
    try {
      const location = await currentLocation();
      await api.post(`/trips/${id}/start`, {
        startKM,
        otp,
        location
      });
      window.location.assign(googleMapsDirectionsUrl(trip.destination, location));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitStartOtp() {
    const startKM = Number(form.startKM);
    if (!form.startKM || !Number.isFinite(startKM) || startKM < 0) {
      setMessage("Enter a valid starting kilometre reading before verifying the OTP.");
      return;
    }
    await startTrip(form.startOtp?.trim());
  }

  async function end() {
    try {
      await api.post(`/trips/${id}/end`, {
        endKM: Number(form.endKM),
        location: await currentLocation()
      });
      setMessage("Ending odometer saved. The driver now has a six-digit completion OTP for the faculty member.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmCompletion() {
    if (!form.completionOtp?.trim()) return setMessage("Enter the six-digit completion OTP shown by the driver.");
    if (!form.rating) return setMessage("Select a star rating before confirming the trip.");
    if (completionBusy) return;
    setCompletionBusy(true);
    try {
      await api.post(`/trips/${id}/complete`, { otp: form.completionOtp.trim(), rating: Number(form.rating), feedback: form.feedback || undefined });
      setMessage("Thank you. The trip is completed and your rating has been recorded.");
      setForm((current) => ({ ...current, completionOtp: "" }));
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCompletionBusy(false);
    }
  }

  async function submitDriverIncident() {
    const labels = { ACCIDENT: "Accident", TRAFFIC: "Traffic delay", BREAKDOWN: "Vehicle breakdown", OTHER: "Other emergency" };
    const details = incidentDetails.trim() || `${labels[incidentKind]} reported by the driver.`;
    setIncidentBusy(true);
    try {
      const location = await currentLocation();
      if (incidentKind === "BREAKDOWN") {
        await api.post("/breakdowns", { tripId: trip._id, message: details, severity: "HIGH", location });
        setMessage("Breakdown reported. Transport operations will arrange a replacement vehicle and driver.");
      } else {
        await api.post("/emergencies", {
          tripId: trip._id,
          vehicleId: trip.vehicleId?._id,
          driverId: trip.driverId?._id,
          message: `${labels[incidentKind]}: ${details}`,
          severity: incidentKind === "ACCIDENT" ? "CRITICAL" : "HIGH",
          location
        });
        setMessage(`${labels[incidentKind]} alert sent to transport operations.`);
      }
      setIncidentPanelOpen(false);
      setIncidentDetails("");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIncidentBusy(false);
    }
  }

  async function submitFacultyIncident() {
    const labels = { ACCIDENT: "Accident", TRAFFIC: "Traffic delay", BREAKDOWN: "Vehicle breakdown", OTHER: "Other emergency" };
    const message = incidentDetails.trim() || `${labels[incidentKind]} reported by the faculty member.`;
    setIncidentBusy(true);
    try {
      const location = await currentLocation();
      if (incidentKind === "BREAKDOWN") {
        await api.post("/breakdowns", { tripId: trip._id, message, severity: "HIGH", location });
        setMessage("Breakdown reported. Transport operations will use smart allocation to assign a replacement vehicle and driver.");
      } else {
        await api.post("/emergencies", { tripId: trip._id, message: `${labels[incidentKind]}: ${message}`, severity: incidentKind === "ACCIDENT" ? "CRITICAL" : "HIGH", location });
        setMessage(`${labels[incidentKind]} alert sent to transport operations.`);
      }
      setIncidentPanelOpen(false);
      setIncidentDetails("");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIncidentBusy(false);
    }
  }

  if (loading) return <LoadingState />;

  if (!trip) {
    return (
      <section className="content-card max-w-xl">
        <h2 className="text-lg font-semibold">Trip unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">{message || "This trip could not be loaded. Please return to Trips and try again."}</p>
      </section>
    );
  }

  return (
    <section className="responsive-panel-grid">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{trip.requestId?.requestId || trip.tripId}</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <p><span className="font-medium">Faculty:</span> {trip.facultyId?.name || "—"}</p>
          <p><span className="font-medium">Faculty email:</span> {trip.facultyId?.email || "—"}</p>
          <p><span className="font-medium">Department:</span> {trip.departmentId?.code || trip.departmentId?.name || "Not assigned"}</p>
          <p><span className="font-medium">Trip type:</span> {trip.tripType || "—"}</p>
          <p><span className="font-medium">Scheduled departure:</span> {formatIndiaDateTime(trip.scheduledStartTime)}</p>
          <p><span className="font-medium">Scheduled return:</span> {formatIndiaDateTime(trip.scheduledEndTime)}</p>
          <p><span className="font-medium">Vehicle:</span> {trip.vehicleId?.vehicleId || "—"}</p>
          <p><span className="font-medium">Registration:</span> {trip.vehicleId?.registrationNumber || "—"}</p>
          <p><span className="font-medium">Driver:</span> {trip.driverId?.userId?.name || "—"}</p>
          <p><span className="font-medium">Driver phone:</span> {trip.driverId?.phone || trip.driverId?.userId?.phone || "—"}</p>
          <p><span className="font-medium">Route:</span> {trip.source || "BIT"} → {trip.destination || "—"}</p>
          <p><span className="font-medium">Passengers:</span> {trip.passengerCount ?? "—"}</p>
          <p><span className="font-medium">Status:</span> {trip.status?.replaceAll("_", " ") || "—"}</p>
          <p><span className="font-medium">Distance:</span> {trip.distance ?? "—"} km</p>
          {trip.startTime ? <p><span className="font-medium">Actual start:</span> {formatIndiaDateTime(trip.startTime)}</p> : null}
          {trip.endTime ? <p><span className="font-medium">Actual end:</span> {formatIndiaDateTime(trip.endTime)}</p> : null}
          {trip.startKM !== undefined ? <p><span className="font-medium">Start odometer:</span> {trip.startKM} km</p> : null}
          {trip.endKM !== undefined ? <p><span className="font-medium">End odometer:</span> {trip.endKM} km</p> : null}
          {user.role === "TRANSPORT_ADMIN" ? <p>Faculty rating: {trip.facultyRating ? `${trip.facultyRating} / 5` : "Awaiting rating"}</p> : null}
        </div>
        {message ? <div className="alert mt-4">{message}</div> : null}
        {trip.replacementStatus === "VERIFICATION_PENDING" ? (
          <div className="alert mt-4 border border-teal-200 bg-teal-50 text-teal-950">
            <span className="font-semibold">Replacement assigned.</span> The vehicle and driver shown above are the current assignment. Give the refreshed OTP to the new driver so the trip can safely resume.
          </div>
        ) : trip.replacementStatus && trip.replacementStatus !== "NONE" ? (
          <div className="alert alert-warning mt-4">Replacement status: {trip.replacementStatus.replaceAll("_", " ")}</div>
        ) : null}
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Trip OTP verification</h3>
          </div>
          {tripOtp ? <>
            <p className="mt-3 text-sm text-slate-600">Give this one-time password to the assigned driver. It is valid only for this trip and is consumed after use.</p>
            <p className="mt-4 rounded-xl bg-primary/10 px-4 py-5 text-center font-mono text-4xl font-bold tracking-[0.35em] text-primary">{tripOtp}</p>
          </> : null}
          {completionOtp ? <><p className="mt-3 text-sm text-slate-600">Give this completion OTP to the requesting faculty member. The trip ends only after they enter it and provide a rating.</p><p className="mt-4 rounded-xl bg-primary/10 px-4 py-5 text-center font-mono text-4xl font-bold tracking-[0.35em] text-primary">{completionOtp}</p></> : null}
          {user.role === "DRIVER" && ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status) ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-primary/5 p-3 text-sm font-medium text-primary">Enter the six-digit OTP shown in the faculty portal. For a replacement trip, enter the refreshed OTP.</div>
              <input className="input input-bordered w-full text-center font-mono text-2xl tracking-[0.3em]" inputMode="numeric" maxLength="6" value={form.startOtp || ""} onChange={(event) => setForm((current) => ({ ...current, startOtp: event.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="000000" aria-label="Trip OTP" />
              {trip.status !== "SCHEDULED" ? <button className="btn btn-primary w-full" onClick={verifyReplacementOtp} disabled={replacementOtpBusy}><KeyRound className="h-4 w-4" /> {replacementOtpBusy ? "Verifying replacement OTP…" : "Verify replacement OTP"}</button> : null}
            </div>
          ) : null}
        </div>
        {user.role === "DRIVER" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              {trip.status === "SCHEDULED" ? <>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Step 1 of 2: Starting kilometre</p>
                  <p className="mt-1 text-xs text-slate-500">Enter the vehicle odometer and the six-digit OTP shown by faculty.</p>
                  <input className="input input-bordered mt-3 w-full" min="0" type="number" value={form.startKM} onChange={(event) => setForm((current) => ({ ...current, startKM: event.target.value }))} placeholder="Starting odometer (KM)" />
                  <button className="btn btn-primary mt-3 w-full" onClick={submitStartOtp}><KeyRound className="h-4 w-4" /> Verify OTP and start trip</button>
                </div>
              </> : null}
              {["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status) ? <a className="btn btn-secondary w-full" href={googleMapsDirectionsUrl(trip.destination)}><Navigation className="h-4 w-4" /> Navigate to destination</a> : null}
              {["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(trip.status) ? (
                incidentPanelOpen ? (
                  <div className="rounded-xl border border-error/30 bg-error/5 p-4">
                    <p className="font-semibold text-error">Report an incident</p>
                    <p className="mt-1 text-sm text-slate-600">Choose the situation so transport operations receive the right response.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[['ACCIDENT', 'Accident'], ['TRAFFIC', 'Traffic'], ['BREAKDOWN', 'Breakdown'], ['OTHER', 'Other']].map(([value, label]) => (
                        <button key={value} type="button" className={`btn btn-sm ${incidentKind === value ? "btn-error" : "btn-outline"}`} onClick={() => setIncidentKind(value)} disabled={incidentBusy}>{label}</button>
                      ))}
                    </div>
                    <textarea className="textarea textarea-bordered mt-3 w-full" value={incidentDetails} onChange={(event) => setIncidentDetails(event.target.value)} placeholder="Add details for transport operations (optional)" disabled={incidentBusy} />
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-ghost flex-1" onClick={() => setIncidentPanelOpen(false)} disabled={incidentBusy}>Cancel</button>
                      <button className="btn btn-error flex-1" onClick={submitDriverIncident} disabled={incidentBusy}>{incidentBusy ? "Sending…" : incidentKind === "BREAKDOWN" ? "Report breakdown" : "Send alert"}</button>
                    </div>
                  </div>
                ) : <button className="btn btn-error btn-outline w-full" onClick={() => setIncidentPanelOpen(true)} disabled={incidentBusy}><AlertTriangle className="h-4 w-4" /> Emergency alert</button>
              ) : null}
              {["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status) ? <>
                <input className="input input-bordered w-full" min={trip.startKM || 0} type="number" value={form.endKM} onChange={(event) => setForm((current) => ({ ...current, endKM: event.target.value }))} placeholder="Ending odometer (KM)" />
                <button className="btn btn-error w-full" onClick={end} disabled={!form.endKM}>Continue to faculty confirmation</button>
              </> : null}
              {trip.status === "TRIP_COMPLETION_PENDING" ? <p className="text-sm text-slate-500">The ending odometer is recorded. Show the completion OTP to the faculty member so they can provide a rating.</p> : null}
              {!["SCHEDULED", "TRIP_STARTED", "TRIP_COMPLETION_PENDING"].includes(trip.status) ? <p className="text-sm text-slate-500">This trip is {trip.status.replaceAll("_", " ").toLowerCase()}.</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <Navigation className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-600">Live GPS updates appear in the tracking screen when the driver starts sending location records.</p>
            {user.role === "FACULTY_STAFF" && trip.status === "TRIP_COMPLETION_PENDING" ? <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-primary/5 p-3 text-sm text-primary">Enter the six-digit completion OTP shown in the driver portal, then submit your rating to end this trip.</div>
              <input className="input input-bordered w-full text-center font-mono text-2xl tracking-[0.3em]" inputMode="numeric" maxLength="6" value={form.completionOtp || ""} onChange={(event) => setForm((current) => ({ ...current, completionOtp: event.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="000000" aria-label="Completion OTP" />
              <label className="form-control"><span className="label-text">Star rating</span><select className="select select-bordered" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}><option value="">Select rating</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}</select></label>
              <label className="form-control"><span className="label-text">Feedback (optional)</span><textarea className="textarea textarea-bordered" value={form.feedback} onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.value }))} placeholder="Share feedback about this trip" /></label>
              <button className="btn btn-success w-full" onClick={confirmCompletion} disabled={completionBusy}><Star className="h-4 w-4" /> {completionBusy ? "Completing trip…" : "Confirm trip and rating"}</button>
            </div> : null}
            {user.role === "FACULTY_STAFF" && ["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(trip.status) ? <div className="mt-4 space-y-3">{incidentPanelOpen ? <div className="rounded-xl border border-error/30 bg-error/5 p-3"><p className="font-semibold text-error">Report an incident</p><p className="mt-1 text-xs text-slate-600">Choose the situation so transport operations receive the right response.</p><div className="mt-3 grid grid-cols-2 gap-2">{[["ACCIDENT", "Accident"], ["TRAFFIC", "Traffic"], ["BREAKDOWN", "Breakdown"], ["OTHER", "Other"]].map(([value, label]) => <button key={value} type="button" className={`btn btn-sm ${incidentKind === value ? "btn-error" : "btn-outline"}`} onClick={() => setIncidentKind(value)}>{label}</button>)}</div><textarea className="textarea textarea-bordered mt-3 w-full" value={incidentDetails} onChange={(event) => setIncidentDetails(event.target.value)} placeholder="Add details for transport operations (optional)" /><div className="mt-3 flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => setIncidentPanelOpen(false)} disabled={incidentBusy}>Cancel</button><button className="btn btn-error flex-1" onClick={submitFacultyIncident} disabled={incidentBusy}>{incidentBusy ? "Sending…" : incidentKind === "BREAKDOWN" ? "Report breakdown" : "Send alert"}</button></div></div> : <button className="btn btn-error w-full" onClick={() => setIncidentPanelOpen(true)} disabled={incidentBusy}><AlertTriangle className="h-4 w-4" /> Emergency alert</button>}</div> : null}
          </div>
        )}
      </aside>
    </section>
  );
}

function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
      () => resolve(undefined)
    );
  });
}
