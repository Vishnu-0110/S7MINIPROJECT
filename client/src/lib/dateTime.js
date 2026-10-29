const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
});

const indiaDateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function indiaDateInputValue(value = new Date()) {
  const parts = Object.fromEntries(indiaDateParts.formatToParts(new Date(value))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function indiaDateTimeToIso(dateValue, timeValue) {
  return new Date(`${dateValue}T${timeValue}:00+05:30`).toISOString();
}

export function formatIndiaDateTime(value, fallback = "Not scheduled") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : indiaDateTime.format(date);
}
