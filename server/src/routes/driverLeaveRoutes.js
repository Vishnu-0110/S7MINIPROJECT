import { Router } from "express";
import { createDriverLeave, decideDriverLeave, listDriverLeaves } from "../controllers/driverLeaveController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/apiResponse.js";
import { validate } from "../middleware/validate.js";
import { driverLeaveCreateSchema, driverLeaveDecisionSchema } from "../validators/driverLeaveValidators.js";

export const driverLeaveRoutes = Router();
driverLeaveRoutes.use(requireAuth);
driverLeaveRoutes.get("/", requireRoles("DRIVER", "TRANSPORT_ADMIN"), asyncHandler(listDriverLeaves));
driverLeaveRoutes.post("/", requireRoles("DRIVER"), validate(driverLeaveCreateSchema), asyncHandler(createDriverLeave));
driverLeaveRoutes.patch("/:id", requireRoles("TRANSPORT_ADMIN"), validate(driverLeaveDecisionSchema), asyncHandler(decideDriverLeave));
