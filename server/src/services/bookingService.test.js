import test from "node:test";
import assert from "node:assert/strict";
import { hasOverlap } from "./bookingService.js";

test("hasOverlap blocks intersecting schedules", () => {
  assert.equal(
    hasOverlap("2026-09-12T08:00:00.000Z", "2026-09-12T12:00:00.000Z", "2026-09-12T11:00:00.000Z", "2026-09-12T14:00:00.000Z"),
    true
  );
});

test("hasOverlap allows adjacent schedules", () => {
  assert.equal(
    hasOverlap("2026-09-12T08:00:00.000Z", "2026-09-12T12:00:00.000Z", "2026-09-12T12:00:00.000Z", "2026-09-12T14:00:00.000Z"),
    false
  );
});
