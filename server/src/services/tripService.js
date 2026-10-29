import mongoose from "mongoose";
import QRCode from "qrcode";
import {
  Driver,
  GpsLog,
  Trip,
  Vehicle,
  VehicleAllocation,
  VehicleRequest,
  User
} from "../models/index.js";
import { humanId, makeQrToken } from "../utils/id.js";
import { audit } from "./auditService.js";
import { assertNoDoubleBooking } from "./bookingService.js";
import { notify, notifyMany } from "./notificationService.js";
import { isCapacityFit, vehicleSupportsRequest } from "./allocationService.js";
import { sendTripDayReminder } from "./tripReminderService.js";
import { isTodayInIndia } from "../utils/indiaTime.js";
import { ensureRoutineServiceSchedule } from "./maintenanceService.js";

let ioRef = null;

export function setTripSocket(io) {
  ioRef = io;
}

function emit(room, event, payload) {
  if (ioRef) ioRef.to(room).emit(event, payload);
}

async function notifyTripParticipants(trip, title, message) {
  try {
    const driver = await Driver.findById(trip.driverId).select("userId");
    const managers = await User.find({
      isActive: true,
      $or: [
        { role: "TRANSPORT_ADMIN" },
        { role: "DEPARTMENT_COORDINATOR", departmentId: trip.departmentId }
      ]
    }).select("_id");
    await notifyMany(
      [trip.facultyId, driver?.userId, ...managers.map((manager) => manager._id)],
      title,
      message,
      "TRIP",
      { tripId: trip._id, requestId: trip.requestId }
    );
  } catch (error) {
    // The trip transition is already durable. Notification delivery must never
    // turn a successful start, end, or completion into an HTTP 500 response.
    console.error("Trip notification delivery failed:", error.message);
  }
}

