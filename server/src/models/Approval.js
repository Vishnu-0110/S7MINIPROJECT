import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    approvalId: { type: String, required: true, unique: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "VehicleRequest", required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approverRole: { type: String, required: true },
    level: { type: Number, required: true },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "INVALIDATED"], default: "PENDING" },
    comments: String,
    approvedAt: Date,
    rejectedAt: Date
  },
  { timestamps: true, collection: "approvals" }
);

approvalSchema.index({ requestId: 1 });
approvalSchema.index({ approverId: 1 });
approvalSchema.index({ status: 1 });
approvalSchema.index({ requestId: 1, approverRole: 1, version: 1 }, { unique: true });

export const Approval = mongoose.model("Approval", approvalSchema);
