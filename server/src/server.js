import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { assertRequiredEnv, env } from "./config/env.js";
import { closeDb, connectDb, databaseHealth } from "./config/db.js";
import { configureSockets } from "./sockets/index.js";
import { startJobs } from "./jobs/maintenanceJob.js";

assertRequiredEnv();

const app = createApp();
const server = http.createServer(app);
const socketOrigins = [
  ...new Set([
    ...env.clientUrl.split(",").map((origin) => origin.trim()).filter(Boolean),
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ])
];
const io = new Server(server, {
  cors: { origin: socketOrigins, credentials: true }
});

app.set("io", io);
configureSockets(io);

let retryTimer;
let jobsStarted = false;

async function connectDatabaseInBackground() {
  try {
    await connectDb();
    if (!jobsStarted) {
      startJobs();
      jobsStarted = true;
    }
  } catch (error) {
    console.error("MongoDB Atlas connection failed.");
    console.error(error.message);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connectDatabaseInBackground, 5000);
  }
}

function start() {
  server.listen(env.port, "0.0.0.0", () => {
    console.log("========================================");
    console.log("BIT SmartFleet Backend");
    console.log(`Server: http://localhost:${env.port}`);
    console.log("Database: MongoDB Atlas");
    console.log(`Status: ${databaseHealth() === "connected" ? "Connected" : "Connecting"}`);
    console.log("========================================");
  });
  connectDatabaseInBackground();
}

process.on("SIGINT", async () => {
  clearTimeout(retryTimer);
  await closeDb();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
  clearTimeout(retryTimer);
  await closeDb();
  server.close(() => process.exit(0));
});

start();
