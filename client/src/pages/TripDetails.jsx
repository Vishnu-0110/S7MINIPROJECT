import { Html5Qrcode, Html5QrcodeScanner } from "html5-qrcode";
import { AlertTriangle, Camera, ImageUp, Navigation, QrCode, Star, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { formatIndiaDateTime } from "../lib/dateTime.js";

export default function TripDetails() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const [trip, setTrip] = useState(null);
  const [qr, setQr] = useState("");
  const [completionQr, setCompletionQr] = useState("");
  const [completionToken, setCompletionToken] = useState("");
  const [completionScanOpen, setCompletionScanOpen] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ startKM: "", endKM: "", rating: "", feedback: "" });
  const [loading, setLoading] = useState(true);
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [startStep, setStartStep] = useState("kilometre");
  const scannerRef = useRef(null);

  async function load() {
    try {
      const tripResult = await api.get(`/trips/${id}`);
      setTrip(tripResult.data);
      if (user.role === "DRIVER" && tripResult.data.status === "TRIP_COMPLETION_PENDING") {
        const result = await api.get(`/trips/${id}/completion-qr`);
        setCompletionQr(result.data?.qr || "");
        setQr("");
      } else if (user.role !== "DRIVER" && ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(tripResult.data.status)) {
        const result = await api.get(`/trips/${id}/qr`);
        setQr(result.data?.qr || "");
        setCompletionQr("");
      } else {
        setQr("");
        setCompletionQr("");
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
    if (user.role !== "DRIVER" || startStep !== "scan" || !["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip?.status)) return undefined;
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 200, height: 200 } }, false);
    scanner.render(
      (decoded) => {
        handleScannedToken(decoded);
        scanner.clear().catch(() => undefined);
      },
      () => undefined
    );
    scannerRef.current = scanner;
    return () => {
      scannerRef.current?.clear().catch((error) => {
        console.warn("QR scanner cleanup failed", error);
      });
    };
  }, [startStep, user.role, trip?.status]);

  useEffect(() => {
    if (user.role !== "FACULTY_STAFF" || !completionScanOpen || trip?.status !== "TRIP_COMPLETION_PENDING") return undefined;
    const scanner = new Html5QrcodeScanner("completion-qr-reader", { fps: 10, qrbox: { width: 200, height: 200 } }, false);
    scanner.render((decoded) => {
      setCompletionToken(decoded);
      setMessage("Completion QR scanned. Select a rating, then confirm completion.");
      setCompletionScanOpen(false);
      scanner.clear().catch(() => undefined);
    }, () => undefined);
    return () => scanner.clear().catch(() => undefined);
  }, [completionScanOpen, trip?.status, user.role]);

  async function scanQrImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadBusy(true);
    try {
      await scannerRef.current?.clear().catch(() => undefined);
      const imageScanner = new Html5Qrcode("qr-file-reader");
      const decoded = await imageScanner.scanFile(file, true);
      await handleScannedToken(decoded);
      await imageScanner.clear().catch(() => undefined);
    } catch {
      setMessage("The selected image does not contain a readable trip QR code. Try a clearer image or use the camera.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function verify(scannedToken) {
    if (!scannedToken) {
      setMessage("Scan the trip QR code before starting.");
      return false;
    }
    try {
      await api.post(`/trips/${id}/qr/verify`, { qrToken: scannedToken });
      setToken(scannedToken);
      setMessage(trip.status === "SCHEDULED" ? "QR verified. Enter the starting kilometre reading, then start the trip." : "Replacement verified. The trip has resumed.");
      await load();
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    }
  }

  async function startTrip(scannedToken) {
    const startKM = Number(form.startKM);
    if (!form.startKM || !Number.isFinite(startKM) || startKM < 0) {
      setMessage("Enter a valid starting kilometre reading before starting the trip.");
      return;
    }
    try {
      await api.post(`/trips/${id}/start`, {
        startKM,
        qrToken: scannedToken,
        location: await currentLocation()
      });
      setMessage("Trip started. You can now share GPS updates.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function continueToQrScan() {
    const startKM = Number(form.startKM);
    if (!form.startKM || !Number.isFinite(startKM) || startKM < 0) {
      setMessage("Enter a valid starting kilometre reading before continuing to QR scanning.");
      return;
    }
    setMessage("Step 2 of 2: Scan the faculty QR code to verify and start the trip.");
    setStartStep("scan");
  }

  async function handleScannedToken(scannedToken) {
    const verified = await verify(scannedToken);
    if (verified && trip.status === "SCHEDULED") await startTrip(scannedToken);
  }

  async function end() {
    try {
      await api.post(`/trips/${id}/end`, {
        endKM: Number(form.endKM),
        location: await currentLocation()
      });
      setMessage("Ending odometer saved. Show the generated completion QR code to the faculty member for scanning and rating.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmCompletion() {
    if (!completionToken) return setMessage("Scan the driver’s completion QR code before confirming the trip.");
    if (!form.rating) return setMessage("Select a star rating before confirming the trip.");
    try {
      await api.post(`/trips/${id}/complete`, { qrToken: completionToken, rating: Number(form.rating), feedback: form.feedback || undefined });
      setMessage("Thank you. The trip is completed and your rating has been recorded.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function reportIncident(type) {
    const prompt = type === "breakdown" ? "Describe the breakdown" : "Describe the emergency";
    const incidentMessage = window.prompt(prompt);
    if (!incidentMessage?.trim()) return;
    setIncidentBusy(true);
    try {
      const location = await currentLocation();
      if (type === "breakdown") {
        await api.post("/breakdowns", { tripId: trip._id, message: incidentMessage, severity: "HIGH", location });
        setMessage("Breakdown reported. The system is searching for a safe replacement vehicle.");
      } else {
        await api.post("/emergencies", { tripId: trip._id, message: incidentMessage, severity: "HIGH", location });
        setMessage("Emergency alert sent successfully. The Transport Administrator and Department Coordinator have been notified.");
      }
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
        {trip.replacementStatus && trip.replacementStatus !== "NONE" ? <div className="alert alert-warning mt-4">Replacement status: {trip.replacementStatus.replaceAll("_", " ")}</div> : null}
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">QR Trip Verification</h3>
          </div>
          {qr ? <img className="mx-auto mt-4 h-56 w-56" src={qr} alt="Trip QR code" /> : null}
          {completionQr ? <>
            <p className="mt-3 text-sm text-slate-600">Show this completion QR code to the requesting faculty member. The trip ends only after they scan it and give a rating.</p>
            <img className="mx-auto mt-4 h-56 w-56" src={completionQr} alt="Trip completion QR code" />
          </> : null}
          {user.role === "DRIVER" && ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status) ? (
            <div className="mt-4 space-y-3">
              {trip.status === "SCHEDULED" && startStep === "kilometre" ? <p className="text-sm text-slate-600">Complete Step 1 by entering the starting kilometre reading. QR scanning becomes available in Step 2.</p> : <>
                <div className="rounded-xl bg-primary/5 p-3 text-sm font-medium text-primary">Step 2 of 2: Scan the faculty QR code. A successful scan verifies the trip and starts it automatically.</div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary"><Camera className="h-4 w-4" /> Camera scan</div>
                <div id="qr-reader" aria-label="Camera QR code scanner" />
                <div id="qr-file-reader" className="hidden" aria-hidden="true" />
                <label className={`btn btn-outline w-full ${uploadBusy ? "btn-disabled" : ""}`}>
                  <ImageUp className="h-4 w-4" />
                  {uploadBusy ? "Reading QR image..." : "Upload QR image"}
                  <input className="hidden" type="file" accept="image/*" capture="environment" onChange={scanQrImage} disabled={uploadBusy} />
                </label>
                {trip.status === "SCHEDULED" ? <button className="btn btn-ghost btn-sm w-full" onClick={() => setStartStep("kilometre")}>Back to kilometre entry</button> : null}
              </>}
            </div>
          ) : null}
        </div>
        {user.role === "DRIVER" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              {trip.status === "SCHEDULED" ? <>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Step 1 of 2: Starting kilometre</p>
                  <p className="mt-1 text-xs text-slate-500">Enter the vehicle odometer reading before QR scanning.</p>
                  <input className="input input-bordered mt-3 w-full" min="0" type="number" value={form.startKM} onChange={(event) => setForm((current) => ({ ...current, startKM: event.target.value }))} placeholder="Starting odometer (KM)" disabled={startStep === "scan"} />
                  {startStep === "kilometre" ? <button className="btn btn-primary mt-3 w-full" onClick={continueToQrScan}>Continue to QR scan</button> : <p className="mt-3 text-xs font-medium text-success">Kilometre reading saved. Complete QR scanning to start the trip.</p>}
                </div>
              </> : null}
              {["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status) ? <button className="btn btn-error w-full" onClick={() => reportIncident("breakdown")} disabled={incidentBusy}><Wrench className="h-4 w-4" /> Report breakdown</button> : null}
              {["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(trip.status) ? <button className="btn btn-error btn-outline w-full" onClick={() => reportIncident("emergency")} disabled={incidentBusy}><AlertTriangle className="h-4 w-4" /> Emergency alert</button> : null}
              {trip.status === "TRIP_STARTED" ? <>
                <input className="input input-bordered w-full" min={trip.startKM || 0} type="number" value={form.endKM} onChange={(event) => setForm((current) => ({ ...current, endKM: event.target.value }))} placeholder="Ending odometer (KM)" />
                <button className="btn btn-error w-full" onClick={end} disabled={!form.endKM}>Continue to faculty confirmation</button>
              </> : null}
              {trip.status === "TRIP_COMPLETION_PENDING" ? <p className="text-sm text-slate-500">The ending odometer is recorded. Keep the completion QR code open until the faculty member scans it and provides a rating.</p> : null}
              {!["SCHEDULED", "TRIP_STARTED", "TRIP_COMPLETION_PENDING"].includes(trip.status) ? <p className="text-sm text-slate-500">This trip is {trip.status.replaceAll("_", " ").toLowerCase()}.</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <Navigation className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-600">Live GPS updates appear in the tracking screen when the driver starts sending location records.</p>
            {user.role === "FACULTY_STAFF" && trip.status === "TRIP_COMPLETION_PENDING" ? <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-primary/5 p-3 text-sm text-primary">Scan the driver’s completion QR code and submit your rating to end this trip.</div>
              {completionScanOpen ? <div id="completion-qr-reader" aria-label="Completion QR code scanner" /> : <button className="btn btn-primary w-full" onClick={() => setCompletionScanOpen(true)}><Camera className="h-4 w-4" /> Scan completion QR</button>}
              {completionToken ? <p className="text-sm font-medium text-success">Completion QR scanned successfully.</p> : null}
              <label className="form-control"><span className="label-text">Star rating</span><select className="select select-bordered" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}><option value="">Select rating</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}</select></label>
              <label className="form-control"><span className="label-text">Feedback (optional)</span><textarea className="textarea textarea-bordered" value={form.feedback} onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.value }))} placeholder="Share feedback about this trip" /></label>
              <button className="btn btn-success w-full" onClick={confirmCompletion}><Star className="h-4 w-4" /> Confirm trip and rating</button>
            </div> : null}
            {user.role === "FACULTY_STAFF" && ["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(trip.status) ? <button className="btn btn-error mt-4 w-full" onClick={() => reportIncident("emergency")} disabled={incidentBusy}><AlertTriangle className="h-4 w-4" /> Emergency alert</button> : null}
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
