import test from "node:test";
import assert from "node:assert/strict";
import { makeTripOtp } from "./id.js";

test("trip OTPs are six numeric digits", () => {
  const first = makeTripOtp();
  const second = makeTripOtp();
  assert.match(first, /^\d{6}$/);
  assert.match(second, /^\d{6}$/);
});
