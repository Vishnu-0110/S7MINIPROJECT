import test from "node:test";
import assert from "node:assert/strict";
import { isCapacityFit, scoreVehicleForRequest, vehicleSupportsRequest } from "./allocationService.js";

test("smart allocation accepts every vehicle with enough seats", () => {
  assert.equal(isCapacityFit({ capacity: 50 }, 50), true);
  assert.equal(isCapacityFit({ capacity: 55 }, 50), true);
  assert.equal(isCapacityFit({ capacity: 60 }, 50), true);
  assert.equal(isCapacityFit({ capacity: 49 }, 50), false);
});

test("smart allocation can use an available larger vehicle with enough seats", async () => {
  const request = { passengerCount: 50, source: "BIT", destination: "Chennai" };
  const vehicle = { capacity: 60, type: "Bus", status: "AVAILABLE", mileageKmPerLiter: 4, condition: "GOOD" };
  const common = { request, vehicle, driver: { status: "AVAILABLE" }, maintenanceConflict: false, vehicleConflict: false, driverConflict: false, weights: { capacity: 30, availability: 25, distance: 20, maintenance: 15, driver: 10 } };
  const normal = await scoreVehicleForRequest(common);
  const emergency = await scoreVehicleForRequest({ ...common, allowCapacityOverride: true });
  assert.equal(normal.capacityScore > 0, true);
  assert.equal(emergency.capacityScore > 0, true);
  assert.equal(emergency.reasons.includes("10 spare seats available"), true);
});

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
  assert.equal(result.reasons.includes("2 spare seats available"), true);
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

test("smart allocation rejects vehicles without required accessibility facilities", async () => {
  const request = { passengerCount: 20, requiredFacilities: ["wheelchair access"] };
  assert.equal(vehicleSupportsRequest({ facilities: ["air conditioning"] }, request), false);
  assert.equal(vehicleSupportsRequest({ facilities: ["Wheelchair Access", "air conditioning"] }, request), true);

  const result = await scoreVehicleForRequest({
    request,
    vehicle: { capacity: 30, status: "AVAILABLE", mileageKmPerLiter: 4, condition: "GOOD", facilities: [] },
    driver: { status: "AVAILABLE" },
    maintenanceConflict: false,
    vehicleConflict: false,
    driverConflict: false,
    weights: { capacity: 30, availability: 25, distance: 20, maintenance: 15, driver: 10 }
  });
  assert.equal(result.availabilityScore, 0);
});
