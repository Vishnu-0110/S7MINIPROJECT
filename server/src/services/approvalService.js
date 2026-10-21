import mongoose from "mongoose";
import { Approval, VehicleRequest } from "../models/index.js";
import { humanId } from "../utils/id.js";
import { audit } from "./auditService.js";
import { notify } from "./notificationService.js";

export function approvalChainForTripType(tripType) {
  if (tripType === "Local Official Visit") return ["TRANSPORT_ADMIN"];
  if (tripType === "Outstation Trip") return ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"];
  return ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"];
}

export async function createApprovalsForRequest(request) {
  const chain = approvalChainForTripType(request.tripType);
  const docs = chain.map((role, index) => ({
    approvalId: humanId("APR"),
    requestId: request._id,
    approverRole: role,
    level: index + 1,
    status: index === 0 ? "PENDING" : "PENDING"
  }));
  return Approval.insertMany(docs);
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

    const approval = await Approval.findOne({ requestId, status: "PENDING" }).sort({ level: 1 }).session(session);

    if (!approval || approval.approverRole !== actor.role) {
      const error = new Error("No pending approval is available for this role at the current approval level.");
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
      const pending = await Approval.countDocuments({ requestId, status: "PENDING" }).session(session);
      request.status = pending === 0 ? "APPROVED" : "PENDING_APPROVAL";
      request.approvalLevel = approval.level + 1;
      request.history.push({ status: request.status, actorId: actor._id, note: comments });
    }
    await request.save({ session });

    await audit(actor._id, `REQUEST_${status}`, "VehicleRequest", request._id, { comments }, null, {
      status: request.status
    });
    await session.commitTransaction();

    await notify(request.facultyId, "Request updated", `Your request ${request.requestId} is ${request.status}.`, "REQUEST", {
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
