import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Driver, Trip, User } from "../models/index.js";
import { setNotificationSocket } from "../services/notificationService.js";
import { setTripSocket } from "../services/tripService.js";

export function configureSockets(io) {
  setTripSocket(io);
  setNotificationSocket(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Socket authentication required"));
      const payload = jwt.verify(token, env.jwtSecret || "development-only-secret");
      const user = await User.findById(payload.id).select("-password");
      if (!user || !user.isActive) return next(new Error("Socket authentication failed"));
      socket.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", async (socket) => {
    if (socket.user) {
      socket.join(`user-room-${socket.user._id}`);
      if (["TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(socket.user.role)) socket.join("admin-room");
      if (socket.user.role === "DRIVER") {
        const driver = await Driver.findOne({ userId: socket.user._id });
        if (driver) socket.join(`driver-room-${driver._id}`);
      }
    }

    socket.on("trip:join", async (tripId) => {
      const trip = await Trip.findById(tripId).select("facultyId departmentId driverId");
      if (!trip) return;
      const driver = socket.user.role === "DRIVER" ? await Driver.findOne({ userId: socket.user._id }).select("_id") : null;
      const allowed = ["TRANSPORT_ADMIN", "SUPER_ADMIN"].includes(socket.user.role)
        || (socket.user.role === "FACULTY_STAFF" && String(trip.facultyId) === String(socket.user._id))
        || (socket.user.role === "DEPARTMENT_COORDINATOR" && String(trip.departmentId) === String(socket.user.departmentId))
        || (driver && String(trip.driverId) === String(driver._id));
      if (allowed) socket.join(`trip-room-${tripId}`);
    });
    socket.on("trip:leave", (tripId) => socket.leave(`trip-room-${tripId}`));
  });
}
