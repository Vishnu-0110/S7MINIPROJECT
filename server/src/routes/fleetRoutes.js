import { Router } from "express";
import {
  Department,
  Driver,
  EmergencyAlert,
  Trip,
  User,
  Vehicle,
  VehicleDocument
} from "../models/index.js";
import { createCrudController } from "../controllers/genericController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { driverSchema, vehicleSchema } from "../validators/fleetValidators.js";
import { asyncHandler, ApiError, ok } from "../utils/apiResponse.js";
import { humanId } from "../utils/id.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { notifyMany } from "../services/notificationService.js";
import { ensureRoutineServiceSchedule } from "../services/maintenanceService.js";

export const fleetRoutes = Router();
fleetRoutes.use(requireAuth);

const vehicles = createCrudController(Vehicle, ["vehicleId", "registrationNumber", "name", "type"]);
const drivers = createCrudController(Driver, ["driverId", "licenseNumber"]);
const departments = createCrudController(Department, ["code", "name"]);
const users = createCrudController(User, ["name", "email", "role"]);
const vehicleDocumentTypes = ["RC", "INSURANCE", "FC", "POLLUTION_CERTIFICATE"];
const defaultDriverPassword = "SmartFleet@123";

async function notifyFleetAdmins(title, message, type, metadata = {}) {
  const admins = await User.find({ isActive: true, role: "TRANSPORT_ADMIN" }).select("_id");
  await notifyMany(admins.map((admin) => admin._id), title, message, type, metadata);
}

const departmentNames = {
  CSE: "Computer Science and Engineering",
  ECE: "Electronics and Communication Engineering",
  EEE: "Electrical and Electronics Engineering",
  CSD: "Computer Science and Design",
  AIDS: "Artificial Intelligence and Data Science",
  AIML: "Artificial Intelligence and Machine Learning",
  ISE: "Information Science and Engineering"
};

