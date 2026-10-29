const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
});

export function formatIndiaDateTime(value, fallback = "Not scheduled") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : indiaDateTime.format(date);
}

export function formatIndiaSchedule(start, end) {
  const startLabel = formatIndiaDateTime(start);
  if (!end) return startLabel;
  const endLabel = formatIndiaDateTime(end);
  return `${startLabel} – ${endLabel}`;
}
