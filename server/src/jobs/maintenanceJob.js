import cron from "node-cron";
import { Maintenance, User } from "../models/index.js";
import { sendTodayTripReminders } from "../services/tripReminderService.js";
import { notifyMany } from "../services/notificationService.js";

export function startJobs() {
  const runDailyJobs = async () => {
    await Maintenance.updateMany({ serviceDate: { $lt: new Date() }, status: "SCHEDULED" }, { status: "OVERDUE", risk: "HIGH" });
    const admins = await User.find({ role: "TRANSPORT_ADMIN" }).select("_id");
    await notifyMany(
      admins.map((admin) => admin._id),
      "Fleet alerts updated",
      "Maintenance overdue checks completed. Expired vehicle documents are listed in Maintenance.",
      "MAINTENANCE"
    );
  };
  cron.schedule("0 8 * * *", () => runDailyJobs().catch((error) => console.error("Daily fleet job failed.", error.message)), { timezone: "Asia/Kolkata" });
  cron.schedule("1 0 * * *", () => sendTodayTripReminders().catch((error) => console.error("Trip reminder job failed.", error.message)), { timezone: "Asia/Kolkata" });
  sendTodayTripReminders().catch((error) => console.error("Trip reminder check failed.", error.message));
}
