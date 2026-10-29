import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requireDatabase } from "./middleware/database.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { fleetRoutes } from "./routes/fleetRoutes.js";
import { requestRoutes } from "./routes/requestRoutes.js";
import { tripRoutes } from "./routes/tripRoutes.js";
import { operationRoutes } from "./routes/operationRoutes.js";
import { aiRoutes } from "./routes/aiRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { driverLeaveRoutes } from "./routes/driverLeaveRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.use(helmet());
  const configuredOrigins = env.clientUrl.split(",").map((origin) => origin.trim()).filter(Boolean);
  const allowedOrigins = new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
  app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

  app.use("/api/health", healthRoutes);
  app.use("/api", requireDatabase);
  app.use("/api/auth", authRoutes);
  app.use("/api", fleetRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/trips", tripRoutes);
  app.use("/api", operationRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/driver-leaves", driverLeaveRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
