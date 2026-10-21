import { Expense, FuelLog, Maintenance, Trip, Vehicle } from "../models/index.js";

export async function dashboardAnalytics({ departmentId } = {}) {
  const tripMatch = departmentId ? [{ $match: { departmentId } }] : [];
  const scopedTrips = departmentId ? await Trip.find({ departmentId }).select("_id").lean() : [];
  const scopedTripIds = scopedTrips.map((trip) => trip._id);
  const expenseMatch = departmentId ? [{ $match: { tripId: { $in: scopedTripIds } } }] : [];
  const [tripStatus, monthlyTrips, departmentUsage, vehicleUtilization, fuelEfficiency, expenses, maintenanceStats] =
    await Promise.all([
      Trip.aggregate([...tripMatch, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Trip.aggregate([
        ...tripMatch,
        { $group: { _id: { year: { $year: "$scheduledStartTime" }, month: { $month: "$scheduledStartTime" } }, trips: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      Trip.aggregate([
        ...tripMatch,
        { $group: { _id: "$departmentId", trips: { $sum: 1 }, distance: { $sum: "$distance" } } },
        { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "department" } },
        { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } }
      ]),
      Vehicle.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      FuelLog.aggregate(departmentId ? [{ $match: { tripId: { $in: scopedTripIds } } }, { $group: { _id: "$vehicleId", averageEfficiency: { $avg: "$efficiency" }, fuelCost: { $sum: "$totalAmount" } } }] : [{ $group: { _id: "$vehicleId", averageEfficiency: { $avg: "$efficiency" }, fuelCost: { $sum: "$totalAmount" } } }]),
      Expense.aggregate([...expenseMatch, { $group: { _id: "$category", total: { $sum: "$amount" } } }]),
      Maintenance.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);

  const carbon = await Trip.aggregate([
    ...tripMatch,
    { $group: { _id: null, distance: { $sum: "$distance" } } },
    { $project: { _id: 0, distance: 1, estimatedKgCo2: { $multiply: ["$distance", 0.21] } } }
  ]);

  return {
    tripStatus,
    monthlyTrips,
    departmentUsage,
    vehicleUtilization,
    fuelEfficiency,
    expenses,
    maintenanceStats,
    carbon: carbon[0] || { distance: 0, estimatedKgCo2: 0 }
  };
}
