import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: "departments" }
);

export const Department = mongoose.model("Department", departmentSchema);
