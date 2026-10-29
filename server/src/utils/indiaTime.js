const timeZone = "Asia/Kolkata";

// HTML date/time controls do not include an offset. Interpret their bare values
// as India time so a server running in UTC cannot move the requested calendar day.
export function parseIndiaDate(value) {
  if (value instanceof Date || typeof value !== "string") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(`${value}:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return new Date(`${value}+05:30`);
  return new Date(value);
}

function partsFor(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function indiaDateKey(date = new Date()) {
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function indiaDayRange(date = new Date()) {
  const key = indiaDateKey(date);
  const start = new Date(`${key}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { key, start, end };
}

export function isTodayInIndia(date) {
  return indiaDateKey(date) === indiaDateKey();
}

export function formatIndiaTripTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(date));
}
