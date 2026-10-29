import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Department, User } from "../models/index.js";
import { ApiError } from "../utils/apiResponse.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
    if (!token) throw new ApiError("Unauthorized", 401);

    const payload = jwt.verify(token, env.jwtSecret || "development-only-secret");
    const user = await User.findById(payload.id).select("-password");
    if (!user || !user.isActive) throw new ApiError("Unauthorized", 401);

    // Older coordinator accounts may have been linked only from Department.
    // Repair that relationship before applying department-scoped authorization.
    if (user.role === "DEPARTMENT_COORDINATOR" && !user.departmentId) {
      const department = await Department.findOne({ coordinatorId: user._id })
        || await Department.findOne({ code: "CSE" });
      if (department) {
        user.departmentId = department._id;
        await user.save();
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : new ApiError("Unauthorized", 401));
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError("Unauthorized", 401));
    if (!roles.includes(req.user.role)) return next(new ApiError("Forbidden", 403));
    return next();
  };
}

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.jwtSecret || "development-only-secret", {
    expiresIn: env.jwtExpiresIn
  });
}
