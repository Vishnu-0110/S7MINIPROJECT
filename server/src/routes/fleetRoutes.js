import { Router } from "express";
import {
  Department,
  Driver,
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

export const fleetRoutes = Router();
fleetRoutes.use(requireAuth);

const vehicles = createCrudController(Vehicle, ["vehicleId", "registrationNumber", "name", "type"]);
const drivers = createCrudController(Driver, ["driverId", "licenseNumber"]);
const departments = createCrudController(Department, ["code", "name"]);
const users = createCrudController(User, ["name", "email", "role"]);
const vehicleDocumentTypes = ["RC", "INSURANCE", "FC", "POLLUTION_CERTIFICATE"];

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

  const user = await User.create(userFields);
  if (user.role === "DRIVER") {
    await Driver.create({
      driverId: humanId("DRV"),
      userId: user._id,
      licenseNumber,
      phone: user.phone,
      status: "AVAILABLE"
    });
  }
  return ok(res, "Created", user, 201);
}

async function createVehicleDocument(req, res) {
  const { vehicleId, type, expiresAt } = req.body;
  if (!vehicleId || !vehicleDocumentTypes.includes(type) || !expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    throw new ApiError("Choose a document type, vehicle, and valid expiry date", 400);
  }
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError("Vehicle not found", 404);
  const document = await VehicleDocument.create({
    documentId: humanId("DOC"),
    vehicleId: vehicle._id,
    vehicleType: vehicle.type,
    type,
    expiresAt: new Date(expiresAt)
  });
  vehicle.documents.addToSet(document._id);
  await vehicle.save();
  return ok(res, "Created", document, 201);
}

async function listVehicleDocuments(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const [data, total] = await Promise.all([
    VehicleDocument.find().populate("vehicleId", "vehicleId registrationNumber type").sort({ expiresAt: 1 }).skip(skip).limit(limit),
    VehicleDocument.countDocuments()
  ]);
  return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
}

fleetRoutes.get("/vehicles", asyncHandler(vehicles.list));
fleetRoutes.post("/vehicles", requireRoles("TRANSPORT_ADMIN"), validate(vehicleSchema), asyncHandler(vehicles.create));
fleetRoutes.get("/vehicles/:id", asyncHandler(vehicles.get));
fleetRoutes.patch("/vehicles/:id", requireRoles("TRANSPORT_ADMIN"), asyncHandler(vehicles.update));

fleetRoutes.get("/drivers", asyncHandler(drivers.list));
fleetRoutes.post("/drivers", requireRoles("TRANSPORT_ADMIN"), validate(driverSchema), asyncHandler(drivers.create));
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
