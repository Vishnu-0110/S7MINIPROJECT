import { Router } from "express";
import {
  allocationsForRequest,
  approveRequest,
  cancelRequest,
  createRequest,
  getRequest,
  listRequests,
  updateRequest,
  rejectRequest
} from "../controllers/requestController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { approveSchema, rejectSchema, requestCreateSchema, requestUpdateSchema } from "../validators/requestValidators.js";
import { assignSchema } from "../validators/tripValidators.js";
import { assignTrip } from "../controllers/tripController.js";
import { asyncHandler } from "../utils/apiResponse.js";

export const requestRoutes = Router();
requestRoutes.use(requireAuth);

requestRoutes.get("/", asyncHandler(listRequests));
requestRoutes.post("/", requireRoles("FACULTY_STAFF", "SUPER_ADMIN"), upload.single("supportingDocument"), validate(requestCreateSchema), asyncHandler(createRequest));
requestRoutes.get("/:id", asyncHandler(getRequest));
requestRoutes.patch("/:id", requireRoles("FACULTY_STAFF"), validate(requestUpdateSchema), asyncHandler(updateRequest));
requestRoutes.post("/:id/approve", requireRoles("DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"), validate(approveSchema), asyncHandler(approveRequest));
requestRoutes.post("/:id/reject", requireRoles("DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"), validate(rejectSchema), asyncHandler(rejectRequest));
requestRoutes.post("/:id/cancel", asyncHandler(cancelRequest));
requestRoutes.post("/:id/allocations", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), asyncHandler(allocationsForRequest));
requestRoutes.post("/:requestId/assign", requireRoles("TRANSPORT_ADMIN", "SUPER_ADMIN"), validate(assignSchema), asyncHandler(assignTrip));
