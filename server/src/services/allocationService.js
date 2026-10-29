import { Driver, DriverLeave, Maintenance, Trip, Vehicle, VehicleAllocation } from "../models/index.js";
import { humanId } from "../utils/id.js";

const defaultWeights = {
  capacity: 30,
  availability: 25,
  distance: 20,
  maintenance: 15,
  driver: 10
};

export function isCapacityFit(vehicle, passengerCount) {
  const spareCapacity = Number(vehicle.capacity) - Number(passengerCount);
  return spareCapacity >= 0;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function estimateDistanceKm(request) {
  const text = `${request.source || ""} ${request.destination || ""}`.toLowerCase();
  if (text.includes("coimbatore")) return 162;
  if (text.includes("erode")) return 10;
  if (text.includes("tiruppur")) return 95;
  if (text.includes("salem")) return 120;
  return 60;
}

export function vehicleSupportsRequest(vehicle, request) {
  const required = (request.requiredFacilities || []).map((value) => value.trim().toLowerCase());
  if (!required.length) return true;
  const available = new Set((vehicle.facilities || []).map((value) => value.trim().toLowerCase()));
  return required.every((facility) => available.has(facility));
}

export async function getAllocationWeights() {
  return defaultWeights;
}

export async function vehicleHasScheduleConflict(vehicleId, start, end) {
  return Boolean(
    await Trip.exists({
      vehicleId,
      status: { $in: ["SCHEDULED", "TRIP_STARTED", "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED"] },
      scheduledStartTime: { $lt: end },
      scheduledEndTime: { $gt: start }
    })
  );
}

export async function driverHasScheduleConflict(driverId, start, end) {
  return Boolean(
    await Trip.exists({
      driverId,
      status: { $in: ["SCHEDULED", "TRIP_STARTED", "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED"] },
      scheduledStartTime: { $lt: end },
      scheduledEndTime: { $gt: start }
    })
  );
}

export async function driverHasApprovedLeave(driverId, start, end) {
  return Boolean(await DriverLeave.exists({
    driverId,
    status: "APPROVED",
    fromDate: { $lte: end },
    toDate: { $gte: start }
  }));
}

export async function scoreVehicleForRequest({ request, vehicle, driver, maintenanceConflict, vehicleConflict, driverConflict, weights, allowCapacityOverride = false }) {
  const passengerCount = request.passengerCount || 1;
  const distanceKm = estimateDistanceKm(request);
  const spareCapacity = vehicle.capacity - passengerCount;
  const capacityEligible = allowCapacityOverride ? spareCapacity >= 0 : isCapacityFit(vehicle, passengerCount);
  const capacityScore = capacityEligible ? clamp(100 - Math.min(spareCapacity * 2, 45)) : 0;
  const facilityCompatible = vehicleSupportsRequest(vehicle, request);
  const availabilityScore = vehicle.status === "AVAILABLE" && !vehicleConflict && facilityCompatible ? 100 : 0;
  const distanceScore = clamp((vehicle.mileageKmPerLiter || 4) * 14 - distanceKm / 10);
  const maintenanceScore = maintenanceConflict || vehicle.status === "MAINTENANCE" || vehicle.status === "BREAKDOWN" ? 0 : vehicle.condition === "EXCELLENT" ? 100 : vehicle.condition === "GOOD" ? 85 : vehicle.condition === "FAIR" ? 55 : 25;
  const driverAvailabilityScore = driver && driver.status === "AVAILABLE" && !driverConflict ? 100 : 0;
  const score = clamp(
    (capacityScore * weights.capacity +
      availabilityScore * weights.availability +
      distanceScore * weights.distance +
      maintenanceScore * weights.maintenance +
      driverAvailabilityScore * weights.driver) /
      100
  );

  const estimatedCost = Math.round((distanceKm / (vehicle.mileageKmPerLiter || 4)) * 95 + distanceKm * 8);
  const reasons = [];
  if (capacityScore > 0) reasons.push(spareCapacity === 0 ? "Exact passenger capacity" : `${spareCapacity} spare seats available`);
  if (availabilityScore === 100) reasons.push("Vehicle available");
  if (facilityCompatible && request.requiredFacilities?.length) reasons.push("Required facilities available");
  if (driverAvailabilityScore === 100) reasons.push("Driver available");
  if (maintenanceScore >= 80) reasons.push("No maintenance conflict");
  if (distanceScore >= 60) reasons.push("Efficient choice");

  return {
    vehicle,
    driver,
    score,
    capacityScore,
    availabilityScore,
    distanceScore,
    maintenanceScore,
    driverAvailabilityScore,
    estimatedCost,
    reasons
  };
}

export async function runSmartAllocation(request, { excludeVehicleIds = [], allowCapacityOverride = false, vehicleType } = {}) {
  const weights = await getAllocationWeights();
  const vehicleQuery = { _id: { $nin: excludeVehicleIds }, status: "AVAILABLE" };
  if (vehicleType) vehicleQuery.type = vehicleType;
  const vehicles = await Vehicle.find(vehicleQuery).lean();
  const drivers = await Driver.find({ status: "AVAILABLE" }).lean();
  const start = request.departureTime;
  const end = request.returnTime;

  const scored = [];
  for (const vehicle of vehicles) {
    const vehicleConflict = await vehicleHasScheduleConflict(vehicle._id, start, end);
    const maintenanceConflict = await Maintenance.exists({
      vehicleId: vehicle._id,
      status: { $in: ["SCHEDULED", "OVERDUE", "BREAKDOWN"] },
      serviceDate: { $gte: start, $lte: end }
    });
    const candidates = [...drivers].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    let driver = null;
    let driverConflict = true;
    for (const candidate of candidates) {
      if (!(await driverHasScheduleConflict(candidate._id, start, end)) && !(await driverHasApprovedLeave(candidate._id, start, end))) {
        driver = candidate;
        driverConflict = false;
        break;
      }
    }
    const item = await scoreVehicleForRequest({
      request,
      vehicle,
      driver,
      maintenanceConflict,
      vehicleConflict,
      driverConflict,
      weights,
      allowCapacityOverride
    });
    scored.push(item);
  }

  const top = scored
    .filter((item) => item.capacityScore > 0 && item.availabilityScore > 0 && item.maintenanceScore > 0 && item.driverAvailabilityScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  await VehicleAllocation.deleteMany({ requestId: request._id, isSelected: false });
  const docs = await VehicleAllocation.insertMany(
    top.map((item, index) => ({
      allocationId: humanId("ALLOC"),
      requestId: request._id,
      vehicleId: item.vehicle._id,
      driverId: item.driver?._id,
      score: item.score,
      capacityScore: item.capacityScore,
      availabilityScore: item.availabilityScore,
      distanceScore: item.distanceScore,
      maintenanceScore: item.maintenanceScore,
      driverAvailabilityScore: item.driverAvailabilityScore,
      estimatedCost: item.estimatedCost,
      reasons: item.reasons,
      isRecommended: index === 0
    }))
  );

  return VehicleAllocation.find({ _id: { $in: docs.map((doc) => doc._id) } })
    .populate("vehicleId")
    .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } })
    .sort({ score: -1 });
}
