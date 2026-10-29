import mongoose from "mongoose";

const driverLeaveSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: String
  },
  { timestamps: true, collection: "driver_leaves" }
);

driverLeaveSchema.index({ driverId: 1, fromDate: 1, toDate: 1, status: 1 });

export const DriverLeave = mongoose.model("DriverLeave", driverLeaveSchema);
