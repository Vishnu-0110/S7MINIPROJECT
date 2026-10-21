import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

const app = createApp();

test("health endpoint reports server health without authentication", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.server, "ok");
});

test("protected endpoints reject anonymous callers", async () => {
  const response = await request(app).get("/api/trips");
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Unauthorized");
});
