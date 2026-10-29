import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    licenseNumber: { type: String, required: true, unique: true },
    phone: String,
    assignedVehicleTypes: [String],
    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "IN_TRIP", "OFF_DUTY", "INACTIVE"],
      default: "AVAILABLE"
    },
    rating: { type: Number, min: 1, max: 5 },
    totalTrips: { type: Number, default: 0 },
    incidents: [{ type: mongoose.Schema.Types.ObjectId, ref: "DriverIncident" }]
  },
  { timestamps: true, collection: "drivers" }
);

driverSchema.index({ status: 1 });
driverSchema.index({ userId: 1 });

export const Driver = mongoose.model("Driver", driverSchema);
