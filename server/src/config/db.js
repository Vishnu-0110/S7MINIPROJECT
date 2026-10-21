import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  if (!env.mongoUri) {
    throw new Error("MongoDB Atlas connection failed. MONGO_URI is not configured.");
  }

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      dbName: "bit_smartfleet"
    });
    console.log("MongoDB Atlas connected");
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB Atlas connection failed.", error.message);
    throw error;
  }
}

export function databaseHealth() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export async function closeDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}
