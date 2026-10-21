import { EmergencyAlert, Expense, FuelLog, GpsLog, Maintenance, Notification, Vehicle, Driver, Trip, VehicleRequest, VehicleAllocation } from "../models/index.js";
import { ok } from "../utils/apiResponse.js";
import { humanId } from "../utils/id.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { runSmartAllocation } from "../services/allocationService.js";

function listFor(Model, baseQuery = {}) {
  return async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const query = { ...baseQuery };
    for (const field of ["vehicleId", "tripId", "category", "status", "isRead"]) {
      if (req.query[field]) query[field] = req.query[field];
    }
    const [data, total] = await Promise.all([
      Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Model.countDocuments(query)
    ]);
    return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
  };
}

export const listMaintenance = listFor(Maintenance);
export const listFuel = async (req, res) => {
  if (req.user.role === "DRIVER") return listFor(FuelLog, { enteredBy: req.user._id })(req, res);
  return listFor(FuelLog)(req, res);
};
export const listExpenses = listFor(Expense);
export const listNotifications = async (req, res) => listFor(Notification, { userId: req.user._id })(req, res);
export const listGps = listFor(GpsLog);
export async function listEmergencies(req, res) {
  if (req.user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: req.user._id });
    return listFor(EmergencyAlert, { driverId: driver?._id || null })(req, res);
  }
  return listFor(EmergencyAlert)(req, res);
}

export async function createFuel(req, res) {
  const quantity = Number(req.body.quantity);
  const odometerReading = Number(req.body.odometerReading);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Fuel quantity must be greater than zero.");
    error.status = 400;
    throw error;
  }
  if (req.body.odometerReading !== undefined && (!Number.isFinite(odometerReading) || odometerReading < 0)) {
    const error = new Error("Odometer reading must be a non-negative number.");
    error.status = 400;
    throw error;
  }
  if (req.user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: req.user._id });
    const trip = req.body.tripId ? await Trip.findOne({ _id: req.body.tripId, driverId: driver?._id }) : null;
    if (!driver || !trip || (req.body.vehicleId && String(req.body.vehicleId) !== String(trip.vehicleId))) {
      const error = new Error("Drivers can only record fuel for their assigned trips.");
      error.status = 403;
      throw error;
    }
  }
  const totalAmount = req.body.totalAmount || req.body.quantity * req.body.pricePerLiter;
  if (totalAmount !== undefined && (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) < 0)) {
    const error = new Error("Fuel amount must be a non-negative number.");
    error.status = 400;
    throw error;
  }
  return ok(res, "Fuel logged", await FuelLog.create({ ...req.body, quantity, odometerReading, fuelLogId: humanId("FUEL"), totalAmount, enteredBy: req.user._id }), 201);
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) {
    const error = new Error("Notification not found");
    error.status = 404;
    throw error;
  }
  return ok(res, "Notification marked as read", notification);
}

export async function createExpense(req, res) {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("Expense amount must be a non-negative number.");
    error.status = 400;
    throw error;
  }
  return ok(res, "Expense logged", await Expense.create({ ...req.body, amount, expenseId: humanId("EXP"), enteredBy: req.user._id }), 201);
}

export async function createMaintenance(req, res) {
  if (!req.body.vehicleId || !req.body.type) {
    const error = new Error("Vehicle and maintenance type are required.");
    error.status = 400;
    throw error;
  }
  return ok(res, "Maintenance logged", await Maintenance.create({ ...req.body, maintenanceId: humanId("MAIN") }), 201);
}

export async function raiseEmergency(req, res) {
  const driver = req.user.role === "DRIVER" ? await Driver.findOne({ userId: req.user._id }) : null;
  if (driver && req.body.tripId) {
    const trip = await Trip.findOne({ _id: req.body.tripId, driverId: driver._id });
    if (!trip || (req.body.vehicleId && String(req.body.vehicleId) !== String(trip.vehicleId))) {
      const error = new Error("Emergency trip or vehicle is not assigned to this driver.");
      error.status = 403;
      throw error;
    }
  }
  const alert = await EmergencyAlert.create({
    ...req.body,
    driverId: driver?._id || req.body.driverId,
    alertId: humanId("EMG")
  });
  req.app.get("io")?.to("admin-room").emit("emergency:new", alert);
  return ok(res, "Emergency raised", alert, 201);
}

export async function resolveEmergency(req, res) {
  const alert = await EmergencyAlert.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status || "RESOLVED", resolvedAt: new Date() },
    { new: true }
  );
  if (!alert) {
    const error = new Error("Emergency alert not found");
    error.status = 404;
    throw error;
  }
  req.app.get("io")?.to("admin-room").emit("emergency:updated", alert);
  return ok(res, "Emergency updated", alert);
}

export async function breakdown(req, res) {
  if (!req.body.vehicleId) {
    const error = new Error("Vehicle is required for a breakdown report.");
    error.status = 400;
    throw error;
  }
  if (req.user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: req.user._id });
    const trip = req.body.tripId ? await Trip.findOne({ _id: req.body.tripId, driverId: driver?._id }) : null;
    if (!driver || !trip || String(trip.vehicleId) !== String(req.body.vehicleId)) {
      const error = new Error("Drivers can only report breakdowns for their assigned vehicle and trip.");
      error.status = 403;
      throw error;
    }
  }
  await Vehicle.findByIdAndUpdate(req.body.vehicleId, { status: "BREAKDOWN" });
  if (req.body.driverId) await Driver.findByIdAndUpdate(req.body.driverId, { status: "AVAILABLE" });
  const alert = await EmergencyAlert.create({ ...req.body, alertId: humanId("BRK"), status: "OPEN", message: req.body.message || "Vehicle breakdown reported" });
  let alternatives = [];
  if (req.body.tripId) {
    const trip = await Trip.findByIdAndUpdate(req.body.tripId, { status: "VEHICLE_REASSIGNMENT_REQUIRED" }, { new: true });
    if (trip) {
      const request = await VehicleRequest.findById(trip.requestId);
      if (request) {
        alternatives = await runSmartAllocation(request);
        await VehicleAllocation.updateMany(
          { requestId: request._id, isSelected: false },
          { reallocationForTripId: trip._id }
        );
      }
    }
  }
  req.app.get("io")?.to("admin-room").emit("trip:reallocated", { alert, alternatives });
  return ok(res, "Breakdown reported and replacement allocation generated", { alert, alternatives }, 201);
}
