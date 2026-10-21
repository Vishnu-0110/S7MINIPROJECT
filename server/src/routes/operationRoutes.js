import { Router } from "express";
import {
  breakdown,
  createExpense,
  createFuel,
  createMaintenance,
  listEmergencies,
  listExpenses,
  listFuel,
  listGps,
  listMaintenance,
  markNotificationRead,
  listNotifications,
  raiseEmergency,
  resolveEmergency
} from "../controllers/operationsController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const operationRoutes = Router();
operationRoutes.use(requireAuth);

operationRoutes.get("/maintenance", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(listMaintenance));
operationRoutes.post("/maintenance", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(createMaintenance));
operationRoutes.get("/fuel", requireRoles("DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(listFuel));
operationRoutes.post("/fuel", requireRoles("DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(createFuel));
operationRoutes.get("/expenses", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(listExpenses));
operationRoutes.post("/expenses", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(createExpense));
operationRoutes.get("/notifications", asyncHandler(listNotifications));
operationRoutes.patch("/notifications/:id/read", asyncHandler(markNotificationRead));
operationRoutes.get("/gps", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(listGps));
operationRoutes.get("/emergencies", requireRoles("DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(listEmergencies));
operationRoutes.post("/emergencies", requireRoles("DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(raiseEmergency));
operationRoutes.patch("/emergencies/:id", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(resolveEmergency));
operationRoutes.post("/breakdowns", requireRoles("DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(breakdown));
