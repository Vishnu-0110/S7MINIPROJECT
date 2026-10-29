import bcrypt from "bcryptjs";
import { connectDb, closeDb } from "../config/db.js";
import { env } from "../config/env.js";
import {
  Approval,
  Department,
  Driver,
  Expense,
  FuelLog,
  Maintenance,
  Notification,
  Trip,
  User,
  Vehicle,
  VehicleRequest
} from "../models/index.js";
import { createApprovalsForRequest } from "../services/approvalService.js";
import { runSmartAllocation } from "../services/allocationService.js";
import { createTripFromAssignment } from "../services/tripService.js";
import { humanId } from "../utils/id.js";

const password = "SmartFleet@123";

async function resetDevelopmentData() {
  if (!env.seedReset) return;
  await Promise.all([
    Department.deleteMany({}),
    Vehicle.deleteMany({}),
    Driver.deleteMany({}),
    VehicleRequest.deleteMany({}),
    Approval.deleteMany({}),
    Trip.deleteMany({}),
    FuelLog.deleteMany({}),
    Maintenance.deleteMany({}),
    Expense.deleteMany({}),
    Notification.deleteMany({}),
  ]);
}

async function upsertUser({ name, email, role, departmentId, phone }) {
  const hash = await bcrypt.hash(password, 12);
  return User.findOneAndUpdate(
    { email },
    { name, email, role, departmentId, phone, password: hash, isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seed() {
  await connectDb();
  await resetDevelopmentData();

  const cse = await Department.findOneAndUpdate(
    { code: "CSE" },
    { code: "CSE", name: "Computer Science and Engineering", isActive: true },
    { upsert: true, new: true }
  );
  const transport = await Department.findOneAndUpdate(
    { code: "TRANSPORT" },
    { code: "TRANSPORT", name: "Transport Department", isActive: true },
    { upsert: true, new: true }
  );

  const transportAdmin = await upsertUser({ name: "Transport Admin", email: "transportadmin@bit.edu.in", role: "TRANSPORT_ADMIN", departmentId: transport._id });
  const coordinator = await upsertUser({ name: "Department Coordinator", email: "coordinator@bit.edu.in", role: "DEPARTMENT_COORDINATOR", departmentId: cse._id });
  const faculty = await upsertUser({ name: "Faculty User", email: "faculty@bit.edu.in", role: "FACULTY_STAFF", departmentId: cse._id });
  const driverUser = await upsertUser({ name: "Kumar Driver", email: "driver@bit.edu.in", role: "DRIVER", departmentId: transport._id, phone: "9999999999" });

  cse.coordinatorId = coordinator._id;
  await cse.save();

  const vehicles = await Vehicle.bulkWrite(
    [
      {
        vehicleId: "BUS-30", registrationNumber: "TN-33-BIT-1030", name: "BIT City Shuttle", type: "Bus", capacity: 30,
        facilities: ["Air conditioning", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 18450,
        condition: "EXCELLENT", status: "AVAILABLE", lastServiceDate: new Date("2026-08-15"), nextServiceKM: 24000
      },
      {
        vehicleId: "BUS-60", registrationNumber: "TN-33-BIT-1060", name: "BIT Grand Tourer", type: "Bus", capacity: 60,
        facilities: ["Air conditioning", "Luggage storage", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 32780,
        condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-07-20"), nextServiceKM: 36000
      },
      {
        vehicleId: "BUS-45", registrationNumber: "TN-33-BIT-1045", name: "BIT Academic Express", type: "Bus", capacity: 45,
        facilities: ["Air conditioning", "PA system", "First-aid kit"], fuelType: "Diesel", currentKM: 25600,
        condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-09-01"), nextServiceKM: 30000
      },
      {
        vehicleId: "BUS-55", registrationNumber: "TN-33-BIT-1055", name: "BIT Event Coach", type: "Bus", capacity: 55,
        facilities: ["Air conditioning", "Luggage storage", "Wheelchair access", "GPS tracking"], fuelType: "Diesel", currentKM: 41800,
        condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-09-10"), nextServiceKM: 42000
      },
      {
        vehicleId: "VAN-42", registrationNumber: "TN-33-BIT-1042", name: "BIT Multi-Purpose Van", type: "Van", capacity: 42,
        facilities: ["Air conditioning", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 11900,
        condition: "EXCELLENT", status: "AVAILABLE", lastServiceDate: new Date("2026-10-05"), nextServiceKM: 18000
      }
    ].map((vehicle) => ({
      updateOne: { filter: { vehicleId: vehicle.vehicleId }, update: vehicle, upsert: true }
    }))
  );

  const bus02 = await Vehicle.findOne({ vehicleId: "BUS-30" });
  const busM1 = await Vehicle.findOne({ vehicleId: "BUS-55" });
  const driver = await Driver.findOneAndUpdate(
    { driverId: "DRV-001" },
    {
      driverId: "DRV-001",
      userId: driverUser._id,
      licenseNumber: "DL-TN-BIT-001",
      phone: "9999999999",
      assignedVehicleTypes: ["Bus", "Van"],
      status: "AVAILABLE"
    },
    { upsert: true, new: true }
  );

  await Maintenance.findOneAndUpdate(
    { maintenanceId: "MAIN-DEMO-001" },
    {
      maintenanceId: "MAIN-DEMO-001",
      vehicleId: busM1._id,
      type: "Scheduled Service",
      serviceDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      nextServiceKM: 62000,
      currentKM: 62000,
      risk: "HIGH",
      status: "SCHEDULED",
      notes: "Demo maintenance conflict"
    },
    { upsert: true, new: true }
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const returnTime = new Date(tomorrow);
  returnTime.setHours(18, 0, 0, 0);

  let request = await VehicleRequest.findOne({ purpose: "Industrial Visit to Coimbatore Demo" });
  if (!request) {
    request = await VehicleRequest.create({
      requestId: humanId("REQ"),
      facultyId: faculty._id,
      departmentId: cse._id,
      tripType: "Industrial Visit",
      purpose: "Industrial Visit to Coimbatore Demo",
      source: "BIT",
      destination: "Coimbatore",
      passengerCount: 38,
      passengers: Array.from({ length: 3 }, (_, index) => ({ name: `Student ${index + 1}` })),
      date: tomorrow,
      departureTime: tomorrow,
      returnTime,
      priority: "High",
      status: "PENDING_APPROVAL",
      history: [{ status: "PENDING_APPROVAL", actorId: faculty._id, note: "Seed request submitted" }]
    });
    await createApprovalsForRequest(request);
  }

  for (const approval of await Approval.find({ requestId: request._id }).sort({ level: 1 })) {
    approval.status = "APPROVED";
    approval.approverId = approval.approverRole === "DEPARTMENT_COORDINATOR" ? coordinator._id : transportAdmin._id;
    approval.approvedAt = new Date();
    await approval.save();
  }
  request.status = "APPROVED";
  request.history.push({ status: "APPROVED", actorId: transportAdmin._id, note: "Seed approval complete" });
  await request.save();

  const allocations = await runSmartAllocation(request);
  const selected = allocations[0];
  let trip = await Trip.findOne({ requestId: request._id });
  if (!trip && selected) {
    trip = await createTripFromAssignment({
      requestId: request._id,
      vehicleId: selected.vehicleId._id,
      driverId: selected.driverId._id,
      allocationId: selected._id,
      actor: transportAdmin
    });
  } else if (trip) {
    request.status = trip.status;
    request.history.push({ status: trip.status, actorId: transportAdmin._id, note: "Existing seed trip retained" });
    await request.save();
  }

  if (trip) {
    await FuelLog.findOneAndUpdate(
      { fuelLogId: "FUEL-DEMO-001" },
      {
        fuelLogId: "FUEL-DEMO-001",
        vehicleId: bus02._id,
        tripId: trip._id,
        quantity: 38,
        pricePerLiter: 95,
        totalAmount: 3610,
        odometerReading: 32612,
        fuelStation: "BIT Fuel Partner",
        enteredBy: transportAdmin._id,
        efficiency: 4.26
      },
      { upsert: true, new: true }
    );
  }

  await Expense.findOneAndUpdate(
    { expenseId: "EXP-DEMO-001" },
    { expenseId: "EXP-DEMO-001", vehicleId: bus02._id, tripId: trip?._id, category: "Toll", amount: 850, notes: "Demo toll expense", enteredBy: transportAdmin._id },
    { upsert: true, new: true }
  );

  await Notification.create({
    userId: faculty._id,
    title: "Demo trip ready",
    message: "Industrial Visit demo request has been approved and scheduled.",
    type: "TRIP"
  });

  console.log("BIT SmartFleet seed complete.");
  console.log(`Users created with password: ${password}`);
  console.log(`Vehicle upserts: ${vehicles.upsertedCount + vehicles.modifiedCount}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