export async function createTripFromAssignment({ requestId, vehicleId, driverId, allocationId, actor, override, overrideReason }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const request = await VehicleRequest.findById(requestId).session(session);
    if (!request || !["APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(request.status)) {
      const error = new Error("Only approved requests can be assigned.");
      error.status = 400;
      throw error;
    }

    const allocation = allocationId
      ? await VehicleAllocation.findOne({ _id: allocationId, requestId, vehicleId, driverId }).session(session)
      : null;
    if (allocationId && !allocation) {
      const error = new Error("The selected allocation does not belong to this request and assignment.");
      error.status = 403;
      throw error;
    }
    if (!allocationId && !override) {
      const error = new Error("Manual assignment requires an approved allocation or an administrator override.");
      error.status = 400;
      throw error;
    }
    if (override && !overrideReason?.trim()) {
      const error = new Error("An administrator override requires a recorded reason.");
      error.status = 400;
      throw error;
    }

    if (await Trip.exists({ requestId }).session(session)) {
      const error = new Error("This request already has a scheduled trip.");
      error.status = 409;
      throw error;
    }

    await assertNoDoubleBooking({
      vehicleId,
      driverId,
      startTime: request.departureTime,
      endTime: request.returnTime
    });

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, status: "AVAILABLE", condition: { $ne: "POOR" }, capacity: { $gte: request.passengerCount } },
      { status: "ASSIGNED" },
      { new: true, session }
    );
    if (!vehicle || !isCapacityFit(vehicle, request.passengerCount)) {
      const error = new Error("Vehicle does not have enough seats for the passenger count.");
      error.status = 409;
      throw error;
    }
    if (!vehicleSupportsRequest(vehicle, request)) {
      const error = new Error("Vehicle does not meet the request's required facilities.");
      error.status = 409;
      throw error;
    }
    const driver = await Driver.findOne({ _id: driverId }).session(session);
    if (!driver || driver.status !== "AVAILABLE") {
      const error = new Error("Driver is no longer available.");
      error.status = 409;
      throw error;
    }
    const reservedDriver = await Driver.findOneAndUpdate({ _id: driverId, status: "AVAILABLE" }, { status: "ASSIGNED" }, { new: true, session });
    if (!reservedDriver) {
      const error = new Error("Driver is no longer available.");
      error.status = 409;
      throw error;
    }

    const tripId = request.requestId;
    const qrToken = makeQrToken(tripId);
    const estimatedCost = allocation?.estimatedCost || 0;

    const trip = await Trip.create(
      [
        {
          tripId,
          requestId: request._id,
          facultyId: request.facultyId,
          departmentId: request.departmentId,
          vehicleId,
          driverId,
          purpose: request.purpose,
          tripType: request.tripType,
          source: request.source,
          destination: request.destination,
          waypoints: request.waypoints,
          passengers: request.passengers,
          passengerCount: request.passengerCount,
          scheduledStartTime: request.departureTime,
          scheduledEndTime: request.returnTime,
          estimatedCost,
          status: "SCHEDULED",
          qrToken,
          qrExpiresAt: new Date(Math.min(new Date(request.returnTime).getTime(), new Date(request.departureTime).getTime() + 2 * 60 * 60 * 1000)),
          assignmentHistory: [{ vehicleId, driverId, assignedBy: actor?._id, reason: override ? overrideReason || "Administrator override" : "Automatic allocation" }]
        }
      ],
      { session }
    );

    request.status = "SCHEDULED";
    request.history.push({ status: "SCHEDULED", actorId: actor._id, note: "Vehicle and driver assigned" });
    await request.save({ session });

    if (allocation) {
      allocation.isSelected = true;
      allocation.override = Boolean(override);
      allocation.overrideReason = overrideReason;
      await allocation.save({ session });
    }

    await audit(actor._id, "TRIP_SCHEDULED", "Trip", trip[0]._id, { requestId, vehicleId, driverId, override });
    await session.commitTransaction();

    await notifyTripParticipants(trip[0], "Trip scheduled", `Trip ${tripId} has been scheduled. The assigned vehicle and driver are ready for the trip.`);
    await sendTripDayReminder(trip[0], reservedDriver);
    emit("admin-room", "allocation:updated", { requestId, tripId });
    emit(`driver-room-${driverId}`, "trip:updated", { tripId });
    return trip[0];
  } catch (error) {
    await session.abortTransaction();
    if (error?.code === 11000) {
      error.status = 409;
      error.message = "This request already has a scheduled trip.";
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export async function scheduleApprovedRequest({ requestId, actor }) {
  const request = await VehicleRequest.findById(requestId);
  if (!request || !["APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(request.status)) return null;
  const { runSmartAllocation } = await import("./allocationService.js");
  const allocations = await runSmartAllocation(request);
  const recommendation = allocations[0];
  if (!recommendation) {
    request.status = "APPROVED_AWAITING_VEHICLE";
    request.history.push({ status: request.status, actorId: actor?._id, note: "No eligible vehicle and driver are currently available." });
    await request.save();
    const admins = await User.find({ role: "TRANSPORT_ADMIN", isActive: true }).select("_id");
    await Promise.all(admins.map((admin) => notify(admin._id, "Vehicle needed", `Request ${request.requestId} is approved but no eligible vehicle and driver are available.`, "REQUEST", { requestId: request._id })));
    return { request, allocations: [] };
  }
  try {
    const trip = await createTripFromAssignment({
      requestId: request._id,
      vehicleId: recommendation.vehicleId._id || recommendation.vehicleId,
      driverId: recommendation.driverId._id || recommendation.driverId,
      allocationId: recommendation._id,
      actor
    });
    return { request, trip, allocations };
  } catch (error) {
    if (error.status !== 409) throw error;
    request.status = "APPROVED_AWAITING_VEHICLE";
    request.history.push({ status: request.status, actorId: actor?._id, note: "Allocation changed while reserving resources; retry required." });
    await request.save();
    return { request, allocations: [] };
  }
}

export async function reassignTrip({ tripId, allocation, actor, allowCapacityOverride = false }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const trip = await Trip.findById(tripId).session(session);
    if (!trip || !["BREAKDOWN_REPORTED", "REPLACEMENT_SEARCHING", "REPLACEMENT_UNAVAILABLE", "VEHICLE_REASSIGNMENT_REQUIRED", "TRIP_STARTED"].includes(trip.status)) {
      const error = new Error("Trip is not awaiting a replacement assignment.");
      error.status = 409;
      throw error;
    }
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: allocation.vehicleId, status: "AVAILABLE", capacity: { $gte: trip.passengerCount } },
      { status: "ASSIGNED" },
      { new: true, session }
    );
    if (!vehicle || !isCapacityFit(vehicle, trip.passengerCount)) {
      const error = new Error(allowCapacityOverride ? "No available replacement bus has enough seats for this trip." : "Replacement vehicle does not have enough seats for this trip.");
      error.status = 409;
      throw error;
    }
    const driver = await Driver.findOneAndUpdate(
      { _id: allocation.driverId, status: "AVAILABLE" },
      { status: "ASSIGNED" },
      { new: true, session }
    );
    if (!driver) {
      const error = new Error("Replacement driver is no longer available.");
      error.status = 409;
      throw error;
    }
    const oldVehicleId = trip.vehicleId;
    const oldDriverId = trip.driverId;
    const latestAssignment = trip.assignmentHistory.at(-1);
    if (latestAssignment) latestAssignment.releasedAt = new Date();
    trip.originalVehicleId ||= oldVehicleId;
    trip.originalDriverId ||= oldDriverId;
    trip.assignmentVersion += 1;
    trip.vehicleId = vehicle._id;
    trip.driverId = driver._id;
    trip.status = "TRANSFER_OR_VERIFICATION_PENDING";
    trip.replacementStatus = "VERIFICATION_PENDING";
    trip.qrToken = makeQrToken(trip.tripId);
    trip.qrVerifiedAt = undefined;
    trip.qrConsumed = false;
    // A breakdown can happen after the original expected return time or cross
    // midnight. Keep the replacement token valid long enough for the new driver
    // to scan it instead of immediately creating an expired token.
    trip.qrExpiresAt = new Date(Math.max(new Date(trip.scheduledEndTime).getTime(), Date.now() + 2 * 60 * 60 * 1000));
    trip.assignmentHistory.push({ vehicleId: vehicle._id, driverId: driver._id, assignedBy: actor?._id, reason: "Breakdown replacement" });
    await trip.save({ session });
    if (String(oldDriverId) !== String(driver._id)) await Driver.findByIdAndUpdate(oldDriverId, { status: "AVAILABLE" }, { session });
    await VehicleAllocation.findByIdAndUpdate(allocation._id, { isSelected: true, reallocationForTripId: trip._id }, { session });
    await session.commitTransaction();
    await notifyTripParticipants(trip, "Replacement vehicle assigned", `Trip ${trip.tripId} has a replacement vehicle. The faculty member must show the updated QR code to the driver.`);
    const replacementEvent = { tripId: String(trip._id), vehicleId: String(vehicle._id), driverId: String(driver._id), replacement: true };
    emit("admin-room", "trip:reallocated", replacementEvent);
    emit(`user-room-${trip.facultyId}`, "trip:reallocated", replacementEvent);
    emit(`trip-room-${trip._id}`, "trip:reallocated", replacementEvent);
    emit(`driver-room-${driver._id}`, "trip:updated", replacementEvent);
    return trip;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function generateTripQr(trip) {
  const freshTrip = await Trip.findById(trip._id || trip).select("+qrToken");
  if (!freshTrip) throw new Error("Trip not found");
  if (freshTrip.qrExpiresAt < new Date() && ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(freshTrip.status)) {
    freshTrip.qrToken = makeQrToken(freshTrip.tripId);
    freshTrip.qrConsumed = false;
    freshTrip.qrVerifiedAt = undefined;
    freshTrip.qrExpiresAt = new Date(Math.max(new Date(freshTrip.scheduledEndTime).getTime(), Date.now() + 2 * 60 * 60 * 1000));
    await freshTrip.save();
  }
  return QRCode.toDataURL(freshTrip.qrToken);
}

export async function verifyQr({ tripId, qrToken, driver }) {
  const trip = await Trip.findById(tripId).select("+qrToken").populate("facultyId departmentId vehicleId driverId");
  if (!trip) {
    const error = new Error("Trip not found");
    error.status = 404;
    throw error;
  }
  if (String(trip.driverId._id) !== String(driver._id)) {
    const error = new Error("Unauthorized QR scan");
    error.status = 403;
    throw error;
  }
  const isReplacementVerification = ["TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status);
  if (!isReplacementVerification && !isTodayInIndia(trip.scheduledStartTime)) {
    const error = new Error("QR verification is available only on the scheduled trip date.");
    error.status = 403;
    throw error;
  }
  if (!["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"].includes(trip.status)) {
    const error = new Error("Only scheduled trips can be QR verified.");
    error.status = 400;
    throw error;
  }
  if (trip.qrToken !== qrToken || trip.qrConsumed || (trip.qrExpiresAt && trip.qrExpiresAt < new Date())) {
    const error = new Error("Invalid, expired, or reused QR");
    error.status = 400;
    throw error;
  }
  const resumeTrip = trip.status !== "SCHEDULED";
  const verified = await Trip.findOneAndUpdate(
    { _id: trip._id, qrToken, qrConsumed: false, status: trip.status, qrExpiresAt: { $gt: new Date() } },
    { qrVerifiedAt: new Date(), qrConsumed: true, ...(resumeTrip ? { status: "TRIP_RESUMED", replacementStatus: "NONE" } : {}) },
    { new: true }
  );
  if (!verified) {
    const error = new Error("QR code has already been used or is no longer valid.");
    error.status = 409;
    throw error;
  }
  if (resumeTrip) {
    await Vehicle.findByIdAndUpdate(verified.vehicleId, { status: "IN_TRIP" });
    await Driver.findByIdAndUpdate(verified.driverId, { status: "IN_TRIP" });
    await notifyTripParticipants(verified, "Trip resumed", `Trip ${verified.tripId} has resumed with its replacement assignment.`);
  }
  return verified;
}

export async function startTrip({ tripId, actor, startKM, qrToken, location }) {
  const driver = await Driver.findOne({ userId: actor._id });
  const trip = await Trip.findById(tripId).select("+qrToken");
  if (!driver || !trip || String(trip.driverId) !== String(driver._id)) {
    const error = new Error("Driver is not authorized for this trip.");
    error.status = 403;
    throw error;
  }
  if (trip.status !== "SCHEDULED") {
    const error = new Error("Trip cannot be started in its current status.");
    error.status = 400;
    throw error;
  }
  if (!isTodayInIndia(trip.scheduledStartTime)) {
    const error = new Error("Trips can be started only on their scheduled date.");
    error.status = 403;
    throw error;
  }
  if (!trip.qrVerifiedAt) {
    const error = new Error("QR verification is required before starting this trip.");
    error.status = 400;
    throw error;
  }
  if (!qrToken || trip.qrToken !== qrToken) {
    const error = new Error("Scan and verify the QR code for this trip before starting.");
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(Number(startKM)) || Number(startKM) < 0) {
    const error = new Error("Enter a valid starting kilometre reading before starting the trip.");
    error.status = 400;
    throw error;
  }
  const started = await Trip.findOneAndUpdate(
    { _id: trip._id, status: "SCHEDULED", qrVerifiedAt: { $exists: true } },
    { startKM: Number(startKM), startTime: new Date(), status: "TRIP_STARTED", startLocation: location ? { ...location, recordedAt: new Date() } : undefined },
    { new: true }
  );
  if (!started) {
    const error = new Error("Trip start was already processed or QR verification is required.");
    error.status = 409;
    throw error;
  }
  await Vehicle.findByIdAndUpdate(started.vehicleId, { status: "IN_TRIP" });
  await Driver.findByIdAndUpdate(driver._id, { status: "IN_TRIP" });
  if (location) {
    await GpsLog.create({ tripId: started._id, vehicleId: started.vehicleId, driverId: driver._id, ...location });
  }
  await notifyTripParticipants(started, "Trip started", `Trip ${started.tripId} has started with a verified QR code and recorded odometer reading.`);
  emit(`trip-room-${started._id}`, "trip:started", started);
  emit("admin-room", "trip:started", started);
  return started;
}

export async function requestTripCompletion({ tripId, actor, endKM, location }) {
  const driver = await Driver.findOne({ userId: actor._id });
  const trip = await Trip.findById(tripId);
  if (!driver || !trip || String(trip.driverId) !== String(driver._id)) {
    const error = new Error("Driver is not authorized for this trip.");
    error.status = 403;
    throw error;
  }
  if (!["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status)) {
    const error = new Error("Only started trips can be submitted for completion.");
    error.status = 400;
    throw error;
  }
  if (endKM < (trip.startKM || 0)) {
    const error = new Error("Ending KM cannot be less than the starting KM.");
    error.status = 400;
    throw error;
  }
  const distance = Math.max(0, endKM - (trip.startKM || 0));
  trip.endKM = endKM;
  trip.distance = distance;
  trip.completionRequestedAt = new Date();
  trip.completionQrToken = makeQrToken(`${trip.tripId}-completion`);
  trip.completionQrExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  trip.completionQrConsumed = false;
  trip.endLocation = location ? { ...location, recordedAt: new Date() } : undefined;
  trip.status = "TRIP_COMPLETION_PENDING";
  await trip.save();
  await notifyTripParticipants(trip, "Trip ready for confirmation", `Trip ${trip.tripId} needs the faculty member to scan the completion QR code and submit a rating.`);
  emit(`trip-room-${trip._id}`, "trip:completion-pending", trip);
  emit("admin-room", "trip:completion-pending", trip);
  return trip;
}

export async function generateCompletionQr(tripId, actor) {
  const driver = await Driver.findOne({ userId: actor._id });
  const trip = await Trip.findById(tripId).select("+completionQrToken");
  if (!driver || !trip || String(trip.driverId) !== String(driver._id)) {
    const error = new Error("Driver is not authorized for this trip."); error.status = 403; throw error;
  }
  if (trip.status !== "TRIP_COMPLETION_PENDING" || !trip.completionQrToken || trip.completionQrExpiresAt < new Date()) {
    const error = new Error("A valid ending odometer reading is required before generating the completion QR code."); error.status = 409; throw error;
  }
  return QRCode.toDataURL(trip.completionQrToken);
}

export async function completeTrip({ tripId, actor, qrToken, rating, feedback }) {
  const trip = await Trip.findById(tripId).select("+completionQrToken");
  if (!trip || String(trip.facultyId) !== String(actor._id)) {
    const error = new Error("Only the faculty member who requested this trip can confirm it."); error.status = 403; throw error;
  }
  // Completion is intentionally idempotent. A slow mobile network can lose the
  // success response after the durable trip update, and retrying must not turn a
  // correctly completed trip into a confusing error for the faculty member.
  if (trip.status === "TRIP_COMPLETED" && trip.completionQrConsumed) return trip;
  if (trip.status !== "TRIP_COMPLETION_PENDING") {
    const error = new Error("This trip is not awaiting faculty confirmation."); error.status = 409; throw error;
  }
  if (trip.completionQrToken !== qrToken || trip.completionQrConsumed || trip.completionQrExpiresAt < new Date()) {
    const error = new Error("The completion QR code is invalid, expired, or already used."); error.status = 400; throw error;
  }
  trip.facultyRating = rating;
  trip.facultyFeedback = feedback;
  trip.completionQrConsumed = true;
  trip.endTime = new Date();
  trip.status = "TRIP_COMPLETED";
  await trip.save();
  // The trip is complete at this point. Fleet statistics, availability and
  // maintenance updates must not change a successful confirmation into HTTP 500.
  try {
    const driver = await Driver.findByIdAndUpdate(trip.driverId, { status: "AVAILABLE", $inc: { totalTrips: 1 } }, { new: true });
    if (driver) {
      const ratedTrips = await Trip.find({ driverId: driver._id, status: "TRIP_COMPLETED", facultyRating: { $exists: true } }).select("facultyRating");
      const ratings = ratedTrips.map((item) => Number(item.facultyRating)).filter(Number.isFinite);
      if (ratings.length) {
        driver.rating = Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1));
        await driver.save();
      }
    }
  } catch (error) {
    console.error("Trip completion driver update failed:", error.message);
  }
  try {
    await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: "AVAILABLE", currentKM: trip.endKM });
    await ensureRoutineServiceSchedule(trip.vehicleId);
  } catch (error) {
    console.error("Trip completion vehicle update failed:", error.message);
  }
  await notifyTripParticipants(trip, "Trip completed", `Trip ${trip.tripId} was confirmed by the faculty member with a ${rating}-star rating.`);
  emit(`trip-room-${trip._id}`, "trip:completed", trip);
  emit("admin-room", "trip:completed", trip);
  return trip;
}

export async function saveGps({ tripId, actor, payload }) {
  const driver = await Driver.findOne({ userId: actor._id });
  const trip = await Trip.findById(tripId);
  if (!driver || !trip || String(trip.driverId) !== String(driver._id)) {
    const error = new Error("Driver is not authorized to update this location.");
    error.status = 403;
    throw error;
  }
  if (!["TRIP_STARTED", "TRIP_RESUMED"].includes(trip.status)) {
    const error = new Error("GPS logging is available only after the trip has started.");
    error.status = 400;
    throw error;
  }
  const log = await GpsLog.create({
    tripId,
    vehicleId: trip.vehicleId,
    driverId: driver._id,
    ...payload,
    timestamp: new Date()
  });
  emit(`trip-room-${trip._id}`, "vehicle:location", log);
  emit("admin-room", "vehicle:location", log);
  return log;
}
