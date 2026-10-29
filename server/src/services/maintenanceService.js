import { Maintenance, Vehicle } from "../models/index.js";
import { humanId } from "../utils/id.js";

export const SERVICE_INTERVAL_KM = 6000;
export const SERVICE_INTERVAL_MONTHS = 6;

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function ensureRoutineServiceSchedule(vehicleOrId) {
  const vehicle = typeof vehicleOrId === "object" ? vehicleOrId : await Vehicle.findById(vehicleOrId);
  if (!vehicle) return null;
  const currentKM = Number(vehicle.currentKM || 0);
  const nextServiceKM = Number(vehicle.nextServiceKM || currentKM + SERVICE_INTERVAL_KM);
  const serviceDate = addMonths(vehicle.lastServiceDate || vehicle.createdAt || new Date(), SERVICE_INTERVAL_MONTHS);
  if (!vehicle.nextServiceKM) {
    vehicle.nextServiceKM = nextServiceKM;
    await vehicle.save();
  }
  const overdue = currentKM >= nextServiceKM || serviceDate <= new Date();
  const activeSchedule = await Maintenance.findOne({
    vehicleId: vehicle._id,
    type: "ROUTINE_SERVICE",
    status: { $in: ["SCHEDULED", "OVERDUE"] }
  });
  if (activeSchedule) {
    activeSchedule.currentKM = currentKM;
    activeSchedule.nextServiceKM = nextServiceKM;
    activeSchedule.serviceDate = serviceDate;
    activeSchedule.intervalKM = SERVICE_INTERVAL_KM;
    activeSchedule.intervalMonths = SERVICE_INTERVAL_MONTHS;
    activeSchedule.risk = overdue ? "HIGH" : "LOW";
    activeSchedule.status = overdue ? "OVERDUE" : "SCHEDULED";
    await activeSchedule.save();
    return activeSchedule;
  }
  return Maintenance.create({
    maintenanceId: humanId("MAIN"),
    vehicleId: vehicle._id,
    type: "ROUTINE_SERVICE",
    currentKM,
    nextServiceKM,
    serviceDate,
    intervalKM: SERVICE_INTERVAL_KM,
    intervalMonths: SERVICE_INTERVAL_MONTHS,
    risk: overdue ? "HIGH" : "LOW",
    status: overdue ? "OVERDUE" : "SCHEDULED",
    notes: "Automatic service schedule: every 6,000 km or 6 months."
  });
}

export async function ensureAllRoutineServiceSchedules() {
  const vehicles = await Vehicle.find().select("currentKM nextServiceKM lastServiceDate createdAt");
  await Promise.all(vehicles.map((vehicle) => ensureRoutineServiceSchedule(vehicle)));
}
