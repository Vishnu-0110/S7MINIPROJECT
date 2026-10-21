export function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function displayRef(value, fallback = "-") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.name || value.vehicleId || value.driverId || value.tripId || value.requestId || value.code || value._id || fallback;
}

export function statusClass(status) {
  if (["APPROVED", "SCHEDULED", "AVAILABLE", "COMPLETED", "TRIP_COMPLETED"].includes(status)) return "badge-success";
  if (["PENDING_APPROVAL", "ASSIGNED", "REQUESTED"].includes(status)) return "badge-warning";
  if (["REJECTED", "CANCELLED", "BREAKDOWN", "EMERGENCY", "VEHICLE_REASSIGNMENT_REQUIRED"].includes(status)) return "badge-error";
  if (["TRIP_STARTED", "IN_TRIP"].includes(status)) return "badge-info";
  return "badge-ghost";
}
