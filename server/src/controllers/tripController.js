import { Driver, Trip, VehicleRequest } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { cancelScheduledTrip, completeTrip, createTripFromAssignment, generateCompletionQr, generateTripQr, requestTripCompletion, saveGps, startTrip, verifyQr } from "../services/tripService.js";
import { indiaDayRange, isTodayInIndia } from "../utils/indiaTime.js";

export async function assignTrip(req, res) {
  const trip = await createTripFromAssignment({
    requestId: req.params.requestId,
    vehicleId: req.body.vehicleId,
    driverId: req.body.driverId,
    allocationId: req.body.allocationId,
    actor: req.user,
    override: req.body.override,
    overrideReason: req.body.overrideReason
  });
  return ok(res, "Trip scheduled", trip, 201);
}

export async function listTrips(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.user.role === "FACULTY_STAFF") query.facultyId = req.user._id;
  if (req.user.role === "DEPARTMENT_COORDINATOR") query.departmentId = req.user.departmentId;
  if (req.user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return ok(res, "Trips", [], 200, { pagination: paginationPayload(page, limit, 0) });
    query.driverId = driver._id;
  }
  if (req.query.status) query.status = req.query.status;
  const [trips, total] = await Promise.all([
    Trip.find(query)
      .populate("requestId", "requestId")
      .populate("facultyId", "name email")
      .populate("departmentId", "name code")
      .populate("vehicleId")
      .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Trip.countDocuments(query)
  ]);
  const data = trips.map((trip) => {
    const item = trip.toObject();
    if (req.user.role !== "TRANSPORT_ADMIN") {
      delete item.facultyRating;
      delete item.facultyFeedback;
    }
    return item;
  });
  return ok(res, "Trips", data, 200, { pagination: paginationPayload(page, limit, total) });
}

async function assertTripAccess(trip, user) {
  if (!trip) throw new ApiError("Trip not found", 404);
  if (user.role === "TRANSPORT_ADMIN") return;
  if (user.role === "FACULTY_STAFF" && String(trip.facultyId?._id || trip.facultyId) === String(user._id)) return;
  if (
    user.role === "DEPARTMENT_COORDINATOR" &&
    String(trip.departmentId?._id || trip.departmentId) === String(user.departmentId)
  ) {
    return;
  }
  if (user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: user._id });
    if (driver && String(trip.driverId?._id || trip.driverId) === String(driver._id)) {
      return;
    }
  }
  throw new ApiError("Forbidden", 403);
}

export async function getTrip(req, res) {
  const trip = await Trip.findById(req.params.id)
    .populate("requestId", "requestId")
    .populate("facultyId", "name email")
    .populate("departmentId", "name code")
    .populate("vehicleId")
    .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } });
  await assertTripAccess(trip, req.user);
  const data = trip.toObject();
  if (req.user.role !== "TRANSPORT_ADMIN") {
    delete data.facultyRating;
    delete data.facultyFeedback;
  }
  return ok(res, "Trip details", data);
}

export async function tripQr(req, res) {
  const trip = await Trip.findById(req.params.id).select("facultyId departmentId driverId scheduledStartTime status");
  await assertTripAccess(trip, req.user);
  if (req.user.role === "DRIVER") {
    throw new ApiError("The faculty member must display the trip QR code for the driver to scan.", 403);
  }
  const isReplacementVerification = ["TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status);
  if (!isReplacementVerification && !isTodayInIndia(trip.scheduledStartTime)) {
    throw new ApiError("The trip QR code is available on the scheduled trip date.", 403);
  }
  const payload = { qr: await generateTripQr(req.params.id) };
  return ok(res, "QR generated", payload);
}

export async function verifyTripQr(req, res) {
  const driver = await Driver.findOne({ userId: req.user._id });
  return ok(res, "QR verified", await verifyQr({ tripId: req.params.id, qrToken: req.body.qrToken, driver }));
}

export async function startTripAction(req, res) {
  return ok(res, "Trip started", await startTrip({ tripId: req.params.id, actor: req.user, ...req.body }));
}

export async function endTripAction(req, res) {
  return ok(res, "Ending odometer saved. Faculty confirmation is required.", await requestTripCompletion({ tripId: req.params.id, actor: req.user, ...req.body }));
}

export async function completionQr(req, res) {
  return ok(res, "Completion QR generated", { qr: await generateCompletionQr(req.params.id, req.user) });
}

export async function completeTripAction(req, res) {
  return ok(res, "Trip completed", await completeTrip({ tripId: req.params.id, actor: req.user, ...req.body }));
}

export async function cancelTripAction(req, res) {
  return ok(res, "Trip assignment cancelled. The vehicle and driver are available again.", await cancelScheduledTrip({ tripId: req.params.id, actor: req.user, reason: req.body?.reason?.trim() }));
}

export async function gpsAction(req, res) {
  return ok(res, "GPS logged", await saveGps({ tripId: req.params.id, actor: req.user, payload: req.body }), 201);
}

export async function activeTripSummary(_req, res) {
  const requests = await VehicleRequest.countDocuments({ status: "PENDING_APPROVAL" });
  const activeTrips = await Trip.countDocuments({ status: "TRIP_STARTED" });
  const upcomingTrips = await Trip.countDocuments({ status: "SCHEDULED" });
  return ok(res, "Summary", { requests, activeTrips, upcomingTrips });
}
