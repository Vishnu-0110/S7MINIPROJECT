const timeZone = "Asia/Kolkata";

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
