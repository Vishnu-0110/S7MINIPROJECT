import crypto from "crypto";

export function humanId(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function makeTripOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}
