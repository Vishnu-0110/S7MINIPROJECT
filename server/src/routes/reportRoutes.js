import { Router } from "express";
import { tripsCsv } from "../controllers/reportController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const reportRoutes = Router();

reportRoutes.get("/trips.csv", requireAuth, requireRoles("TRANSPORT_ADMIN"), asyncHandler(tripsCsv));
