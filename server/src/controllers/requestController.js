import { Approval, VehicleRequest } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { humanId } from "../utils/id.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { createApprovalsForRequest, decideApproval } from "../services/approvalService.js";
import { runSmartAllocation } from "../services/allocationService.js";
import { audit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";

export async function createRequest(req, res) {
  const payload = req.body;
  const request = await VehicleRequest.create({
    ...payload,
    requestId: humanId("REQ"),
    facultyId: req.user._id,
    departmentId: req.user.departmentId || payload.departmentId,
    supportingDocument: req.file?.path,
    status: "PENDING_APPROVAL",
    history: [{ status: "PENDING_APPROVAL", actorId: req.user._id, note: "Request submitted" }]
  });
  await createApprovalsForRequest(request);
  await audit(req.user._id, "REQUEST_CREATED", "VehicleRequest", request._id);
  return ok(res, "Request submitted", request, 201);
}

export async function listRequests(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.user.role === "FACULTY_STAFF") query.facultyId = req.user._id;
  if (req.user.role === "DEPARTMENT_COORDINATOR") query.departmentId = req.user.departmentId;
  for (const field of ["status", "departmentId", "priority", "tripType"]) {
    if (req.query[field]) query[field] = req.query[field];
  }
  if (req.query.actionable === "true" && ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
    const pendingApprovals = await Approval.find({ status: "PENDING" }).sort({ requestId: 1, level: 1 }).select("requestId approverRole level").lean();
    const approvalRequestIds = pendingApprovals.reduce((ids, approval) => {
      const key = String(approval.requestId);
      if (!ids.seen.has(key)) {
        ids.seen.add(key);
        if (approval.approverRole === req.user.role) ids.values.push(approval.requestId);
      }
      return ids;
    }, { seen: new Set(), values: [] }).values;
    query._id = { $in: approvalRequestIds };
  }
  const [data, total] = await Promise.all([
    VehicleRequest.find(query).populate("facultyId", "name email").populate("departmentId", "name code").sort({ createdAt: -1 }).skip(skip).limit(limit),
    VehicleRequest.countDocuments(query)
  ]);
  return ok(res, "Requests", data, 200, { pagination: paginationPayload(page, limit, total) });
}

export async function getRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id)
    .populate("facultyId", "name email")
    .populate("departmentId", "name code");
  if (!request) throw new ApiError("Request not found", 404);
  const sameUser = String(request.facultyId?._id || request.facultyId) === String(req.user._id);
  const sameDepartment = String(request.departmentId?._id || request.departmentId) === String(req.user.departmentId);
  const privileged = ["TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(req.user.role);
  if (!sameUser && !(req.user.role === "DEPARTMENT_COORDINATOR" && sameDepartment) && !privileged) {
    throw new ApiError("Forbidden", 403);
  }
  const approvals = await Approval.find({ requestId: req.params.id }).sort({ level: 1 }).populate("approverId", "name email role");
  return ok(res, "Request details", { request, approvals });
}

export async function approveRequest(req, res) {
  return ok(res, "Approved", await decideApproval({ requestId: req.params.id, actor: req.user, status: "APPROVED", comments: req.body.comments }));
}

export async function rejectRequest(req, res) {
  return ok(res, "Rejected", await decideApproval({ requestId: req.params.id, actor: req.user, status: "REJECTED", comments: req.body.comments }));
}

export async function cancelRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id);
  if (!request) throw new ApiError("Request not found", 404);
  if (String(request.facultyId) !== String(req.user._id) && !["TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(req.user.role)) throw new ApiError("Forbidden", 403);
  if (!["PENDING_APPROVAL", "APPROVED"].includes(request.status)) throw new ApiError("This request cannot be cancelled", 400);
  request.status = "CANCELLED";
  request.history.push({ status: "CANCELLED", actorId: req.user._id, note: "Cancelled" });
  await request.save();
  await audit(req.user._id, "REQUEST_CANCELLED", "VehicleRequest", request._id);
  await notify(request.facultyId, "Request cancelled", `Your request ${request.requestId} has been cancelled.`, "REQUEST", { requestId: request._id });
  return ok(res, "Cancelled", request);
}

export async function allocationsForRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id);
  if (!request) throw new ApiError("Request not found", 404);
  if (request.status !== "APPROVED") throw new ApiError("Request must be approved before allocation", 400);
  return ok(res, "Smart allocation complete", await runSmartAllocation(request));
}
