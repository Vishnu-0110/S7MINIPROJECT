import mongoose from "mongoose";
import { REQUEST_STATUSES, TRIP_TYPES } from "./enums.js";

const locationSchema = new mongoose.Schema(
  {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    recordedAt: Date
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    tripId: { type: String, required: true, unique: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "VehicleRequest", required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    purpose: String,
    tripType: { type: String, enum: TRIP_TYPES },
    source: String,
    destination: String,
    waypoints: [String],
    passengers: [Object],
    passengerCount: Number,
    scheduledStartTime: { type: Date, required: true },
    scheduledEndTime: { type: Date, required: true },
    startTime: Date,
    endTime: Date,
    startKM: Number,
    endKM: Number,
    distance: Number,
    fuelUsed: Number,
    fuelEfficiency: Number,
    estimatedCost: Number,
    actualCost: Number,
    status: { type: String, enum: REQUEST_STATUSES, default: "SCHEDULED" },
    startLocation: locationSchema,
    endLocation: locationSchema,
    route: [locationSchema],
    qrToken: { type: String, required: true, unique: true, select: false },
    qrVerifiedAt: Date,
    qrExpiresAt: Date,
    qrConsumed: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "trips" }
);

tripSchema.index({ requestId: 1 });
tripSchema.index({ vehicleId: 1 });
tripSchema.index({ driverId: 1 });
tripSchema.index({ facultyId: 1 });
tripSchema.index({ departmentId: 1 });
tripSchema.index({ scheduledStartTime: 1 });
tripSchema.index({ startTime: 1 });
tripSchema.index({ status: 1 });
tripSchema.index({ vehicleId: 1, scheduledStartTime: 1, scheduledEndTime: 1 });
tripSchema.index({ driverId: 1, scheduledStartTime: 1, scheduledEndTime: 1 });

export const Trip = mongoose.model("Trip", tripSchema);
