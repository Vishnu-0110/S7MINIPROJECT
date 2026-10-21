import { fail } from "../utils/apiResponse.js";

export function notFound(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || (error.name === "MulterError" || /document|file size/i.test(error.message || "") ? 400 : 500);
  const message = status === 500 ? "Internal server error" : error.message;
  if (status === 500) console.error(error);
  return fail(res, message, status, error.errors || []);
}
