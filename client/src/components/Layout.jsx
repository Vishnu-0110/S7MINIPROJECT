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
  ShieldAlert,
  FileText,
  Users,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "main" },
  { to: "/driver", label: "My Driving", icon: Bus, group: "main", roles: ["DRIVER"] },
  { to: "/requests", label: "Requests", icon: ClipboardCheck, group: "main" },
  { to: "/request/new", label: "New Request", icon: Bus, group: "main", roles: ["FACULTY_STAFF"] },
  { to: "/approvals", label: "Approvals", icon: ClipboardCheck, group: "main", roles: ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"] },
  { to: "/trips", label: "Trips", icon: QrCode, group: "main" },
  { to: "/fuel", label: "Fuel Log", icon: Fuel, group: "main", roles: ["DRIVER"] },
  { to: "/vehicles", label: "Vehicles", icon: Bus, group: "manage", roles: ["TRANSPORT_ADMIN"] },
  { to: "/drivers", label: "Drivers", icon: Users, group: "manage", roles: ["TRANSPORT_ADMIN"] },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, group: "manage", roles: ["TRANSPORT_ADMIN"] },
  { to: "/fuel", label: "Fuel Logs", icon: Fuel, group: "manage", roles: ["TRANSPORT_ADMIN"] },
  { to: "/expenses", label: "Expenses", icon: BarChart3, group: "manage", roles: ["TRANSPORT_ADMIN"] },
  { to: "/tracking", label: "Track Vehicles", icon: Map, group: "more", roles: ["FACULTY_STAFF", "TRANSPORT_ADMIN"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, group: "more", roles: ["DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"] },
  { to: "/reports", label: "Reports", icon: FileText, group: "more", roles: ["TRANSPORT_ADMIN"] },
  { to: "/emergencies", label: "Emergency Alerts", icon: ShieldAlert, group: "more", roles: ["DRIVER", "DEPARTMENT_COORDINATOR", "TRANSPORT_ADMIN"] },
  { to: "/vehicle-documents", label: "Vehicle Documents", icon: FileText, group: "more", roles: ["TRANSPORT_ADMIN"] },
  { to: "/users", label: "Users", icon: Users, group: "more", roles: ["TRANSPORT_ADMIN"] },
  { to: "/departments", label: "Departments", icon: Users, group: "more", roles: ["TRANSPORT_ADMIN"] },
  { to: "/ai", label: "Help Assistant", icon: Bot, group: "more" },
];

export default function Layout() {
  const { user, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleNav = nav.filter((item) => !item.roles || item.roles.includes(user?.role));
  const mainNav = visibleNav.filter((item) => item.group === "main");
  const managementNav = visibleNav.filter((item) => item.group === "manage");
  const moreNav = visibleNav.filter((item) => item.group === "more");
  const [menuOpen, setMenuOpen] = useState(false);
  const groupIsActive = (items) => items.some((item) => item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to));

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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">BIT SmartFleet</p>
              <h1 className="truncate text-lg font-bold text-slate-950">Transport management</h1>
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
            <div className="mb-8 flex items-center justify-between gap-3 px-2 pt-2">
              <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-primary text-white shadow-lg shadow-primary/30">
                <Bus className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="font-bold tracking-tight text-white">BIT SmartFleet</p>
                <p className="text-xs text-slate-400">Centralized transport</p>
              </div>
              </div>
              <button type="button" className="btn btn-sm gap-1 rounded-xl border-0 bg-white/10 px-3 text-slate-100 hover:bg-white/20 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
                <span>Close</span>
              </button>
            </div>
            <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Main menu</div>
            <nav className="max-h-[calc(100vh-140px)] space-y-1 overflow-y-auto pr-1">
              <NavigationItems items={mainNav} onNavigate={() => setMenuOpen(false)} />
              {managementNav.length ? <NavigationGroup title="Manage fleet" items={managementNav} isActive={groupIsActive(managementNav)} onNavigate={() => setMenuOpen(false)} /> : null}
              {moreNav.length ? <NavigationGroup title="More tools" items={moreNav} isActive={groupIsActive(moreNav)} onNavigate={() => setMenuOpen(false)} /> : null}
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}

function NavigationGroup({ title, items, isActive, onNavigate }) {
  return (
    <details className="group mt-3" open={isActive}>
      <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-white/5 hover:text-slate-300">
        {title}
      </summary>
      <div className="mt-1 space-y-1"><NavigationItems items={items} onNavigate={onNavigate} /></div>
    </details>
  );
}

function NavigationItems({ items, onNavigate }) {
  return items.map((item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-gradient-to-r from-primary to-teal-600 text-white shadow-lg shadow-primary/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`
        }
      >
        <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
        {item.label}
      </NavLink>
    );
  });
}
