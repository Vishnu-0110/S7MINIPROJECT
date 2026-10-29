import { Driver, Trip, Vehicle, VehicleRequest } from "../models/index.js";
import { indiaDayRange } from "../utils/indiaTime.js";

const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function label(value) {
  return String(value || "—").replaceAll("_", " ");
}

function listLines(items, formatter, emptyMessage) {
  if (!items.length) return emptyMessage;
  return items.slice(0, 8).map((item, index) => `${index + 1}. ${formatter(item)}`).join("\n");
}

const tripTypeAliases = [
  ["industrial", "Industrial Visit"],
  ["conference", "Conference"],
  ["field", "Field Trip"],
  ["placement", "Placement"],
  ["outstation", "Outstation Trip"],
  ["event", "Event"]
];

export function parseTripPrompt(prompt) {
  const text = prompt.toLowerCase();
  const passengerMatch = text.match(/(\d+)\s*(students|people|passengers|staff)?/);
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  const destinationMatch = text.match(/(?:in|to|visit|for)\s+([a-z\s]+?)(?:\s+next|\s+at|\s+on|$)/i);
  const tripType = tripTypeAliases.find(([key]) => text.includes(key))?.[1] || "Other Official Trip";

  return {
    tripType,
    passengerCount: passengerMatch ? Number(passengerMatch[1]) : undefined,
    destination: destinationMatch ? destinationMatch[1].trim().replace(/\s+/g, " ") : "",
    dateText: text.includes("next monday") ? "Next Monday" : "",
    timeText: timeMatch ? `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ""} ${timeMatch[3].toUpperCase()}` : "",
    purpose: tripType,
    fallbackMode: true
  };
}

export async function answerQuery({ prompt, user }) {
  const text = prompt.toLowerCase();
  const isAdmin = user.role === "TRANSPORT_ADMIN";
  const isFaculty = user.role === "FACULTY_STAFF";
  const isCoordinator = user.role === "DEPARTMENT_COORDINATOR";
  const isDriver = user.role === "DRIVER";
  const { start, end } = indiaDayRange();

  if (isAdmin && text.includes("available") && text.includes("vehicle")) {
    const vehicles = await Vehicle.find({ status: "AVAILABLE" }).select("vehicleId name type capacity fuelLevel condition status");
    return {
      answer: `There ${vehicles.length === 1 ? "is" : "are"} ${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} currently available.\n\n${listLines(vehicles, (vehicle) => `${vehicle.vehicleId} (${vehicle.name}) — ${vehicle.type}, capacity ${vehicle.capacity}, fuel ${vehicle.fuelLevel}%, condition ${label(vehicle.condition)}.`, "No vehicles are currently marked as available.")}`,
      data: vehicles,
      fallbackMode: true
    };
  }
  if (isAdmin && (text.includes("suitable") || text.includes("capacity"))) {
    const passengerMatch = text.match(/(\d+)/);
    const minCapacity = passengerMatch ? Number(passengerMatch[1]) : 1;
    const vehicles = await Vehicle.find({ status: "AVAILABLE", capacity: { $gte: minCapacity } })
      .select("vehicleId name type capacity condition")
      .sort({ capacity: 1 });
    return {
      answer: `${vehicles.length} available vehicle${vehicles.length === 1 ? "" : "s"} can carry at least ${minCapacity} passenger${minCapacity === 1 ? "" : "s"}. They are ordered from the smallest suitable capacity upward.\n\n${listLines(vehicles, (vehicle) => `${vehicle.vehicleId} (${vehicle.name}) — ${vehicle.type}, capacity ${vehicle.capacity}, condition ${label(vehicle.condition)}.`, `No available vehicle currently meets the ${minCapacity}-passenger requirement.`)}`,
      data: vehicles,
      fallbackMode: true
    };
  }
  const isRequestQuestion = (text.includes("pending") && (text.includes("request") || text.includes("approval")))
    || (isCoordinator && text.includes("approval"))
    || (isFaculty && text.includes("request"));
  if (isRequestQuestion) {
    const query = isFaculty && !text.includes("pending") ? {} : { status: "PENDING_APPROVAL" };
    if (isFaculty) query.facultyId = user._id;
    if (isCoordinator) query.departmentId = user.departmentId;
    if (isDriver) return { answer: "Drivers do not have request approvals. Ask about your assigned trips instead.", data: [], fallbackMode: true };
    const requests = await VehicleRequest.find(query).select("requestId tripType destination departureTime passengerCount priority status").sort({ departureTime: 1 }).limit(20);
    const requestLabel = isCoordinator ? "department requests awaiting approval" : isFaculty ? "your pending requests" : "pending requests";
    return {
      answer: `${requests.length} ${requestLabel} found.\n\n${listLines(requests, (request) => `${request.requestId} — ${label(request.tripType)} to ${request.destination}; ${request.passengerCount} passengers; ${label(request.priority)} priority; departure ${indiaDateTime.format(request.departureTime)}; status ${label(request.status)}.`, isFaculty ? "You do not have any matching requests." : "There are no matching department requests at the moment.")}`,
      data: requests,
      fallbackMode: true
    };
  }
  if (text.includes("trip") || text.includes("scheduled") || text.includes("active")) {
    const query = {};
    if (isFaculty) query.facultyId = user._id;
    if (isCoordinator) query.departmentId = user.departmentId;
    if (isDriver) {
      const driver = await Driver.findOne({ userId: user._id }).select("_id");
      if (!driver) return { answer: "No driver profile is linked to your account.", data: [], fallbackMode: true };
      query.driverId = driver._id;
    }
    if (text.includes("today")) query.scheduledStartTime = { $gte: start, $lt: end };
    if (text.includes("active")) query.status = { $in: ["TRIP_STARTED", "TRIP_RESUMED"] };
    const trips = await Trip.find(query).select("tripId requestId source destination scheduledStartTime scheduledEndTime passengerCount status vehicleId").populate("requestId", "requestId").populate("vehicleId", "vehicleId registrationNumber type").sort({ scheduledStartTime: 1 }).limit(20);
    const tripLabel = isDriver ? "your assigned trips" : isCoordinator ? "department trips" : isFaculty ? "your trips" : "trips";
    return {
      answer: `${trips.length} ${tripLabel} found.\n\n${listLines(trips, (trip) => `${trip.requestId?.requestId || trip.tripId} — ${trip.source} to ${trip.destination}; ${trip.passengerCount} passengers; starts ${indiaDateTime.format(trip.scheduledStartTime)}; ends ${indiaDateTime.format(trip.scheduledEndTime)}; vehicle ${trip.vehicleId?.vehicleId || "not assigned"}${trip.vehicleId?.registrationNumber ? ` (${trip.vehicleId.registrationNumber})` : ""}; status ${label(trip.status)}.`, "No matching trips were found.")}`,
      data: trips,
      fallbackMode: true
    };
  }
  const roleGuidance = isAdmin
    ? "Ask about available vehicles, vehicle capacity, pending requests, or scheduled trips."
    : isCoordinator
      ? "Ask about pending department approvals or department trips."
      : isDriver
        ? "Ask about your trips for today, your active trip, or your next assigned trip."
        : "Ask about your pending requests, request status, or upcoming trips.";
  return {
    answer: `I can help with your role-specific transport work. ${roleGuidance}`,
    data: parseTripPrompt(prompt),
    fallbackMode: true
  };
}
