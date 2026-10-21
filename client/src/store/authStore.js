import { create } from "zustand";

function readSavedSession() {
  try {
    return JSON.parse(sessionStorage.getItem("bit-smartfleet-auth") || "null");
  } catch {
    sessionStorage.removeItem("bit-smartfleet-auth");
    return null;
  }
}

const saved = readSavedSession();

export const useAuthStore = create((set) => ({
  user: saved?.user || null,
  token: saved?.token || "",
  setSession: ({ user, token }) => {
    sessionStorage.setItem("bit-smartfleet-auth", JSON.stringify({ user, token }));
    set({ user, token });
  },
  clearSession: () => {
    sessionStorage.removeItem("bit-smartfleet-auth");
    set({ user: null, token: "" });
  }
}));
