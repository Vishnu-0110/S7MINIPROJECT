import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "./enums.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    phone: String,
    address: String,
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date
  },
  { timestamps: true, collection: "users" }
);

userSchema.index({ role: 1 });
userSchema.index({ departmentId: 1 });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre("findOneAndUpdate", async function hashUpdatedPassword(next) {
  const update = this.getUpdate();
  const password = update?.password || update?.$set?.password;
  if (!password) return next();
  const hashed = await bcrypt.hash(password, 12);
  if (update.password) update.password = hashed;
  if (update.$set?.password) update.$set.password = hashed;
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);
