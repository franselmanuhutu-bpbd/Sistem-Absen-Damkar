import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABEL } from "@/lib/constants";
import {
  LayoutDashboard, ClipboardCheck, Calendar, BarChart3, FileSpreadsheet,
  Users, ShieldAlert, FileDown, UserCog, History, Menu, X, LogOut, Flame,
  UserCircle, Star, Settings, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem =
  | {
      type: "route";
      label: string;
      icon: LucideIcon;
      path: string;
      roles: string[];
    }
  | {
      type: "spacer";
    };

const NAV: NavItem[] = [
  { type:"route", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "operator", "viewer", "komandan", "kasubid", "staff"] },
  { type:"spacer" },
  { type:"route", label: "Absensi Staff", icon: ClipboardCheck, path: "/input-absensi", roles: ["admin", "operator"] },
  { type:"route", label: "Absensi Kasubid", icon: Star, path: "/absensi-kasubid", roles: ["admin", "operator"] },
  { type:"route", label: "Absensi Saya", icon: UserCircle, path: "/absensi-saya", roles: ["staff", "kasubid", "komandan", "operator"] },
  { type:"route", label: "Kalender Absensi", icon: Calendar, path: "/kalender", roles: ["admin", "operator", "viewer"] },
  { type:"spacer" },
  { type:"route", label: "Rekap Bulanan", icon: BarChart3, path: "/rekap-bulanan", roles: ["admin", "operator", "viewer", "kasubid", "komandan"] },
  { type:"route", label: "Rekap Periode", icon: FileSpreadsheet, path: "/rekap-periode", roles: ["admin", "operator", "viewer", "kasubid"] },
  { type:"route", label: "Rekap Kasubid", icon: Star, path: "/rekap-kasubid", roles: ["admin", "operator", "viewer", "kasubid"] },
  { type:"spacer" },
  { type:"route", label: "Data Pegawai", icon: Users, path: "/data-pegawai", roles: ["admin", "operator"] },
  { type:"route", label: "Manajemen Regu", icon: ShieldAlert, path: "/manajemen-regu", roles: ["admin", "operator"] },
  { type:"route", label: "Pengaturan Kasubid", icon: Settings, path: "/pengaturan-kasubid", roles: ["admin"] },
  { type:"spacer" },
  { type:"route", label: "Laporan & Export", icon: FileDown, path: "/laporan-export", roles: ["admin", "operator", "viewer"] },
  { type:"route", label: "User Management", icon: UserCog, path: "/user-management", roles: ["admin"] },
  { type:"route", label: "Audit Log", icon: History, path: "/audit-log", roles: ["admin"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const userRole = (user && typeof user === "object" && user.role) ? user.role : "";
  const links = NAV.filter((n) => n.type === "spacer" || n.roles.includes(userRole));
  const current = NAV.find(
    (n): n is Extract<NavItem, { type: "route" }> =>
      n.type === "route" && loc.pathname.startsWith(n.path),
  );

  const userName = (user && typeof user === "object" && user.name) ? user.name : "User";

  const Sidebar = (
    <div className="flex h-full flex-col bg-[#0F172A] text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-900/40">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-heading text-base font-extrabold tracking-tight text-white leading-none">DAMKAR MIMIKA</p>
          <p className="text-[11px] text-slate-400 mt-1">Sistem Absensi Harian</p>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((n, index) => {
          if (n.type === "spacer") {
            return <div key={`spacer-${index}`} className="border-b border-white/10 my-2" aria-hidden="true" />;
          }

          const Icon = n.icon;
          return (
            <NavLink
              key={n.path}
              to={n.path}
              onClick={() => setOpen(false)}
              data-testid={`nav-${n.path.slice(1)}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-red-600 text-white shadow-md shadow-red-900/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase">
            {userName[0] || "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="text-[11px] text-red-400">{ROLE_LABEL[userRole] || userRole}</p>
          </div>
        </div>
        <Button
          data-testid="logout-btn"
          onClick={logout}
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{Sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{Sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            className="lg:hidden text-slate-700"
            onClick={() => setOpen(true)}
            data-testid="mobile-menu-btn"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div>
            <h1 className="font-heading text-lg font-bold text-slate-900 leading-none">
              {current?.label || "DAMKAR"}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block mt-0.5">
              BPBD Kab. Mimika — Bidang Pemadam Kebakaran
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600">Online</span>
          </div>
        </header>
        <main className="p-4 lg:p-8 animate-fade-up">{children}</main>
      </div>
    </div>
  );
}
