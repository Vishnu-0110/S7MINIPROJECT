import { Router } from "express";
import {
  breakdown,
  acknowledgeEmergency,
  createExpense,
  createFuel,
  createMaintenance,
  listEmergencies,
  listExpenses,
  listFuel,
  listGps,
  listMaintenance,
  markNotificationRead,
  markAllNotificationsRead,
  listNotifications,
  raiseEmergency,
  resolveEmergency,
  silenceEmergency,
  smartAllocateBreakdown
} from "../controllers/operationsController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";
import { validate } from "../middleware/validate.js";
import { breakdownSchema, emergencySchema, incidentNoteSchema } from "../validators/operationsValidators.js";

export const operationRoutes = Router();
operationRoutes.use(requireAuth);

operationRoutes.get("/maintenance", requireRoles("TRANSPORT_ADMIN"), asyncHandler(listMaintenance));
operationRoutes.post("/maintenance", requireRoles("TRANSPORT_ADMIN"), asyncHandler(createMaintenance));
operationRoutes.get("/fuel", requireRoles("DRIVER", "TRANSPORT_ADMIN"), asyncHandler(listFuel));
operationRoutes.post("/fuel", requireRoles("DRIVER", "TRANSPORT_ADMIN"), asyncHandler(createFuel));
operationRoutes.get("/expenses", requireRoles("TRANSPORT_ADMIN"), asyncHandler(listExpenses));
operationRoutes.post("/expenses", requireRoles("TRANSPORT_ADMIN"), asyncHandler(createExpense));
operationRoutes.get("/notifications", asyncHandler(listNotifications));
operationRoutes.patch("/notifications/:id/read", asyncHandler(markNotificationRead));
operationRoutes.patch("/notifications/read-all", asyncHandler(markAllNotificationsRead));
operationRoutes.get("/gps", requireRoles("FACULTY_STAFF", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"), asyncHandler(listGps));
operationRoutes.get("/emergencies", requireRoles("FACULTY_STAFF", "DRIVER", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"), asyncHandler(listEmergencies));
operationRoutes.post("/emergencies", requireRoles("FACULTY_STAFF", "DRIVER", "TRANSPORT_ADMIN"), validate(emergencySchema), asyncHandler(raiseEmergency));
operationRoutes.post("/emergencies/:id/acknowledge", requireRoles("DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"), validate(incidentNoteSchema), asyncHandler(acknowledgeEmergency));
operationRoutes.post("/emergencies/:id/silence", requireRoles("DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"), asyncHandler(silenceEmergency));
operationRoutes.patch("/emergencies/:id", requireRoles("DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"), validate(incidentNoteSchema), asyncHandler(resolveEmergency));
operationRoutes.post("/breakdowns", requireRoles("FACULTY_STAFF", "DRIVER", "TRANSPORT_ADMIN"), validate(breakdownSchema), asyncHandler(breakdown));
operationRoutes.post("/emergencies/:id/smart-allocate", requireRoles("TRANSPORT_ADMIN"), asyncHandler(smartAllocateBreakdown));
