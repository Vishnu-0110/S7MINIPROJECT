import {
  BarChart3,
  Bell,
  Bot,
  Bus,
  ClipboardCheck,
  Fuel,
  LayoutDashboard,
  LogOut,
  Map,
  QrCode,
  Settings,
  ShieldAlert,
  FileText,
  Users,
  Wrench
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/driver", label: "Driver Workspace", icon: Bus, roles: ["DRIVER"] },
  { to: "/requests", label: "Requests", icon: ClipboardCheck },
  { to: "/request/new", label: "Vehicle Request", icon: Bus, roles: ["FACULTY_STAFF", "SUPER_ADMIN"] },
  { to: "/approvals", label: "Approval Center", icon: ClipboardCheck, roles: ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/trips", label: "Trips", icon: QrCode },
  { to: "/tracking", label: "Live Tracking", icon: Map, roles: ["FACULTY_STAFF", "TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/vehicles", label: "Vehicles", icon: Bus, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/drivers", label: "Drivers", icon: Users, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/fuel", label: "Fuel", icon: Fuel, roles: ["DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/expenses", label: "Expenses", icon: BarChart3, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/reports", label: "Reports", icon: FileText, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/emergencies", label: "Emergency", icon: ShieldAlert, roles: ["DRIVER", "TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/vehicle-documents", label: "Documents", icon: FileText, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/users", label: "Users", icon: Users, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/departments", label: "Departments", icon: Users, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/ai", label: "AI Assistant", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["TRANSPORT_ADMIN", "SUPER_ADMIN"] }
];

export default function Layout() {
  const { user, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const visibleNav = nav.filter((item) => !item.roles || item.roles.includes(user?.role));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen">
      <div className="drawer lg:drawer-open">
        <input id="main-drawer" type="checkbox" className="drawer-toggle" checked={menuOpen} onChange={(event) => setMenuOpen(event.target.checked)} />
        <div className="drawer-content min-w-0">
          <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-2 backdrop-blur-xl lg:px-8">
            <label htmlFor="main-drawer" className="btn btn-square btn-ghost rounded-xl lg:hidden" aria-label="Open menu" aria-expanded={menuOpen}>
              <Bus className="h-5 w-5" />
            </label>
            <div className="hidden min-w-0 sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Operations console</p>
              <h1 className="truncate text-lg font-bold text-slate-950">Fleet command center</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NavLink className="btn btn-square btn-ghost rounded-xl" to="/notifications" aria-label="Notifications"><Bell className="h-5 w-5" /></NavLink>
              <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">{user?.name?.slice(0, 1)?.toUpperCase() || "U"}</div>
                <div className="max-w-32">
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{user?.role?.replaceAll("_", " ")}</p>
                </div>
              </div>
              <button className="btn btn-square btn-ghost rounded-xl text-slate-500 hover:bg-error/10 hover:text-error" onClick={() => { clearSession(); navigate("/login"); }} aria-label="Logout"><LogOut className="h-4 w-4" /></button>
            </div>
          </header>
          <main className="mx-auto w-full min-w-0 max-w-[1800px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <div className="drawer-side z-30">
          <label htmlFor="main-drawer" aria-label="Close menu" className="drawer-overlay" onClick={() => setMenuOpen(false)} />
          <aside className="min-h-full w-[min(18rem,calc(100vw-1rem))] bg-slate-950 p-4 text-slate-300">
            <div className="mb-8 flex items-center gap-3 px-2 pt-2">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-primary text-white shadow-lg shadow-primary/30">
                <Bus className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-bold tracking-tight text-white">BIT SmartFleet</p>
                <p className="text-xs text-slate-400">Centralized transport</p>
              </div>
            </div>
            <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
            <nav className="max-h-[calc(100vh-140px)] space-y-1 overflow-y-auto pr-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-gradient-to-r from-primary to-teal-600 text-white shadow-lg shadow-primary/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`
                    }
                  >
                    <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
