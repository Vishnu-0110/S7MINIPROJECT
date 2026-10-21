import test from "node:test";
import assert from "node:assert/strict";
import { approvalChainForTripType } from "./approvalService.js";

test("approval chains match supported trip types", () => {
  assert.deepEqual(approvalChainForTripType("Local Official Visit"), ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]);
  assert.deepEqual(approvalChainForTripType("Industrial Visit"), ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]);
  assert.deepEqual(approvalChainForTripType("Outstation Trip"), ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]);
});

test("unknown trip types still require department and transport approval", () => {
  assert.deepEqual(approvalChainForTripType("Other Official Trip"), ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"]);
});
