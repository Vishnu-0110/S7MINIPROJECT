import { Approval, VehicleRequest } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { humanId } from "../utils/id.js";
import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { createApprovalsForRequest, decideApproval, notifyApprovalParticipants } from "../services/approvalService.js";
import { runSmartAllocation } from "../services/allocationService.js";
import { scheduleApprovedRequest } from "../services/tripService.js";
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
  await notifyApprovalParticipants(request);
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
  if (req.query.actionable === "true" && ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"].includes(req.user.role)) {
    const approvalRole = req.user.role;
    const approvalRequestIds = await Approval.distinct("requestId", { status: "PENDING", approverRole: approvalRole });
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
  const privileged = req.user.role === "TRANSPORT_ADMIN";
  if (!sameUser && !(req.user.role === "DEPARTMENT_COORDINATOR" && sameDepartment) && !privileged) {
    throw new ApiError("Forbidden", 403);
  }
  const approvals = await Approval.find({ requestId: req.params.id }).sort({ level: 1 }).populate("approverId", "name email role");
  return ok(res, "Request details", { request, approvals });
}

export async function approveRequest(req, res) {
  const request = await decideApproval({ requestId: req.params.id, actor: req.user, status: "APPROVED", comments: req.body.comments });
  const allocation = request.status === "APPROVED_AWAITING_VEHICLE"
    ? await scheduleApprovedRequest({ requestId: request._id, actor: req.user })
    : null;
  return ok(res, allocation?.trip ? "Approved and trip scheduled" : "Approved", allocation?.trip || allocation?.request || request);
}

export async function rejectRequest(req, res) {
  return ok(res, "Rejected", await decideApproval({ requestId: req.params.id, actor: req.user, status: "REJECTED", comments: req.body.comments }));
}

export async function cancelRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id);
  if (!request) throw new ApiError("Request not found", 404);
  if (String(request.facultyId) !== String(req.user._id) && req.user.role !== "TRANSPORT_ADMIN") throw new ApiError("Forbidden", 403);
  if (!["PENDING_APPROVAL", "APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(request.status)) throw new ApiError("This request cannot be cancelled", 400);
  request.status = "CANCELLED";
  request.history.push({ status: "CANCELLED", actorId: req.user._id, note: "Cancelled" });
  await request.save();
  await audit(req.user._id, "REQUEST_CANCELLED", "VehicleRequest", request._id);
  await notify(request.facultyId, "Request cancelled", `Your request ${request.requestId} has been cancelled.`, "REQUEST", { requestId: request._id });
  return ok(res, "Cancelled", request);
}

const materialFields = ["tripType", "purpose", "source", "destination", "waypoints", "passengerCount", "passengers", "date", "departureTime", "returnTime", "priority", "specialRequirements", "requiredFacilities", "notes"];

export async function updateRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id);
  if (!request) throw new ApiError("Request not found", 404);
  if (String(request.facultyId) !== String(req.user._id)) throw new ApiError("Only the requesting faculty member can edit this request.", 403);
  if (!["PENDING_APPROVAL", "APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(request.status)) {
    throw new ApiError("This request can no longer be edited.", 409);
  }
  const changed = materialFields.some((field) => req.body[field] !== undefined && JSON.stringify(request[field]) !== JSON.stringify(req.body[field]));
  for (const field of materialFields) if (req.body[field] !== undefined) request[field] = req.body[field];
  if (changed) {
    await Approval.updateMany(
      { requestId: request._id, version: request.approvalVersion, status: { $in: ["PENDING", "APPROVED"] } },
      { status: "INVALIDATED" }
    );
    request.approvalVersion += 1;
    request.approvalLevel = 1;
    request.status = "PENDING_APPROVAL";
    request.history.push({ status: "PENDING_APPROVAL", actorId: req.user._id, note: "Material request details changed; approvals reset." });
    await request.save();
    await createApprovalsForRequest(request);
    await notifyApprovalParticipants(request);
  } else {
    await request.save();
  }
  await audit(req.user._id, "REQUEST_UPDATED", "VehicleRequest", request._id, null, { approvalVersion: request.approvalVersion, approvalsReset: changed });
  return ok(res, changed ? "Request updated; approvals reset" : "Request updated", request);
}

export async function allocationsForRequest(req, res) {
  const request = await VehicleRequest.findById(req.params.id);
  if (!request) throw new ApiError("Request not found", 404);
  if (!["APPROVED", "APPROVED_AWAITING_VEHICLE"].includes(request.status)) throw new ApiError("Request must be approved before allocation", 400);
  return ok(res, "Smart allocation complete", await runSmartAllocation(request));
}
