import { Router } from "express";
import { tripCosts, tripsCsv } from "../controllers/reportController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const reportRoutes = Router();

reportRoutes.get("/trips.csv", requireAuth, requireRoles("TRANSPORT_ADMIN"), asyncHandler(tripsCsv));
reportRoutes.get("/trip-costs", requireAuth, requireRoles("TRANSPORT_ADMIN"), asyncHandler(tripCosts));
