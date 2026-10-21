export function ok(res, message, data = {}, status = 200, extra = {}) {
  return res.status(status).json({ success: true, message, data, ...extra });
}

export function fail(res, message, status = 500, errors = []) {
  return res.status(status).json({ success: false, message, errors });
}

export class ApiError extends Error {
  constructor(message, status = 500, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
