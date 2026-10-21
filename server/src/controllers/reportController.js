import { Trip } from "../models/index.js";

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export async function tripsCsv(req, res) {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const trips = await Trip.find(query)
    .populate("facultyId", "name email")
    .populate("departmentId", "name code")
    .populate("vehicleId", "vehicleId registrationNumber")
    .populate({ path: "driverId", populate: { path: "userId", select: "name email" } })
    .sort({ scheduledStartTime: -1 })
    .limit(1000);

  const rows = [
    ["Trip ID", "Faculty", "Department", "Vehicle", "Driver", "Destination", "Scheduled Start", "Distance", "Fuel Used", "Fuel Efficiency", "Status"],
    ...trips.map((trip) => [
      trip.tripId,
      trip.facultyId?.name,
      trip.departmentId?.code,
      trip.vehicleId?.vehicleId,
      trip.driverId?.userId?.name,
      trip.destination,
      trip.scheduledStartTime?.toISOString(),
      trip.distance,
      trip.fuelUsed,
      trip.fuelEfficiency,
      trip.status
    ])
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=bit-smartfleet-trips.csv");
  res.send(rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}
