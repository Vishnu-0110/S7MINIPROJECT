import { create } from "zustand";

let nextId = 1;

export const useToastStore = create((set) => ({
  toasts: [],
  push: ({ title, message, tone = "success" }) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, title, message, tone }] }));
    window.setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 5000);
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));
