import { Notification } from "../models/index.js";

let ioRef = null;

export function setNotificationSocket(io) {
  ioRef = io;
}

export async function notify(userId, title, message, type = "INFO", metadata = {}) {
  const notification = await Notification.create({ userId, title, message, type, metadata });
  if (ioRef) {
    ioRef.to(`user-room-${userId}`).emit("notification:new", notification);
    ioRef.to("admin-room").emit("notification:new", notification);
  }
  return notification;
}
