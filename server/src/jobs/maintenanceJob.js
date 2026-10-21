import cron from "node-cron";
import { Maintenance, Notification, User, VehicleDocument } from "../models/index.js";

export function startJobs() {
  cron.schedule("0 8 * * *", async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    await VehicleDocument.updateMany({ expiresAt: { $lte: soon }, status: "VALID" }, { status: "EXPIRING" });
    await Maintenance.updateMany({ serviceDate: { $lt: new Date() }, status: "SCHEDULED" }, { status: "OVERDUE", risk: "HIGH" });
    const admins = await User.find({ role: { $in: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] } }).select("_id");
    await Notification.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        title: "Fleet alerts updated",
        message: "Maintenance and document risk checks completed.",
        type: "MAINTENANCE"
      }))
    );
  });
}