async function createUser(req, res) {
  const { department, licenseNumber, ...userFields } = req.body;
  if (department && !departmentNames[department]) throw new ApiError("Choose a valid department", 400);
  if (userFields.role === "DRIVER" && !licenseNumber) throw new ApiError("A licence number is required for a driver account", 400);

  if (department) {
    const departmentDoc = await Department.findOneAndUpdate(
      { code: department },
      { $setOnInsert: { code: department, name: departmentNames[department], isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    userFields.departmentId = departmentDoc._id;
  }
  if (!userFields.departmentId && ["FACULTY_STAFF", "DEPARTMENT_COORDINATOR"].includes(userFields.role)) {
    const defaultDepartment = await Department.findOneAndUpdate(
      { code: "CSE" },
      { $setOnInsert: { code: "CSE", name: departmentNames.CSE, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    userFields.departmentId = defaultDepartment._id;
  }

  const user = await User.create(userFields);
  if (user.role === "DEPARTMENT_COORDINATOR" && user.departmentId) {
    await Department.findByIdAndUpdate(user.departmentId, { coordinatorId: user._id });
  }
  if (user.role === "DRIVER") {
    await Driver.create({
      driverId: humanId("DRV"),
      userId: user._id,
      licenseNumber,
      phone: user.phone,
      status: "AVAILABLE"
    });
  }
  await notifyFleetAdmins("User created", `${user.name} was added as ${user.role.replaceAll("_", " ")}.`, "USER", { userId: user._id });
  return ok(res, "Created", user, 201);
}

async function createVehicle(req, res) {
  const vehicle = await Vehicle.create({
    ...req.body,
    name: req.body.name || `${req.body.type} ${req.body.registrationNumber}`,
    vehicleId: humanId("VEH"),
    nextServiceKM: req.body.nextServiceKM || Number(req.body.currentKM || 0) + 6000
  });
  await ensureRoutineServiceSchedule(vehicle);
  await notifyFleetAdmins("Vehicle added", `Vehicle ${vehicle.vehicleId} (${vehicle.registrationNumber}) was added to the fleet.`, "VEHICLE", { vehicleId: vehicle._id });
  return ok(res, "Created", vehicle, 201);
}

function emailFromDriverName(name) {
  const localPart = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  if (!localPart) throw new ApiError("Enter a valid driver name", 400);
  return `${localPart}@bit.edu.in`;
}

async function listDrivers(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const [data, total] = await Promise.all([
    Driver.find().populate("userId", "name email phone address").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Driver.countDocuments()
  ]);
  return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
}

async function driverHistory(req, res) {
  const driver = await Driver.findById(req.params.id).populate("userId", "name email phone address");
  if (!driver) throw new ApiError("Driver not found", 404);
  const [trips, alerts] = await Promise.all([
    Trip.find({ driverId: driver._id }).populate("requestId", "requestId").populate("vehicleId", "vehicleId registrationNumber type").populate("facultyId", "name email").sort({ scheduledStartTime: -1 }),
    EmergencyAlert.find({ driverId: driver._id }).sort({ createdAt: -1 })
  ]);
  return ok(res, "Driver history", { driver, trips, alerts });
}

async function vehicleHistory(req, res) {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError("Vehicle not found", 404);
  const [trips, alerts] = await Promise.all([
    Trip.find({ vehicleId: vehicle._id }).populate("requestId", "requestId").populate({ path: "driverId", populate: { path: "userId", select: "name" } }).populate("facultyId", "name").sort({ scheduledStartTime: -1 }),
    EmergencyAlert.find({ vehicleId: vehicle._id }).sort({ createdAt: -1 })
  ]);
  return ok(res, "Vehicle history", { vehicle, trips, alerts });
}

async function createDriver(req, res) {
  const { name, licenseNumber, phone, address } = req.body;
  const email = emailFromDriverName(name);

  const [existingUser, existingDriver] = await Promise.all([
    User.exists({ email }),
    Driver.exists({ licenseNumber })
  ]);
  if (existingUser) throw new ApiError(`A user already exists with the email ${email}`, 409);
  if (existingDriver) throw new ApiError("A driver already exists with this licence number", 409);

  const user = await User.create({
    name,
    email,
    password: defaultDriverPassword,
    role: "DRIVER",
    phone,
    address,
    isActive: true
  });
  const driver = await Driver.create({
    driverId: humanId("DRV"),
    userId: user._id,
    licenseNumber,
    phone,
    status: "AVAILABLE"
  });
  await notifyFleetAdmins("Driver added", `${name} was added as a driver.`, "USER", { userId: user._id, driverId: driver._id });
  return ok(res, "Created", { driver, credentials: { email, password: defaultDriverPassword } }, 201);
}

async function createVehicleDocument(req, res) {
  const { vehicleNumber, vehicleType, type, expiresAt } = req.body;
  if (!vehicleNumber?.trim() || !vehicleType || !vehicleDocumentTypes.includes(type) || !expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    throw new ApiError("Choose a document type and vehicle type, enter a vehicle number, and provide a valid expiry date", 400);
  }
  const vehicle = await Vehicle.findOne({
    registrationNumber: vehicleNumber.trim(),
    type: vehicleType
  });
  if (!vehicle) throw new ApiError("No vehicle matches that number and vehicle type", 404);
  const document = await VehicleDocument.create({
    documentId: humanId("DOC"),
    vehicleId: vehicle._id,
    vehicleType: vehicle.type,
    type,
    expiresAt: new Date(expiresAt)
  });
  vehicle.documents.addToSet(document._id);
  await vehicle.save();
  await notifyFleetAdmins("Vehicle document added", `${type.replaceAll("_", " ")} was added for vehicle ${vehicle.registrationNumber}.`, "DOCUMENT", { documentId: document._id, vehicleId: vehicle._id });
  return ok(res, "Created", document, 201);
}

async function listVehicleDocuments(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const [data, total] = await Promise.all([
    VehicleDocument.find().populate("vehicleId", "vehicleId registrationNumber type").sort({ createdAt: -1 }).skip(skip).limit(limit),
    VehicleDocument.countDocuments()
  ]);
  return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
}

fleetRoutes.get("/vehicles", asyncHandler(vehicles.list));
fleetRoutes.post("/vehicles", requireRoles("TRANSPORT_ADMIN"), validate(vehicleSchema), asyncHandler(createVehicle));
fleetRoutes.get("/vehicles/:id/history", requireRoles("TRANSPORT_ADMIN"), asyncHandler(vehicleHistory));
fleetRoutes.get("/vehicles/:id", asyncHandler(vehicles.get));
fleetRoutes.patch("/vehicles/:id", requireRoles("TRANSPORT_ADMIN"), asyncHandler(vehicles.update));

fleetRoutes.get("/drivers", asyncHandler(listDrivers));
fleetRoutes.post("/drivers", requireRoles("TRANSPORT_ADMIN"), validate(driverSchema), asyncHandler(createDriver));
fleetRoutes.get("/drivers/:id/history", requireRoles("TRANSPORT_ADMIN"), asyncHandler(driverHistory));
fleetRoutes.get("/drivers/:id", asyncHandler(drivers.get));
fleetRoutes.patch("/drivers/:id", requireRoles("TRANSPORT_ADMIN"), asyncHandler(drivers.update));

fleetRoutes.get("/departments", asyncHandler(departments.list));
fleetRoutes.post("/departments", requireRoles("TRANSPORT_ADMIN"), asyncHandler(departments.create));
fleetRoutes.patch("/departments/:id", requireRoles("TRANSPORT_ADMIN"), asyncHandler(departments.update));

fleetRoutes.get("/users", requireRoles("TRANSPORT_ADMIN"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.role) query.role = req.query.role;
  const [data, total] = await Promise.all([
    User.find(query).populate("departmentId", "code name").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query)
  ]);
  return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
}));
fleetRoutes.post("/users", requireRoles("TRANSPORT_ADMIN"), asyncHandler(createUser));
fleetRoutes.patch("/users/:id", requireRoles("TRANSPORT_ADMIN"), asyncHandler(users.update));

fleetRoutes.get("/vehicle-documents", asyncHandler(listVehicleDocuments));
fleetRoutes.post("/vehicle-documents", requireRoles("TRANSPORT_ADMIN"), asyncHandler(createVehicleDocument));
