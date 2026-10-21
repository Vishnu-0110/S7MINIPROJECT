import { Driver, Trip, VehicleRequest } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { createTripFromAssignment, endTrip, generateTripQr, saveGps, startTrip, verifyQr } from "../services/tripService.js";

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
    query.driverId = driver?._id;
  }
  if (req.query.status) query.status = req.query.status;
  const [data, total] = await Promise.all([
    Trip.find(query)
      .populate("facultyId", "name email")
      .populate("departmentId", "name code")
      .populate("vehicleId")
      .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } })
      .sort({ scheduledStartTime: -1 })
      .skip(skip)
      .limit(limit),
    Trip.countDocuments(query)
  ]);
  return ok(res, "Trips", data, 200, { pagination: paginationPayload(page, limit, total) });
}

async function assertTripAccess(trip, user) {
  if (!trip) throw new ApiError("Trip not found", 404);
  if (["TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(user.role)) return;
  if (user.role === "FACULTY_STAFF" && String(trip.facultyId?._id || trip.facultyId) === String(user._id)) return;
  if (
    user.role === "DEPARTMENT_COORDINATOR" &&
    String(trip.departmentId?._id || trip.departmentId) === String(user.departmentId)
  ) {
    return;
  }
  if (user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: user._id });
    if (driver && String(trip.driverId?._id || trip.driverId) === String(driver._id)) return;
  }
  throw new ApiError("Forbidden", 403);
}

export async function getTrip(req, res) {
  const trip = await Trip.findById(req.params.id)
    .populate("facultyId", "name email")
    .populate("departmentId", "name code")
    .populate("vehicleId")
    .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } });
  await assertTripAccess(trip, req.user);
  return ok(res, "Trip details", trip);
}

export async function tripQr(req, res) {
  const trip = await Trip.findById(req.params.id).select("facultyId departmentId driverId");
  await assertTripAccess(trip, req.user);
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
  return ok(res, "Trip completed", await endTrip({ tripId: req.params.id, actor: req.user, ...req.body }));
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
