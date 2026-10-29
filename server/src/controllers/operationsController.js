import { EmergencyAlert, Expense, FuelLog, GpsLog, Maintenance, Notification, Vehicle, VehicleDocument, Driver, Trip, VehicleRequest, User } from "../models/index.js";
import { ok } from "../utils/apiResponse.js";
import { humanId } from "../utils/id.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { runSmartAllocation } from "../services/allocationService.js";
import { reassignTrip } from "../services/tripService.js";
import { notifyMany } from "../services/notificationService.js";
import { ensureAllRoutineServiceSchedules } from "../services/maintenanceService.js";

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

export async function listMaintenance(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const now = new Date();
  await ensureAllRoutineServiceSchedules();
  const [maintenance, expiredDocuments] = await Promise.all([
    Maintenance.find().populate("vehicleId", "vehicleId registrationNumber type").sort({ createdAt: -1 }).lean(),
    VehicleDocument.find({ expiresAt: { $lte: now } })
      .populate("vehicleId", "vehicleId registrationNumber type")
      .lean()
  ]);
  const expiredItems = expiredDocuments.map((document) => ({
    _id: `expired-${document._id}`,
    maintenanceId: document.documentId,
    vehicleId: document.vehicleId,
    type: `${document.type?.replaceAll("_", " ") || "Vehicle document"} expired`,
    risk: "HIGH",
    status: "OVERDUE",
    serviceDate: document.expiresAt,
    expiresAt: document.expiresAt,
    createdAt: document.expiresAt,
    source: "DOCUMENT_EXPIRY"
  }));
  const rows = [...maintenance, ...expiredItems].sort((a, b) => {
    if (a.source === "DOCUMENT_EXPIRY" && b.source !== "DOCUMENT_EXPIRY") return -1;
    if (b.source === "DOCUMENT_EXPIRY" && a.source !== "DOCUMENT_EXPIRY") return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const data = rows.slice(skip, skip + limit);
  return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, rows.length) });
}
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
  if (req.user.role === "FACULTY_STAFF") {
    const tripIds = await Trip.distinct("_id", { facultyId: req.user._id });
    return listFor(EmergencyAlert, { tripId: { $in: tripIds } })(req, res);
  }
  if (req.user.role === "DEPARTMENT_COORDINATOR") {
    const tripIds = await Trip.distinct("_id", { departmentId: req.user.departmentId });
    return listFor(EmergencyAlert, { tripId: { $in: tripIds } })(req, res);
  }
  return listFor(EmergencyAlert)(req, res);
}

async function notifyTripParticipants(trip, title, message, type = "EMERGENCY", metadata = {}) {
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
    type,
    { tripId: trip._id, ...metadata }
  );
}

async function notifyFleetAdmins(title, message, type, metadata = {}) {
  const admins = await User.find({ isActive: true, role: "TRANSPORT_ADMIN" }).select("_id");
  await notifyMany(admins.map((admin) => admin._id), title, message, type, metadata);
}

async function assertIncidentManager(alert, user) {
  if (user.role === "TRANSPORT_ADMIN") return;
  const trip = await Trip.findById(alert.tripId).select("departmentId");
  if (user.role === "DEPARTMENT_COORDINATOR" && trip && String(trip.departmentId) === String(user.departmentId)) return;
  const error = new Error("You are not authorized to manage this incident.");
  error.status = 403;
  throw error;
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
  const fuelLog = await FuelLog.create({ ...req.body, quantity, odometerReading, fuelLogId: humanId("FUEL"), totalAmount, enteredBy: req.user._id });
  await notifyFleetAdmins("Fuel log recorded", `Fuel log ${fuelLog.fuelLogId} was recorded for a vehicle.`, "FUEL", { fuelLogId: fuelLog._id, vehicleId: fuelLog.vehicleId });
  return ok(res, "Fuel logged", fuelLog, 201);
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

export async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  return ok(res, "All notifications marked as read", { updated: result.modifiedCount });
}

export async function createExpense(req, res) {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("Expense amount must be a non-negative number.");
    error.status = 400;
    throw error;
  }
  const expense = await Expense.create({ ...req.body, amount, expenseId: humanId("EXP"), enteredBy: req.user._id });
  await notifyFleetAdmins("Expense recorded", `Expense ${expense.expenseId} was recorded for the fleet.`, "EXPENSE", { expenseId: expense._id, vehicleId: expense.vehicleId });
  return ok(res, "Expense logged", expense, 201);
}

