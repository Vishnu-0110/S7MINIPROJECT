import mongoose from "mongoose";
import QRCode from "qrcode";
import {
  Driver,
  FuelLog,
  GpsLog,
  Trip,
  Vehicle,
  VehicleAllocation,
  VehicleRequest
} from "../models/index.js";
import { humanId, makeQrToken } from "../utils/id.js";
import { audit } from "./auditService.js";
import { assertNoDoubleBooking } from "./bookingService.js";
import { notify } from "./notificationService.js";

let ioRef = null;

export function setTripSocket(io) {
  ioRef = io;
}

function emit(room, event, payload) {
  if (ioRef) ioRef.to(room).emit(event, payload);
}

export async function createTripFromAssignment({ requestId, vehicleId, driverId, allocationId, actor, override, overrideReason }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const request = await VehicleRequest.findById(requestId).session(session);
    if (!request || request.status !== "APPROVED") {
      const error = new Error("Only approved requests can be assigned.");
      error.status = 400;
      throw error;
    }

    await assertNoDoubleBooking({
      vehicleId,
      driverId,
      startTime: request.departureTime,
      endTime: request.returnTime
    });

    const tripId = humanId("BIT-TRIP");
    const qrToken = makeQrToken(tripId);
    const allocation = allocationId ? await VehicleAllocation.findById(allocationId).session(session) : null;
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
          qrExpiresAt: request.returnTime
        }
      ],
      { session }
    );

    await Vehicle.findByIdAndUpdate(vehicleId, { status: "ASSIGNED" }, { session });
    await Driver.findByIdAndUpdate(driverId, { status: "ASSIGNED" }, { session });
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

    await notify(request.facultyId, "Trip scheduled", `Trip ${tripId} has been scheduled.`, "TRIP", { tripId: trip[0]._id });
    emit("admin-room", "allocation:updated", { requestId, tripId });
    emit(`driver-room-${driverId}`, "trip:updated", { tripId });
    return trip[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function generateTripQr(trip) {
  const freshTrip = await Trip.findById(trip._id || trip).select("+qrToken");
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
  if (trip.status !== "SCHEDULED") {
    const error = new Error("Only scheduled trips can be QR verified.");
    error.status = 400;
    throw error;
  }
  if (trip.qrToken !== qrToken || trip.qrConsumed || (trip.qrExpiresAt && trip.qrExpiresAt < new Date())) {
    const error = new Error("Invalid, expired, or reused QR");
    error.status = 400;
    throw error;
  }
  trip.qrVerifiedAt = new Date();
  trip.qrConsumed = true;
  await trip.save();
  return trip;
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
  if (!trip.qrVerifiedAt) {
    if (!qrToken || trip.qrToken !== qrToken || (trip.qrExpiresAt && trip.qrExpiresAt < new Date())) {
      const error = new Error("QR verification is required before starting this trip.");
      error.status = 400;
      throw error;
    }
    trip.qrVerifiedAt = new Date();
    trip.qrConsumed = true;
  }
  trip.startKM = startKM;
  trip.startTime = new Date();
  trip.status = "TRIP_STARTED";
  trip.startLocation = location ? { ...location, recordedAt: new Date() } : undefined;
  await trip.save();
  await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: "IN_TRIP" });
  await Driver.findByIdAndUpdate(driver._id, { status: "IN_TRIP" });
  if (location) {
    await GpsLog.create({ tripId: trip._id, vehicleId: trip.vehicleId, driverId: driver._id, ...location });
  }
  await notify(trip.facultyId, "Trip started", `Trip ${trip.tripId} has started.`, "TRIP", { tripId: trip._id });
  emit(`trip-room-${trip._id}`, "trip:started", trip);
  emit("admin-room", "trip:started", trip);
  return trip;
}

export async function endTrip({ tripId, actor, endKM, fuelUsed, actualCost, location }) {
  const driver = await Driver.findOne({ userId: actor._id });
  const trip = await Trip.findById(tripId);
  if (!driver || !trip || String(trip.driverId) !== String(driver._id)) {
    const error = new Error("Driver is not authorized for this trip.");
    error.status = 403;
    throw error;
  }
  if (trip.status !== "TRIP_STARTED") {
    const error = new Error("Only started trips can be completed.");
    error.status = 400;
    throw error;
  }
  if (endKM < (trip.startKM || 0)) {
    const error = new Error("Ending KM cannot be less than the starting KM.");
    error.status = 400;
    throw error;
  }
  const distance = Math.max(0, endKM - (trip.startKM || 0));
  const fuelEfficiency = fuelUsed > 0 ? Number((distance / fuelUsed).toFixed(2)) : 0;
  trip.endKM = endKM;
  trip.fuelUsed = fuelUsed;
  trip.distance = distance;
  trip.fuelEfficiency = fuelEfficiency;
  trip.actualCost = actualCost;
  trip.endTime = new Date();
  trip.endLocation = location ? { ...location, recordedAt: new Date() } : undefined;
  trip.status = "TRIP_COMPLETED";
  await trip.save();

  await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: "AVAILABLE", currentKM: endKM });
  await Driver.findByIdAndUpdate(driver._id, { status: "AVAILABLE", $inc: { totalTrips: 1 } });
  if (fuelUsed > 0) {
    await FuelLog.create({
      fuelLogId: humanId("FUEL"),
      vehicleId: trip.vehicleId,
      tripId: trip._id,
      quantity: fuelUsed,
      totalAmount: actualCost,
      odometerReading: endKM,
      enteredBy: actor._id,
      efficiency: fuelEfficiency,
      abnormal: fuelEfficiency > 0 && fuelEfficiency < 3
    });
  }
  await notify(trip.facultyId, "Trip completed", `Trip ${trip.tripId} is completed.`, "TRIP", { tripId: trip._id });
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
  if (trip.status !== "TRIP_STARTED") {
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
