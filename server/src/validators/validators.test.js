import test from "node:test";
import assert from "node:assert/strict";
import { gpsSchema } from "./tripValidators.js";
import { requestCreateSchema } from "./requestValidators.js";
import { emergencySchema } from "./operationsValidators.js";

test("GPS validation rejects coordinates outside real-world bounds", () => {
  const result = gpsSchema.safeParse({ body: { latitude: 120, longitude: 77 } });
  assert.equal(result.success, false);
});

test("request validation rejects a return time before departure", () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() - 60 * 1000);
  const result = requestCreateSchema.safeParse({
    body: {
      tripType: "Industrial Visit",
      purpose: "Industry visit",
      source: "BIT",
      destination: "Coimbatore",
      passengerCount: 20,
      date: start,
      departureTime: start,
      returnTime: end,
      priority: "Normal"
    }
  });
  assert.equal(result.success, false);
});

test("request validation accepts explicit required facilities", () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const result = requestCreateSchema.safeParse({
    body: {
      tripType: "Industrial Visit",
      purpose: "Accessible industry visit",
      source: "BIT",
      destination: "Coimbatore",
      passengerCount: 20,
      date: start,
      departureTime: start,
      returnTime: end,
      priority: "Normal",
      requiredFacilities: ["wheelchair access"]
    }
  });
  assert.equal(result.success, true);
});

test("emergency validation requires an assigned trip and valid location", () => {
  const result = emergencySchema.safeParse({
    body: { tripId: "trip-1", message: "Vehicle requires immediate assistance", location: { latitude: 120, longitude: 77 } }
  });
  assert.equal(result.success, false);
});
