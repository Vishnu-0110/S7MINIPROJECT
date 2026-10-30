import { Expense, FuelLog, Trip } from "../models/index.js";

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
    .populate("requestId", "requestId")
    .populate("facultyId", "name email")
    .populate("departmentId", "name code")
    .populate("vehicleId", "vehicleId registrationNumber")
    .populate({ path: "driverId", populate: { path: "userId", select: "name email" } })
    .sort({ scheduledStartTime: -1 })
    .limit(1000);

  const rows = [
    ["Request ID", "Faculty", "Department", "Vehicle", "Driver", "Destination", "Scheduled Start", "Distance", "Fuel Used", "Fuel Efficiency", "Status"],
    ...trips.map((trip) => [
      trip.requestId?.requestId || trip.tripId,
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

export async function tripCosts(req, res) {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const trips = await Trip.find(query)
    .populate("requestId", "requestId")
    .populate("vehicleId", "vehicleId registrationNumber")
    .populate({ path: "driverId", populate: { path: "userId", select: "name" } })
    .sort({ scheduledStartTime: -1 })
    .limit(500)
    .lean();
  const ids = trips.map((trip) => trip._id);
  const [fuelTotals, expenseTotals] = await Promise.all([
    FuelLog.aggregate([{ $match: { tripId: { $in: ids } } }, { $group: { _id: "$tripId", total: { $sum: "$totalAmount" }, litres: { $sum: "$quantity" } } }]),
    Expense.aggregate([{ $match: { tripId: { $in: ids } } }, { $group: { _id: "$tripId", total: { $sum: "$amount" } } }])
  ]);
  const fuelByTrip = new Map(fuelTotals.map((item) => [String(item._id), item]));
  const expensesByTrip = new Map(expenseTotals.map((item) => [String(item._id), item.total]));
  const rows = trips.map((trip) => {
    const fuel = fuelByTrip.get(String(trip._id)) || { total: 0, litres: 0 };
    const nonFuelExpenses = expensesByTrip.get(String(trip._id)) || 0;
    const totalCost = Number(fuel.total || 0) + Number(nonFuelExpenses || 0);
    const distance = Number(trip.distance || 0);
    return {
      _id: trip._id,
      tripId: trip.requestId?.requestId || trip.tripId,
      vehicle: trip.vehicleId?.registrationNumber || trip.vehicleId?.vehicleId || "—",
      driver: trip.driverId?.userId?.name || "—",
      destination: trip.destination,
      status: trip.status,
      distance,
      fuelLitres: Number(fuel.litres || 0),
      fuelCost: Number(fuel.total || 0),
      otherExpenses: Number(nonFuelExpenses || 0),
      totalCost,
      costPerKm: distance > 0 ? Number((totalCost / distance).toFixed(2)) : null
    };
  });
  return res.json({ success: true, message: "Trip cost summary", data: rows });
}
