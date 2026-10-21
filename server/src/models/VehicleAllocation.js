import mongoose from "mongoose";

const vehicleAllocationSchema = new mongoose.Schema(
  {
    allocationId: { type: String, required: true, unique: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "VehicleRequest", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    score: Number,
    capacityScore: Number,
    availabilityScore: Number,
    distanceScore: Number,
    maintenanceScore: Number,
    driverAvailabilityScore: Number,
    estimatedCost: Number,
    reasons: [String],
    isRecommended: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
    override: { type: Boolean, default: false },
    overrideReason: String,
    reallocationForTripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" }
  },
  { timestamps: true, collection: "vehicle_allocations" }
);

vehicleAllocationSchema.index({ requestId: 1 });
vehicleAllocationSchema.index({ vehicleId: 1 });
vehicleAllocationSchema.index({ driverId: 1 });
vehicleAllocationSchema.index({ score: -1 });

export const VehicleAllocation = mongoose.model("VehicleAllocation", vehicleAllocationSchema);
