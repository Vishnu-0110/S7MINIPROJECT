import { Driver, DriverLeave, User } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { notifyMany } from "../services/notificationService.js";

function dateRange(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function listDriverLeaves(req, res) {
  const query = req.user.role === "DRIVER"
    ? { driverId: (await Driver.findOne({ userId: req.user._id }).select("_id"))?._id || null }
    : {};
  const leaves = await DriverLeave.find(query)
    .populate({ path: "driverId", populate: { path: "userId", select: "name email phone" } })
    .populate("reviewedBy", "name")
    .sort({ createdAt: -1 });
  return ok(res, "Driver leave requests", leaves);
}

export async function createDriverLeave(req, res) {
  const driver = await Driver.findOne({ userId: req.user._id });
  if (!driver) throw new ApiError("A driver profile is required to request leave", 404);
  const { from, to } = dateRange(req.body.fromDate, req.body.toDate);
  if (to < from) throw new ApiError("Leave end date must be on or after the start date", 400);
  const conflict = await DriverLeave.exists({ driverId: driver._id, status: { $in: ["PENDING", "APPROVED"] }, fromDate: { $lte: to }, toDate: { $gte: from } });
  if (conflict) throw new ApiError("You already have a pending or approved leave request for these dates", 409);
  const leave = await DriverLeave.create({ driverId: driver._id, fromDate: from, toDate: to, reason: req.body.reason });
  const admins = await User.find({ role: "TRANSPORT_ADMIN", isActive: true }).select("_id");
  await notifyMany(admins.map((admin) => admin._id), "Driver leave request", `${req.user.name} requested leave from ${from.toLocaleDateString("en-CA")} to ${to.toLocaleDateString("en-CA")}.`, "LEAVE", { leaveId: leave._id });
  return ok(res, "Leave request submitted", leave, 201);
}

export async function decideDriverLeave(req, res) {
  const leave = await DriverLeave.findById(req.params.id).populate({ path: "driverId", populate: { path: "userId", select: "name" } });
  if (!leave) throw new ApiError("Leave request not found", 404);
  if (leave.status !== "PENDING") throw new ApiError("This leave request has already been reviewed", 409);
  leave.status = req.body.status;
  leave.reviewNote = req.body.reviewNote;
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  await leave.save();
  const message = leave.status === "APPROVED"
    ? `Your leave request from ${leave.fromDate.toLocaleDateString("en-CA")} to ${leave.toDate.toLocaleDateString("en-CA")} was approved. You will not be allocated to trips during these dates.`
    : "Your leave request was rejected.";
  await notifyMany([leave.driverId.userId], `Leave request ${leave.status.toLowerCase()}`, message, "LEAVE", { leaveId: leave._id });
  return ok(res, `Leave request ${leave.status.toLowerCase()}`, leave);
}
