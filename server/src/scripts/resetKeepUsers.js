import { closeDb, connectDb } from "../config/db.js";
import {
  Approval,
  AuditLog,
  Department,
  Driver,
  DriverIncident,
  EmergencyAlert,
  Expense,
  FuelLog,
  GpsLog,
  Maintenance,
  Notification,
  Trip,
  User,
  Vehicle,
  VehicleAllocation,
  VehicleDocument,
  VehicleRequest,
  ROLES
} from "../models/index.js";

if (!process.argv.includes("--confirm")) {
  throw new Error("This reset removes all non-user data. Run with --confirm after backing up any data you need.");
}

const models = {
  approvals: Approval,
  allocations: VehicleAllocation,
  trips: Trip,
  requests: VehicleRequest,
  vehicles: Vehicle,
  drivers: Driver,
  departments: Department,
  maintenance: Maintenance,
  fuelLogs: FuelLog,
  expenses: Expense,
  notifications: Notification,
  gpsLogs: GpsLog,
  emergencies: EmergencyAlert,
  vehicleDocuments: VehicleDocument,
  driverIncidents: DriverIncident,
  auditLogs: AuditLog
};

try {
  await connectDb();
  const migrated = await User.updateMany({ role: { $nin: ROLES } }, { $set: { role: "TRANSPORT_ADMIN" } });
  const results = await Promise.all(
    Object.entries(models).map(async ([name, Model]) => [name, (await Model.deleteMany({})).deletedCount])
  );
  console.log(JSON.stringify({ superAdminsConverted: migrated.modifiedCount, removed: Object.fromEntries(results) }));
} finally {
  await closeDb();
}
