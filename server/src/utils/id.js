import crypto from "crypto";

export function humanId(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function makeQrToken() {
  return crypto.randomBytes(32).toString("base64url");
}
