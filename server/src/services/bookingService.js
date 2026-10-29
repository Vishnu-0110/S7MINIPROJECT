import { DriverLeave, Maintenance, Trip } from "../models/index.js";

export function hasOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

export async function assertNoDoubleBooking({ vehicleId, driverId, startTime, endTime, excludeTripId }) {
  const tripQuery = {
    status: { $in: ["SCHEDULED", "TRIP_STARTED", "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED"] },
    scheduledStartTime: { $lt: endTime },
    scheduledEndTime: { $gt: startTime }
  };

  if (excludeTripId) tripQuery._id = { $ne: excludeTripId };

  const vehicleConflict = await Trip.findOne({ ...tripQuery, vehicleId });
  if (vehicleConflict) {
    const error = new Error("DOUBLE BOOKING BLOCKED. Vehicle already has an overlapping trip.");
    error.status = 409;
    throw error;
  }

  const driverConflict = await Trip.findOne({ ...tripQuery, driverId });
  if (driverConflict) {
    const error = new Error("DOUBLE BOOKING BLOCKED. Driver already has an overlapping trip.");
    error.status = 409;
    throw error;
  }

  const leaveConflict = await DriverLeave.findOne({
    driverId,
    status: "APPROVED",
    fromDate: { $lte: endTime },
    toDate: { $gte: startTime }
  });
  if (leaveConflict) {
    const error = new Error("Driver is on approved leave during this trip.");
    error.status = 409;
    throw error;
  }

  const maintenanceConflict = await Maintenance.findOne({
    vehicleId,
    status: { $in: ["SCHEDULED", "OVERDUE", "BREAKDOWN"] },
    serviceDate: { $gte: startTime, $lte: endTime }
  });

  if (maintenanceConflict) {
    const error = new Error("Vehicle is unavailable due to maintenance.");
    error.status = 409;
    throw error;
  }
}
