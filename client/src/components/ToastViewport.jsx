import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useToastStore } from "../store/toastStore.js";

export default function ToastViewport() {
  const { toasts, remove } = useToastStore();
  return <div className="toast-viewport" aria-live="polite" aria-atomic="true">
    {toasts.map((toast) => {
      const Icon = toast.tone === "error" ? TriangleAlert : toast.tone === "info" ? Info : CheckCircle2;
      return <article className={`app-toast app-toast-${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{toast.title}</p><p className="mt-0.5 text-sm opacity-90">{toast.message}</p></div>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => remove(toast.id)} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
      </article>;
    })}
  </div>;
}
