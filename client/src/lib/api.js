import axios from "axios";
import { useAuthStore } from "../store/authStore.js";
import { useToastStore } from "../store/toastStore.js";

const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const defaultApiUrl = `http://${runtimeHost}:5001/api`;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (!response.config?.silentToast && method && !["get", "head", "options"].includes(method) && response.data?.message) {
      useToastStore.getState().push({ title: "Completed", message: response.data.message, tone: "success" });
    }
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || "Request failed";
    const method = error.config?.method?.toLowerCase();
    if (!error.config?.silentToast && method && !["get", "head", "options"].includes(method)) {
      useToastStore.getState().push({ title: "Action needs attention", message, tone: "error" });
    }
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().clearSession();
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") window.location.assign("/login");
    }
    return Promise.reject(new Error(message));
  }
);
