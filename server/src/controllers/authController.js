import { Driver, User } from "../models/index.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { signToken } from "../middleware/auth.js";
import { humanId } from "../utils/id.js";

const selfRegisterRoles = ["FACULTY_STAFF", "DRIVER"];

function sanitize(user) {
  const doc = user.toObject ? user.toObject() : user;
  delete doc.password;
  return doc;
}

export async function register(req, res) {
  const exists = await User.exists({ email: req.body.email });
  if (exists) throw new ApiError("Email is already registered", 409);
  const role = selfRegisterRoles.includes(req.body.role) ? req.body.role : "FACULTY_STAFF";
  if (role === "DRIVER" && (await Driver.exists({ licenseNumber: req.body.licenseNumber }))) {
    throw new ApiError("This licence number is already registered", 409);
  }
  const { licenseNumber, ...userPayload } = req.body;
  const user = await User.create({ ...userPayload, role });
  if (role === "DRIVER") {
    await Driver.create({
      driverId: humanId("DRV"),
      userId: user._id,
      licenseNumber,
      phone: req.body.phone,
      status: "AVAILABLE"
    });
  }
  const token = signToken(user);
  return ok(res, "Registered", { user: sanitize(user), token }, 201);
}

export async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw new ApiError("Invalid email or password", 401);
  }
  // Login telemetry must not prevent a valid user from accessing the application.
  User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch((error) => {
    console.warn("Unable to update last login time:", error.message);
  });
  const token = signToken(user);
  return ok(res, "Logged in", { user: sanitize(user), token });
}

export async function logout(_req, res) {
  return ok(res, "Logged out");
}

export async function me(req, res) {
  return ok(res, "Current user", { user: req.user });
}
