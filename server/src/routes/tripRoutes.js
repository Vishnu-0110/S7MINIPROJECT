import { Router } from "express";
import {
  activeTripSummary,
  cancelTripAction,
  completeTripAction,
  completionOtp,
  endTripAction,
  getTrip,
  gpsAction,
  listTrips,
  startTripAction,
  tripOtp,
  verifyTripOtp
} from "../controllers/tripController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { endTripSchema, gpsSchema, otpVerifySchema, startTripSchema, tripCompletionSchema } from "../validators/tripValidators.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const tripRoutes = Router();
tripRoutes.use(requireAuth);

tripRoutes.get("/", asyncHandler(listTrips));
tripRoutes.get("/summary", requireRoles("TRANSPORT_ADMIN"), asyncHandler(activeTripSummary));
tripRoutes.get("/:id", asyncHandler(getTrip));
tripRoutes.get("/:id/otp", asyncHandler(tripOtp));
tripRoutes.post("/:id/otp/verify", requireRoles("DRIVER"), validate(otpVerifySchema), asyncHandler(verifyTripOtp));
tripRoutes.post("/:id/start", requireRoles("DRIVER"), validate(startTripSchema), asyncHandler(startTripAction));
tripRoutes.post("/:id/end", requireRoles("DRIVER"), validate(endTripSchema), asyncHandler(endTripAction));
tripRoutes.post("/:id/cancel", requireRoles("TRANSPORT_ADMIN"), asyncHandler(cancelTripAction));
tripRoutes.get("/:id/completion-otp", requireRoles("DRIVER"), asyncHandler(completionOtp));
tripRoutes.post("/:id/complete", requireRoles("FACULTY_STAFF"), validate(tripCompletionSchema), asyncHandler(completeTripAction));
tripRoutes.post("/:id/gps", requireRoles("DRIVER"), validate(gpsSchema), asyncHandler(gpsAction));
