import { databaseHealth } from "../config/db.js";
import { ApiError } from "../utils/apiResponse.js";

export function requireDatabase(req, _res, next) {
  const hasBearerToken = (req.headers.authorization || "").startsWith("Bearer ");
  const isCredentialRequest = /\/auth\/(login|register)$/.test(req.path);
  // Let the authentication middleware return 401 for anonymous protected calls.
  // Login and registration need the database and should fail clearly if it is offline.
  if (!hasBearerToken && !isCredentialRequest) return next();
  if (databaseHealth() !== "connected") {
    return next(new ApiError("Database is reconnecting. Please retry in a moment.", 503));
  }
  return next();
}
