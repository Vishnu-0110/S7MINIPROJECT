import axios from "axios";
import { useAuthStore } from "../store/authStore.js";

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
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || "Request failed";
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().clearSession();
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") window.location.assign("/login");
    }
    return Promise.reject(new Error(message));
  }
);
