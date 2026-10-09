import { useState, useEffect, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import { ROLE_LABEL } from "@/lib/constants";
import {
  LayoutDashboard,
  ClipboardCheck,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  Users,
  ShieldAlert,
  FileDown,
  UserCog,
  History,
  Menu,
  X,
  LogOut,
  Flame,
  UserCircle,
  Star,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  RefreshCw,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkStatusBadge } from "./NetworkStatusBadge";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { motion, AnimatePresence } from "framer-motion";
import { isTauriEnvironment } from "@/lib/api";
import { useUpdater } from "@/components/UpdateChecker";

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
  { type: "route", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "operator", "viewer", "komandan", "kasubid", "staff"] },
  
  { type: "spacer" },
  
  { type: "route", label: "Absensi Staff", icon: ClipboardCheck, path: "/input-absensi", roles: ["admin", "operator"] },
  { type: "route", label: "Absensi Kasubid", icon: Star, path: "/absensi-kasubid", roles: ["admin", "operator"] },
  { type: "route", label: "Absensi Saya", icon: UserCircle, path: "/absensi-saya", roles: ["staff", "kasubid", "komandan", "operator"] },
  { type: "route", label: "Kalender Absensi", icon: Calendar, path: "/kalender", roles: ["admin", "operator", "viewer"] },
  
  { type: "spacer" },
  
  { type: "route", label: "Rekap Bulanan", icon: BarChart3, path: "/rekap-bulanan", roles: ["admin", "operator", "viewer", "kasubid", "komandan"] },
  { type: "route", label: "Rekap Periode", icon: FileSpreadsheet, path: "/rekap-periode", roles: ["admin", "operator", "viewer", "kasubid"] },
  { type: "route", label: "Rekap Kasubid", icon: Star, path: "/rekap-kasubid", roles: ["admin", "operator", "viewer", "kasubid"] },
  
  { type: "spacer" },
  
  { type: "route", label: "Data Pegawai", icon: Users, path: "/data-pegawai", roles: ["admin", "operator"] },
  { type: "route", label: "Manajemen Regu", icon: ShieldAlert, path: "/manajemen-regu", roles: ["admin", "operator"] },
  { type: "route", label: "Pengaturan Kasubid", icon: Settings, path: "/pengaturan-kasubid", roles: ["admin"] },
  
  { type: "spacer" },
  
  { type: "route", label: "Laporan & Export", icon: FileDown, path: "/laporan-export", roles: ["admin", "operator", "viewer"] },
  { type: "route", label: "User Management", icon: UserCog, path: "/user-management", roles: ["admin"] },
  { type: "route", label: "Audit Log", icon: History, path: "/audit-log", roles: ["admin"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { confirmAction } = useNavigationGuard();
  const { updateInfo, isChecking, checkForUpdates, setIsDialogOpen } = useUpdater();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("damkar_sidebar_collapsed") === "true";
    }
    return false;
  });

  const loc = useLocation();
  const userRole = user && typeof user === "object" && user.role ? user.role : "";
  const links = NAV.filter((n, index) => {
    if (n.type === "route") {
      return n.roles.includes(userRole);
    }

    return NAV.slice(index + 1).some(
      (next) => next.type === "route" && next.roles.includes(userRole)
    );
  });
  const current = NAV.find(
    (n): n is Extract<NavItem, { type: "route" }> =>
      n.type === "route" && loc.pathname.startsWith(n.path)
  );

  const userName = user && typeof user === "object" && user.name ? user.name : "User";

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (loc.pathname === path) return;
    e.preventDefault();
    confirmAction(() => {
      navigate(path);
      setOpen(false);
    });
  };

  const handleLogout = () => {
    confirmAction(() => {
      logout();
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem("damkar_sidebar_collapsed", String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 278 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col bg-[#0F172A] text-slate-300 border-r border-white/10 shadow-xl overflow-hidden"
      >
        {/* Header & Logo */}
        <div className={`flex items-center h-16 border-b border-white/10 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          {collapsed ? (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCollapsed(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-900/40"
              title="Buka Sidebar"
              data-testid="sidebar-expand-btn"
            >
              <Flame className="h-5 w-5" />
            </motion.button>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 shadow-md shadow-red-900/40">
                  <Flame className="h-5 w-5 text-white" />
                </div>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="min-w-0"
                >
                  <p className="font-heading text-sm font-extrabold tracking-tight text-white leading-none truncate">
                    DAMKAR MIMIKA
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    Sistem Absensi Harian
                  </p>
                </motion.div>
              </div>

              {/* Collapse button inside sidebar header */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setCollapsed(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Ciutkan Sidebar"
                data-testid="sidebar-collapse-btn"
              >
                <PanelLeftClose className="h-6 w-6" />
              </motion.button>
            </>
          )}
        </div>

        {/* Navigation list */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {links.map((n, index) => {
            if (n.type === "spacer") {
              return (
                <div
                  key={`spacer-${index}`}
                  className={`border-b border-white/10 my-2 ${collapsed ? "mx-2" : "mx-1"}`}
                  aria-hidden="true"
                />
              );
            }

            const Icon = n.icon;
            return (
              <motion.div
                key={`desktop-nav-${n.path}-${collapsed ? "col" : "exp"}`}
                initial={collapsed ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.18,
                  ease: "easeOut",
                  delay: collapsed ? 0 : Math.min(index * 0.015, 0.15),
                }}
              >
                <NavLink
                  to={n.path}
                  onClick={(e) => handleNavClick(e, n.path)}
                  data-testid={`nav-${n.path.slice(1)}`}
                  title={collapsed ? n.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-lg transition-colors duration-150 ${
                      collapsed
                        ? "h-11 w-11 mx-auto justify-center"
                        : "h-11 w-full gap-3 px-3 text-sm font-medium"
                    } ${
                      isActive
                        ? "bg-red-600 text-white shadow-md shadow-red-900/30 font-semibold"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />

                  {!collapsed && (
                    <span className="truncate">{n.label}</span>
                  )}

                  {/* Floating tooltip when collapsed */}
                  {collapsed && (
                    <span className="pointer-events-none fixed left-[84px] z-50 hidden rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-xl border border-slate-700/60 group-hover:block whitespace-nowrap">
                      {n.label}
                    </span>
                  )}
                </NavLink>
              </motion.div>
            );
          })}
        </nav>

        {/* User profile & bottom actions */}
        <div className="border-t border-white/10 p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                data-testid="user-profile-btn-collapsed"
                onClick={() => setChangePwdOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase hover:bg-red-600 transition-colors"
                title={`Pengaturan Akun & Password: ${userName}`}
              >
                {userName[0] || "U"}
              </motion.button>

              {isTauriEnvironment() && (
                updateInfo?.available ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsDialogOpen(true)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors animate-pulse"
                    title={`Pembaruan v${updateInfo.version} tersedia! Klik untuk memasang.`}
                  >
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => checkForUpdates(false)}
                    disabled={isChecking}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors disabled:opacity-50"
                    title="Periksa Pembaruan Sistem"
                  >
                    <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin text-amber-400" : ""}`} />
                  </motion.button>
                )
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                data-testid="logout-btn-collapsed"
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-rose-400 transition-colors"
                title="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          ) : (
            <>
              {/* Clickable Username & Role row to open User Settings / Change Password */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setChangePwdOpen(true)}
                data-testid="user-profile-btn"
                className="w-full flex items-center gap-3 mb-2.5 p-2 -mx-2 rounded-xl text-left hover:bg-white/10 transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20"
                title="Klik untuk membuka Pengaturan Akun & Ubah Password"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase group-hover:bg-red-600 transition-colors shadow-sm">
                  {userName[0] || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="truncate text-sm font-semibold text-white leading-tight group-hover:text-amber-200 transition-colors">
                      {userName}
                    </p>
                    <Settings className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-red-400 truncate mt-0.5">{ROLE_LABEL[userRole] || userRole}</p>
                </div>
              </motion.button>

              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.04, ease: "easeOut" }}
                className="flex items-center gap-1.5"
              >
                {isTauriEnvironment() && (
                  updateInfo?.available ? (
                    <Button
                      type="button"
                      onClick={() => setIsDialogOpen(true)}
                      className="flex-1 justify-start gap-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 h-8 px-2 text-xs font-semibold animate-pulse"
                      title={`Pembaruan v${updateInfo.version} tersedia! Klik untuk memasang.`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Update v{updateInfo.version}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => checkForUpdates(false)}
                      disabled={isChecking}
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start gap-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 h-8 px-2 text-xs disabled:opacity-50"
                      title="Periksa apakah ada pembaruan versi baru di GitHub"
                    >
                      <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin text-amber-400" : ""}`} />
                      {isChecking ? "Memeriksa..." : "Periksa Update"}
                    </Button>
                  )
                )}
                <Button
                  data-testid="logout-btn"
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className={`${isTauriEnvironment() ? "" : "flex-1"} justify-start gap-1.5 text-slate-300 hover:bg-white/5 hover:text-white h-8 px-2 text-xs`}
                >
                  <LogOut className="h-3.5 w-3.5" /> Keluar
                </Button>
              </motion.div>
            </>
          )}
        </div>
      </motion.aside>

      {/* ================= RESPONSIVE MOBILE SIDEBAR ================= */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Animated Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Animated Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] h-full shadow-2xl flex flex-col bg-[#0F172A] text-slate-300 z-50 border-r border-white/10"
            >
              {/* Mobile Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-900/40">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-heading text-base font-extrabold tracking-tight text-white leading-none">
                      DAMKAR MIMIKA
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Sistem Absensi Harian</p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Mobile Navigation List */}
              <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {links.map((n, index) => {
                  if (n.type === "spacer") {
                    return (
                      <div
                        key={`spacer-mobile-${index}`}
                        className="border-b border-white/10 my-2"
                        aria-hidden="true"
                      />
                    );
                  }

                  const Icon = n.icon;
                  return (
                    <motion.div
                      key={n.path}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.15) }}
                    >
                      <NavLink
                        to={n.path}
                        onClick={(e) => handleNavClick(e, n.path)}
                        data-testid={`nav-mobile-${n.path.slice(1)}`}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-red-600 text-white shadow-md shadow-red-900/30 font-semibold"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`
                        }
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate">{n.label}</span>
                      </NavLink>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Mobile User Profile & Logout */}
              <div className="border-t border-white/10 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setChangePwdOpen(true);
                  }}
                  className="w-full flex items-center gap-3 mb-3 p-2 -mx-2 rounded-xl text-left hover:bg-white/10 transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20"
                  title="Klik untuk membuka Pengaturan Akun & Ubah Password"
                  data-testid="user-profile-btn-mobile"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase group-hover:bg-red-600 transition-colors shadow-sm">
                    {userName[0] || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">{userName}</p>
                      <Settings className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
                    </div>
                    <p className="text-[11px] text-red-400">{ROLE_LABEL[userRole] || userRole}</p>
                  </div>
                </button>
                <Button
                  data-testid="logout-btn-mobile"
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  <LogOut className="h-4 w-4" /> Keluar
                </Button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MAIN CONTENT CONTAINER ================= */}
      <div
        className={`transition-[padding] duration-250 ease-out ${
          collapsed ? "lg:pl-[76px]" : "lg:pl-70"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          {/* Mobile hamburger menu toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="lg:hidden text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen(true)}
            data-testid="mobile-menu-btn"
            aria-label="Buka navigasi mobile"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </motion.button>
          <div>
            <h1 className="font-heading text-lg font-bold text-slate-900 leading-none">
              {current?.label || "DAMKAR"}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block mt-0.5">
              BPBD Kab. Mimika | Bidang Pemadam Kebakaran
            </p>
          </div>
          <NetworkStatusBadge />
        </header>

        <motion.main
          key={loc.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="p-4 lg:p-8"
        >
          {children}
        </motion.main>
      </div>

      <ChangePasswordDialog open={changePwdOpen} onOpenChange={setChangePwdOpen} />
    </div>
  );
}

export default Layout;
