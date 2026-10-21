import { Driver, Notification, Trip } from "../models/index.js";
import { formatIndiaTripTime, indiaDayRange, isTodayInIndia } from "../utils/indiaTime.js";
import { notify } from "./notificationService.js";

const reminderStatuses = ["SCHEDULED", "TRANSFER_OR_VERIFICATION_PENDING", "REPLACEMENT_ASSIGNED"];

export async function sendTripDayReminder(trip, driver) {
  if (!isTodayInIndia(trip.scheduledStartTime) || !driver?.userId) return null;
  const reminderDate = indiaDayRange().key;
  const alreadySent = await Notification.exists({
    userId: driver.userId,
    type: "TRIP_REMINDER",
    "metadata.tripId": trip._id,
    "metadata.reminderDate": reminderDate
  });
  if (alreadySent) return null;
  const scheduledAt = formatIndiaTripTime(trip.scheduledStartTime);
  return notify(
    driver.userId,
    "Today's trip assignment",
    `You have a trip today on ${scheduledAt} to ${trip.destination}. Happy Journey!`,
    "TRIP_REMINDER",
    { tripId: trip._id, reminderDate }
  );
}

export async function sendTodayTripReminders() {
  const { start, end } = indiaDayRange();
  const trips = await Trip.find({
    status: { $in: reminderStatuses },
    scheduledStartTime: { $gte: start, $lt: end }
  }).select("_id tripId driverId scheduledStartTime destination");
  const drivers = await Driver.find({ _id: { $in: trips.map((trip) => trip.driverId) } }).select("_id userId");
  const driversById = new Map(drivers.map((driver) => [String(driver._id), driver]));
  await Promise.all(trips.map((trip) => sendTripDayReminder(trip, driversById.get(String(trip.driverId)))));
}
