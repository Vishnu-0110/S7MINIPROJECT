import cron from "node-cron";
import { Maintenance, Notification, User, VehicleDocument } from "../models/index.js";
import { sendTodayTripReminders } from "../services/tripReminderService.js";

export function startJobs() {
  const runDailyJobs = async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    await VehicleDocument.updateMany({ expiresAt: { $lte: soon }, status: "VALID" }, { status: "EXPIRING" });
    await Maintenance.updateMany({ serviceDate: { $lt: new Date() }, status: "SCHEDULED" }, { status: "OVERDUE", risk: "HIGH" });
    const admins = await User.find({ role: "TRANSPORT_ADMIN" }).select("_id");
    await Notification.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        title: "Fleet alerts updated",
        message: "Maintenance and document risk checks completed.",
        type: "MAINTENANCE"
      }))
    );
  };
  cron.schedule("0 8 * * *", () => runDailyJobs().catch((error) => console.error("Daily fleet job failed.", error.message)), { timezone: "Asia/Kolkata" });
  cron.schedule("1 0 * * *", () => sendTodayTripReminders().catch((error) => console.error("Trip reminder job failed.", error.message)), { timezone: "Asia/Kolkata" });
  sendTodayTripReminders().catch((error) => console.error("Trip reminder check failed.", error.message));
}
