import { create } from "zustand";
import { api } from "../lib/api.js";

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  loading: false,
  error: "",
  initializedFor: "",
  markingAll: false,
  load: async (userId, force = false) => {
    if (!userId || (get().loading && !force)) return;
    set({ loading: true, error: "" });
    try {
      const result = await api.get("/notifications?limit=100", { silentToast: true });
      set({ notifications: result.data || [], initializedFor: String(userId) });
    } catch (error) {
      set({ error: error.message || "Could not load notifications." });
    } finally {
      set({ loading: false });
    }
  },
  receive: (notification) => {
    if (!notification?._id) return;
    set((state) => ({ notifications: [notification, ...state.notifications.filter((item) => item._id !== notification._id)] }));
  },
  applyRead: (notification) => {
    if (!notification?._id) return;
    set((state) => ({ notifications: state.notifications.map((item) => item._id === notification._id ? { ...item, ...notification, isRead: true } : item) }));
  },
  applyAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, isRead: true })) })),
  markRead: async (id) => {
    const original = get().notifications;
    const target = original.find((item) => item._id === id);
    if (!target || target.isRead) return;
    set({ notifications: original.map((item) => item._id === id ? { ...item, isRead: true } : item), error: "" });
    try {
      const result = await api.patch(`/notifications/${id}/read`, {}, { silentToast: true });
      set((state) => ({ notifications: state.notifications.map((item) => item._id === id ? result.data : item) }));
    } catch (error) {
      set({ notifications: original, error: error.message || "Could not mark notification as read." });
      throw error;
    }
  },
  markAllRead: async () => {
    if (get().markingAll || !get().notifications.some((item) => !item.isRead)) return;
    const original = get().notifications;
    set({ notifications: original.map((item) => ({ ...item, isRead: true })), markingAll: true, error: "" });
    try {
      await api.patch("/notifications/read-all", {}, { silentToast: true });
    } catch (error) {
      set({ notifications: original, error: error.message || "Could not mark all notifications as read." });
      throw error;
    } finally {
      set({ markingAll: false });
    }
  },
  clear: () => set({ notifications: [], loading: false, error: "", initializedFor: "", markingAll: false })
}));
