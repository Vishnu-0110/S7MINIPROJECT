import { Trip, Vehicle, VehicleRequest } from "../models/index.js";

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
  if (text.includes("available") && text.includes("vehicle")) {
    const vehicles = await Vehicle.find({ status: "AVAILABLE" }).select("vehicleId name type capacity fuelLevel condition status");
    return { answer: `${vehicles.length} vehicles are currently available.`, data: vehicles, fallbackMode: true };
  }
  if (text.includes("suitable") || text.includes("capacity")) {
    const passengerMatch = text.match(/(\d+)/);
    const minCapacity = passengerMatch ? Number(passengerMatch[1]) : 1;
    const vehicles = await Vehicle.find({ status: "AVAILABLE", capacity: { $gte: minCapacity } })
      .select("vehicleId name type capacity condition")
      .sort({ capacity: 1 });
    return { answer: `${vehicles.length} vehicles can carry ${minCapacity} passengers.`, data: vehicles, fallbackMode: true };
  }
  if (text.includes("pending request")) {
    const query = user.role === "FACULTY_STAFF" ? { facultyId: user._id, status: "PENDING_APPROVAL" } : { status: "PENDING_APPROVAL" };
    const requests = await VehicleRequest.find(query).select("requestId tripType destination date status");
    return { answer: `${requests.length} pending requests found.`, data: requests, fallbackMode: true };
  }
  if (text.includes("scheduled today")) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = await Trip.countDocuments({ scheduledStartTime: { $gte: start, $lt: end } });
    return { answer: `${count} trips are scheduled today.`, data: { count }, fallbackMode: true };
  }
  return {
    answer: "Fallback AI could not answer that from the available database intents.",
    data: parseTripPrompt(prompt),
    fallbackMode: true
  };
}
