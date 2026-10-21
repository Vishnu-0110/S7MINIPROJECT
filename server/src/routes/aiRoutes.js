import { Router } from "express";
import { askAi, parseTrip } from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth);
aiRoutes.post("/parse-trip", asyncHandler(parseTrip));
aiRoutes.post("/ask", asyncHandler(askAi));
