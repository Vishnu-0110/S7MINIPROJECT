import mongoose from "mongoose";
import { PRIORITIES, REQUEST_STATUSES, TRIP_TYPES } from "./enums.js";

const passengerSchema = new mongoose.Schema(
  {
    name: String,
    rollNo: String,
    phone: String
  },
  { _id: false }
);

const vehicleRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    tripType: { type: String, enum: TRIP_TYPES, required: true },
    purpose: { type: String, required: true },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    waypoints: [String],
    passengerCount: { type: Number, required: true, min: 1 },
    passengers: [passengerSchema],
    date: { type: Date, required: true },
    departureTime: { type: Date, required: true },
    returnTime: { type: Date, required: true },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },
    supportingDocument: String,
    specialRequirements: String,
    requiredFacilities: { type: [String], default: [] },
    notes: String,
    status: { type: String, enum: REQUEST_STATUSES, default: "PENDING_APPROVAL" },
    approvalVersion: { type: Number, default: 1, min: 1 },
    approvalLevel: { type: Number, default: 1 },
    history: [
      {
        status: String,
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true, collection: "vehicle_requests" }
);

vehicleRequestSchema.index({ facultyId: 1 });
vehicleRequestSchema.index({ departmentId: 1 });
vehicleRequestSchema.index({ date: 1 });
vehicleRequestSchema.index({ status: 1 });
vehicleRequestSchema.index({ priority: 1 });
vehicleRequestSchema.index({ tripType: 1, date: 1 });
vehicleRequestSchema.index({ status: 1, approvalVersion: 1 });

export const VehicleRequest = mongoose.model("VehicleRequest", vehicleRequestSchema);
