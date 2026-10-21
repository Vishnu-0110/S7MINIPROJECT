import { Router } from "express";
import { analytics } from "../controllers/analyticsController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const analyticsRoutes = Router();

analyticsRoutes.get("/", requireAuth, requireRoles("TRANSPORT_ADMIN", "DEPARTMENT_COORDINATOR"), asyncHandler(analytics));
