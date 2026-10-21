export function humanId(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function makeQrToken(tripId) {
  const secretPart = Math.random().toString(36).slice(2, 12);
  return `${tripId}-${secretPart}`.toUpperCase();
}
