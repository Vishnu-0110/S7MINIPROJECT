import test from "node:test";
import assert from "node:assert/strict";
import { scoreVehicleForRequest } from "./allocationService.js";

test("smart allocation favors a suitable available vehicle with available driver", async () => {
  const result = await scoreVehicleForRequest({
    request: { passengerCount: 38, source: "BIT", destination: "Coimbatore" },
    vehicle: { capacity: 40, status: "AVAILABLE", mileageKmPerLiter: 4.2, condition: "GOOD" },
    driver: { status: "AVAILABLE" },
    maintenanceConflict: false,
    vehicleConflict: false,
    driverConflict: false,
    weights: { capacity: 30, availability: 25, distance: 20, maintenance: 15, driver: 10 }
  });

  assert.equal(result.capacityScore > 0, true);
  assert.equal(result.availabilityScore, 100);
  assert.equal(result.driverAvailabilityScore, 100);
  assert.equal(result.reasons.includes("Capacity suitable"), true);
});

test("smart allocation rejects undersized vehicles through capacity score", async () => {
  const result = await scoreVehicleForRequest({
    request: { passengerCount: 38, source: "BIT", destination: "Coimbatore" },
    vehicle: { capacity: 18, status: "AVAILABLE", mileageKmPerLiter: 8, condition: "EXCELLENT" },
    driver: { status: "AVAILABLE" },
    maintenanceConflict: false,
    vehicleConflict: false,
    driverConflict: false,
    weights: { capacity: 30, availability: 25, distance: 20, maintenance: 15, driver: 10 }
  });

  assert.equal(result.capacityScore, 0);
});
