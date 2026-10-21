import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true, unique: true },
    registrationNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    facilities: { type: [String], default: [] },
    fuelType: { type: String, default: "Diesel" },
    fuelLevel: { type: Number, default: 75, min: 0, max: 100 },
    mileageKmPerLiter: { type: Number, default: 4 },
    currentKM: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "IN_TRIP", "MAINTENANCE", "BREAKDOWN", "BREAKDOWN_REPORTED", "OUT_OF_SERVICE", "INACTIVE"],
      default: "AVAILABLE"
    },
    condition: {
      type: String,
      enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"],
      default: "GOOD"
    },
    nextServiceKM: Number,
    lastServiceDate: Date,
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "VehicleDocument" }]
  },
  { timestamps: true, collection: "vehicles" }
);

vehicleSchema.index({ status: 1 });
vehicleSchema.index({ type: 1, capacity: 1, fuelType: 1 });

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