export async function createMaintenance(req, res) {
  if (!req.body.vehicleId || !req.body.type) {
    const error = new Error("Vehicle and maintenance type are required.");
    error.status = 400;
    throw error;
  }
  const maintenance = await Maintenance.create({ ...req.body, maintenanceId: humanId("MAIN") });
  await notifyFleetAdmins("Maintenance recorded", `Maintenance ${maintenance.maintenanceId} was recorded for a vehicle.`, "MAINTENANCE", { maintenanceId: maintenance._id, vehicleId: maintenance.vehicleId });
  return ok(res, "Maintenance logged", maintenance, 201);
}

export async function raiseEmergency(req, res) {
  const driver = req.user.role === "DRIVER" ? await Driver.findOne({ userId: req.user._id }) : null;
  const trip = await Trip.findById(req.body.tripId);
  if (!trip) { const error = new Error("Trip not found."); error.status = 404; throw error; }
  const allowed = req.user.role === "TRANSPORT_ADMIN"
    || (driver && String(trip.driverId) === String(driver._id))
    || (req.user.role === "FACULTY_STAFF" && String(trip.facultyId) === String(req.user._id));
  if (!allowed) { const error = new Error("You are not authorized to raise an emergency for this trip."); error.status = 403; throw error; }
  if (!["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED", "TRANSFER_OR_VERIFICATION_PENDING"].includes(trip.status)) {
    const error = new Error("Emergency alerts are available only for active or scheduled trips."); error.status = 409; throw error;
  }
  if (req.body.idempotencyKey) {
    const matchingRetry = await EmergencyAlert.findOne({
      idempotencyKey: req.body.idempotencyKey,
      reporterId: req.user._id,
      kind: "EMERGENCY"
    });
    if (matchingRetry) return ok(res, "Emergency already reported", matchingRetry, 200);
  }
  const existing = await EmergencyAlert.findOne({ tripId: trip._id, reporterId: req.user._id, kind: "EMERGENCY", status: { $in: ["OPEN", "ACKNOWLEDGED"] } });
  if (existing) return ok(res, "Emergency already reported", existing, 200);
  const lastKnownLocation = await GpsLog.findOne({ tripId: trip._id }).sort({ timestamp: -1 }).lean();
  const alert = await EmergencyAlert.create({
    alertId: humanId("EMG"),
    kind: "EMERGENCY",
    tripId: trip._id,
    requestId: trip.requestId,
    vehicleId: trip.vehicleId,
    driverId: trip.driverId,
    reporterId: req.user._id,
    reporterRole: req.user.role,
    severity: req.body.severity || "HIGH",
    message: req.body.message,
    location: req.body.location,
    lastKnownLocation,
    idempotencyKey: req.body.idempotencyKey,
    events: [{ action: "CREATED", actorId: req.user._id, note: req.body.message }]
  });
  req.app.get("io")?.to("admin-room").emit("emergency:new", alert);
  req.app.get("io")?.to(`coordinator-room-${trip.departmentId}`).emit("emergency:new", alert);
  await notifyTripParticipants(trip, "Emergency alert", `Emergency reported for trip ${trip.tripId}. Transport operations have been notified.`, "EMERGENCY", { incidentId: alert._id });
  return ok(res, "Emergency alert sent successfully. The Transport Administrator and Department Coordinator have been notified.", alert, 201);
}

export async function acknowledgeEmergency(req, res) {
  const alert = await EmergencyAlert.findById(req.params.id);
  if (!alert) {
    const error = new Error("Emergency alert not found");
    error.status = 404;
    throw error;
  }
  await assertIncidentManager(alert, req.user);
  if (alert.status === "RESOLVED") { const error = new Error("Resolved incidents cannot be acknowledged."); error.status = 409; throw error; }
  alert.status = "ACKNOWLEDGED";
  alert.acknowledgedBy = req.user._id;
  alert.acknowledgedAt = new Date();
  alert.events.push({ action: "ACKNOWLEDGED", actorId: req.user._id, note: req.body.note });
  await alert.save();
  req.app.get("io")?.to("admin-room").emit("emergency:updated", alert);
  const trip = await Trip.findById(alert.tripId).select("departmentId facultyId driverId tripId");
  if (trip) req.app.get("io")?.to(`coordinator-room-${trip.departmentId}`).emit("emergency:updated", alert);
  if (trip) await notifyTripParticipants(trip, "Emergency acknowledged", `Emergency alert for trip ${trip.tripId} has been acknowledged and is being handled.`, "EMERGENCY", { incidentId: alert._id });
  return ok(res, "Emergency acknowledged", alert);
}

export async function silenceEmergency(req, res) {
  const alert = await EmergencyAlert.findById(req.params.id);
  if (!alert) { const error = new Error("Emergency alert not found"); error.status = 404; throw error; }
  await assertIncidentManager(alert, req.user);
  if (!alert.silencedBy.some((entry) => String(entry.userId) === String(req.user._id))) {
    alert.silencedBy.push({ userId: req.user._id });
    alert.events.push({ action: "ALARM_SILENCED", actorId: req.user._id });
    await alert.save();
  }
  return ok(res, "Alarm silenced for your session", alert);
}

