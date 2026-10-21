import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore.js";

let socket;
const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const defaultSocketUrl = `http://${runtimeHost}:5001`;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
      autoConnect: false,
      auth: { token: useAuthStore.getState().token }
    });
  }
  return socket;
}

export function connectSocket() {
  const active = getSocket();
  active.auth = { token: useAuthStore.getState().token };
  if (!active.connected) active.connect();
  return active;
}
