import { Router } from "express";
import { databaseHealth } from "../config/db.js";

export const healthRoutes = Router();

healthRoutes.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "BIT SmartFleet health",
    data: {
      server: "ok",
      database: databaseHealth(),
      databaseProvider: "MongoDB Atlas"
    }
  });
});