export async function resolveEmergency(req, res) {
  const alert = await EmergencyAlert.findById(req.params.id);
  if (!alert) { const error = new Error("Emergency alert not found"); error.status = 404; throw error; }
  await assertIncidentManager(alert, req.user);
  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();
  alert.resolvedBy = req.user._id;
  alert.resolutionNotes = req.body.note;
  alert.events.push({ action: "RESOLVED", actorId: req.user._id, note: req.body.note });
  await alert.save();
  req.app.get("io")?.to("admin-room").emit("emergency:updated", alert);
  const trip = await Trip.findById(alert.tripId).select("departmentId facultyId driverId tripId");
  if (trip) req.app.get("io")?.to(`coordinator-room-${trip.departmentId}`).emit("emergency:updated", alert);
  if (trip) await notifyTripParticipants(trip, "Emergency resolved", `Emergency alert for trip ${trip.tripId} has been resolved.`, "EMERGENCY", { incidentId: alert._id });
  return ok(res, "Emergency resolved", alert);
}

export async function breakdown(req, res) {
  if (!req.body.tripId) { const error = new Error("Trip is required for a breakdown report."); error.status = 400; throw error; }
  const trip = await Trip.findById(req.body.tripId);
  if (!trip) { const error = new Error("Trip not found."); error.status = 404; throw error; }
  if (req.user.role === "DRIVER") {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver || String(trip.driverId) !== String(driver._id)) {
      const error = new Error("Drivers can only report breakdowns for their assigned vehicle and trip.");
      error.status = 403;
      throw error;
    }
  }
  const existing = await EmergencyAlert.findOne({ tripId: trip._id, kind: "BREAKDOWN", status: { $in: ["OPEN", "ACKNOWLEDGED"] } });
  if (existing) return ok(res, "Breakdown is already being handled", existing, 200);
  const transitioned = await Trip.findOneAndUpdate(
    { _id: trip._id, vehicleId: trip.vehicleId, status: { $in: ["SCHEDULED", "TRIP_STARTED", "TRIP_RESUMED"] } },
    { status: "REPLACEMENT_SEARCHING", replacementStatus: "SEARCHING" },
    { new: true }
  );
  if (!transitioned) { const error = new Error("Trip is not eligible for breakdown reallocation."); error.status = 409; throw error; }
  const lastKnownLocation = await GpsLog.findOne({ tripId: trip._id }).sort({ timestamp: -1 }).lean();
  const alert = await EmergencyAlert.create({
    alertId: humanId("BRK"), kind: "BREAKDOWN", tripId: trip._id, requestId: trip.requestId, vehicleId: trip.vehicleId, driverId: trip.driverId,
    reporterId: req.user._id, reporterRole: req.user.role, severity: req.body.severity || "HIGH", message: req.body.message || "Vehicle breakdown reported",
    location: req.body.location, lastKnownLocation, events: [{ action: "BREAKDOWN_REPORTED", actorId: req.user._id, note: req.body.message }]
  });
  await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: "BREAKDOWN_REPORTED" });
  await Driver.findByIdAndUpdate(trip.driverId, { status: "AVAILABLE" });
  const request = await VehicleRequest.findById(trip.requestId);
  const alternatives = request ? await runSmartAllocation(request, { excludeVehicleIds: [trip.vehicleId] }) : [];
  let replacement = null;
  if (alternatives[0]) {
    try { replacement = await reassignTrip({ tripId: trip._id, allocation: alternatives[0], actor: req.user }); }
    catch (error) { if (error.status !== 409) throw error; }
  }
  if (!replacement) {
    await Trip.findByIdAndUpdate(trip._id, { status: "REPLACEMENT_UNAVAILABLE", replacementStatus: "UNAVAILABLE" });
    alert.events.push({ action: "REPLACEMENT_UNAVAILABLE", actorId: req.user._id, note: "No eligible replacement could be reserved." });
    await alert.save();
  }
  await notifyTripParticipants(trip, "Breakdown reported", replacement ? `A breakdown was reported for trip ${trip.tripId}; a replacement assignment is ready.` : `A breakdown was reported for trip ${trip.tripId}; no replacement is currently available.`, "EMERGENCY", { incidentId: alert._id });
  req.app.get("io")?.to("admin-room").emit("trip:reallocated", { alert, replacement, alternatives });
  req.app.get("io")?.to(`coordinator-room-${trip.departmentId}`).emit("trip:reallocated", { alert, replacement, alternatives });
  return ok(res, replacement ? "Breakdown reported and replacement assigned" : "Breakdown reported; no replacement is currently available", { alert, replacement, alternatives }, 201);
}
