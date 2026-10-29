import { Router } from "express";
import {
  activeTripSummary,
  completeTripAction,
  completionQr,
  endTripAction,
  getTrip,
  gpsAction,
  listTrips,
  startTripAction,
  tripQr,
  verifyTripQr
} from "../controllers/tripController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { endTripSchema, gpsSchema, qrVerifySchema, startTripSchema, tripCompletionSchema } from "../validators/tripValidators.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const tripRoutes = Router();
tripRoutes.use(requireAuth);

tripRoutes.get("/", asyncHandler(listTrips));
tripRoutes.get("/summary", requireRoles("TRANSPORT_ADMIN"), asyncHandler(activeTripSummary));
tripRoutes.get("/:id", asyncHandler(getTrip));
tripRoutes.get("/:id/qr", asyncHandler(tripQr));
tripRoutes.post("/:id/qr/verify", requireRoles("DRIVER"), validate(qrVerifySchema), asyncHandler(verifyTripQr));
tripRoutes.post("/:id/start", requireRoles("DRIVER"), validate(startTripSchema), asyncHandler(startTripAction));
tripRoutes.post("/:id/end", requireRoles("DRIVER"), validate(endTripSchema), asyncHandler(endTripAction));
tripRoutes.get("/:id/completion-qr", requireRoles("DRIVER"), asyncHandler(completionQr));
tripRoutes.post("/:id/complete", requireRoles("FACULTY_STAFF"), validate(tripCompletionSchema), asyncHandler(completeTripAction));
tripRoutes.post("/:id/gps", requireRoles("DRIVER"), validate(gpsSchema), asyncHandler(gpsAction));
