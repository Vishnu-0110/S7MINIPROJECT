import test from "node:test";
import assert from "node:assert/strict";
import { makeQrToken } from "./id.js";

test("QR tokens are opaque and unique per generation", () => {
  const first = makeQrToken("BIT-TRIP-1");
  const second = makeQrToken("BIT-TRIP-1");
  assert.notEqual(first, second);
  assert.equal(first.includes("BIT-TRIP-1"), false);
  assert.equal(first.length >= 40, true);
});
