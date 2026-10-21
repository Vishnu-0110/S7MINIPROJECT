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
import { asyncHandler } from "../utils/apiResponse.js";

export const fleetRoutes = Router();
fleetRoutes.use(requireAuth);

const vehicles = createCrudController(Vehicle, ["vehicleId", "registrationNumber", "name", "type"]);
const drivers = createCrudController(Driver, ["driverId", "licenseNumber"]);
const departments = createCrudController(Department, ["code", "name"]);
const users = createCrudController(User, ["name", "email", "role"]);
const docs = createCrudController(VehicleDocument, ["documentId", "type", "number"]);

fleetRoutes.get("/vehicles", asyncHandler(vehicles.list));
fleetRoutes.post("/vehicles", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), validate(vehicleSchema), asyncHandler(vehicles.create));
fleetRoutes.get("/vehicles/:id", asyncHandler(vehicles.get));
fleetRoutes.patch("/vehicles/:id", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(vehicles.update));

fleetRoutes.get("/drivers", asyncHandler(drivers.list));
fleetRoutes.post("/drivers", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), validate(driverSchema), asyncHandler(drivers.create));
fleetRoutes.get("/drivers/:id", asyncHandler(drivers.get));
fleetRoutes.patch("/drivers/:id", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(drivers.update));

fleetRoutes.get("/departments", asyncHandler(departments.list));
fleetRoutes.post("/departments", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(departments.create));
fleetRoutes.patch("/departments/:id", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(departments.update));

fleetRoutes.get("/users", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(users.list));
fleetRoutes.post("/users", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(users.create));
fleetRoutes.patch("/users/:id", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(users.update));

fleetRoutes.get("/vehicle-documents", asyncHandler(docs.list));
fleetRoutes.post("/vehicle-documents", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(docs.create));
