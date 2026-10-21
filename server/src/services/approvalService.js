import mongoose from "mongoose";
import { Approval, User, VehicleRequest } from "../models/index.js";
import { humanId } from "../utils/id.js";
import { audit } from "./auditService.js";
import { notify } from "./notificationService.js";

export function approvalChainForTripType(tripType) {
  return ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"];
}

export async function createApprovalsForRequest(request) {
  const chain = approvalChainForTripType(request.tripType);
  const docs = chain.map((role, index) => ({
    approvalId: humanId("APR"),
    requestId: request._id,
    approverRole: role,
    level: index + 1,
    version: request.approvalVersion,
    status: index === 0 ? "PENDING" : "PENDING"
  }));
  return Approval.insertMany(docs);
}

export async function notifyApprovalParticipants(request) {
  const recipients = await User.find({
    isActive: true,
    $or: [
      { role: "TRANSPORT_ADMIN" },
      { role: "DEPARTMENT_COORDINATOR", departmentId: request.departmentId }
    ]
  }).select("_id");
  await Promise.all(recipients.map((user) => notify(
    user._id,
    "Approval required",
    `Request ${request.requestId} needs your approval.`,
    "REQUEST",
    { requestId: request._id, approvalVersion: request.approvalVersion }
  )));
}

export async function decideApproval({ requestId, actor, status, comments }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const request = await VehicleRequest.findById(requestId).session(session);
    if (!request) {
      const error = new Error("Request not found");
      error.status = 404;
      throw error;
    }

    if (request.status !== "PENDING_APPROVAL") {
      const error = new Error("This request is not awaiting approval.");
      error.status = 409;
      throw error;
    }

    if (
      actor.role === "DEPARTMENT_COORDINATOR" &&
      String(request.departmentId) !== String(actor.departmentId)
    ) {
      const error = new Error("Department Coordinators can only decide requests from their own department.");
      error.status = 403;
      throw error;
    }

    const approverRole = actor.role === "SUPER_ADMIN" ? "TRANSPORT_ADMIN" : actor.role;
    const versionFilter = request.approvalVersion === 1
      ? { $or: [{ version: 1 }, { version: { $exists: false } }] }
      : { version: request.approvalVersion };
    const approval = await Approval.findOne({
      requestId,
      approverRole,
      status: "PENDING",
      ...versionFilter
    }).session(session);

    if (!approval) {
      const error = new Error("No pending approval is available for this role and request version.");
      error.status = 403;
      throw error;
    }

    approval.status = status;
    approval.comments = comments;
    approval.approverId = actor._id;
    if (status === "APPROVED") approval.approvedAt = new Date();
    if (status === "REJECTED") approval.rejectedAt = new Date();
    await approval.save({ session });

    if (status === "REJECTED") {
      request.status = "REJECTED";
      request.history.push({ status: "REJECTED", actorId: actor._id, note: comments });
    } else {
      const pending = await Approval.countDocuments({ requestId, status: "PENDING", ...versionFilter }).session(session);
      request.status = pending === 0 ? "APPROVED_AWAITING_VEHICLE" : "PENDING_APPROVAL";
      request.approvalLevel = pending === 0 ? 2 : approval.level;
      request.history.push({ status: request.status, actorId: actor._id, note: comments });
    }
    await request.save({ session });

    await audit(actor._id, `REQUEST_${status}`, "VehicleRequest", request._id, { comments }, null, {
      status: request.status
    });
    await session.commitTransaction();

    await notify(request.facultyId, "Request updated", `Your request ${request.requestId} is ${request.status.replaceAll("_", " ")}.`, "REQUEST", {
      requestId: request._id
    });
    return request;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
