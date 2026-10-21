import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV || "development",
  demoMode: process.env.DEMO_MODE === "true",
  gpsIntervalSeconds: Number(process.env.GPS_INTERVAL_SECONDS || 20),
  aiApiKey: process.env.AI_API_KEY,
  seedReset: process.env.SEED_RESET === "true"
};

export function assertRequiredEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push("MONGO_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");

  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;
    if (env.nodeEnv === "production") {
      throw new Error(message);
    }
    console.warn(message);
  }
}
