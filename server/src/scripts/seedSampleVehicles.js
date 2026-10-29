import { closeDb, connectDb } from "../config/db.js";
import { Vehicle } from "../models/index.js";

const vehicles = [
  { vehicleId: "BUS-30", registrationNumber: "TN-33-BIT-1030", name: "BIT City Shuttle", type: "Bus", capacity: 30, facilities: ["Air conditioning", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 18450, condition: "EXCELLENT", status: "AVAILABLE", lastServiceDate: new Date("2026-08-15"), nextServiceKM: 24000 },
  { vehicleId: "BUS-60", registrationNumber: "TN-33-BIT-1060", name: "BIT Grand Tourer", type: "Bus", capacity: 60, facilities: ["Air conditioning", "Luggage storage", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 32780, condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-07-20"), nextServiceKM: 36000 },
  { vehicleId: "BUS-45", registrationNumber: "TN-33-BIT-1045", name: "BIT Academic Express", type: "Bus", capacity: 45, facilities: ["Air conditioning", "PA system", "First-aid kit"], fuelType: "Diesel", currentKM: 25600, condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-09-01"), nextServiceKM: 30000 },
  { vehicleId: "BUS-55", registrationNumber: "TN-33-BIT-1055", name: "BIT Event Coach", type: "Bus", capacity: 55, facilities: ["Air conditioning", "Luggage storage", "Wheelchair access", "GPS tracking"], fuelType: "Diesel", currentKM: 41800, condition: "GOOD", status: "AVAILABLE", lastServiceDate: new Date("2026-09-10"), nextServiceKM: 42000 },
  { vehicleId: "VAN-42", registrationNumber: "TN-33-BIT-1042", name: "BIT Multi-Purpose Van", type: "Van", capacity: 42, facilities: ["Air conditioning", "First-aid kit", "GPS tracking"], fuelType: "Diesel", currentKM: 11900, condition: "EXCELLENT", status: "AVAILABLE", lastServiceDate: new Date("2026-10-05"), nextServiceKM: 18000 }
];

try {
  await connectDb();
  await Promise.all(vehicles.map((vehicle) => Vehicle.findOneAndUpdate(
    { registrationNumber: vehicle.registrationNumber },
    { $set: vehicle },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )));
  console.log(`Upserted ${vehicles.length} sample vehicles.`);
} finally {
  await closeDb();
}
