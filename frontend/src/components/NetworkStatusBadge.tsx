import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  Database,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type ConnectionStatus =
  | "fast"
  | "moderate"
  | "slow"
  | "reconnecting"
  | "db_error"
  | "offline";

export function NetworkStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [dbStatus, setDbStatus] = useState<"connected" | "reconnecting" | "error" | "checking">("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [effectiveType, setEffectiveType] = useState<string>("");
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<any>(null);

  const checkHealth = async (isManual = false) => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setDbStatus("error");
      setLatency(null);
      return;
    }

    setIsChecking(true);
    const start = performance.now();

    try {
      const res = await api.get("/health", { timeout: 10000 });
      const duration = Math.round(performance.now() - start);

      setIsOnline(true);
      setLatency(duration);
      setLastChecked(new Date());

      if (res.data?.database === "connected") {
        if (dbStatus === "reconnecting") {
          toast.success("Koneksi database berhasil dipulihkan.");
        }
        setDbStatus("connected");
        setRetryCount(0);
      } else {
        setDbStatus("error");
      }

      if (isManual) {
        toast.success(`Koneksi aktif! Latensi server: ${duration} ms`);
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setLatency(duration);
      setLastChecked(new Date());

      if (!navigator.onLine) {
        setIsOnline(false);
        setDbStatus("error");
      } else {
        setIsOnline(true);
        setDbStatus("reconnecting");
        setRetryCount((prev) => prev + 1);

        // Schedule auto retry in 5s
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          checkHealth(false);
        }, 5000);
      }

      if (isManual) {
        toast.error("Gagal terhubung ke database. Sedang mencoba ulang...");
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // 1. Initial health check
    checkHealth(false);

    // 2. Read Network Information API if supported
    const navConn = (navigator as any).connection;
    if (navConn) {
      setEffectiveType(navConn.effectiveType || "");
      const updateConn = () => {
        setEffectiveType(navConn.effectiveType || "");
      };
      navConn.addEventListener?.("change", updateConn);
    }

    // 3. Online & Offline event listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Koneksi internet kembali aktif.");
      checkHealth(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDbStatus("error");
      toast.error("Koneksi internet terputus (Offline).");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 4. Periodic polling (every 30 seconds)
    const interval = setInterval(() => {
      checkHealth(false);
    }, 30000);

    // 5. Visibility change (when tab is reopened or refocused)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkHealth(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // 6. Click outside popover handler
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("mousedown", handleClickOutside);
      clearInterval(interval);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // Determine aggregate connection status
  let status: ConnectionStatus = "fast";
  if (!isOnline) {
    status = "offline";
  } else if (dbStatus === "reconnecting") {
    status = "reconnecting";
  } else if (dbStatus === "error") {
    status = "db_error";
  } else if (
    (latency !== null && latency >= 1200) ||
    effectiveType === "2g" ||
    effectiveType === "slow-2g"
  ) {
    status = "slow";
  } else if (
    (latency !== null && latency >= 400) ||
    effectiveType === "3g"
  ) {
    status = "moderate";
  } else {
    status = "fast";
  }

  // Visual formatting per status
  const config = {
    fast: {
      badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100",
      dotClass: "bg-emerald-500 animate-pulse",
      icon: <Wifi className="h-3 w-3 text-emerald-600" />,
      label: latency ? `Online • ${latency}ms` : "Online",
      desc: "Koneksi internet & database cepat dan stabil.",
    },
    moderate: {
      badgeBg: "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100",
      dotClass: "bg-emerald-500",
      icon: <Wifi className="h-3 w-3 text-emerald-600" />,
      label: latency ? `Online • ${latency}ms` : "Online",
      desc: "Koneksi internet wajar dan database terhubung.",
    },
    slow: {
      badgeBg: "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100",
      dotClass: "bg-amber-500 animate-ping",
      icon: <AlertTriangle className="h-3 w-3 text-amber-600" />,
      label: latency ? `Koneksi Lambat • ${latency}ms` : "Koneksi Lambat",
      desc: "Jaringan lambat atau latensi tinggi ke database.",
    },
    reconnecting: {
      badgeBg: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200",
      dotClass: "bg-amber-600",
      icon: <Loader2 className="h-3 w-3 animate-spin text-amber-700" />,
      label: retryCount > 0 ? `Konek ke DB... (#${retryCount})` : "Konek ke DB...",
      desc: "Menghubungkan ulang ke database Supabase...",
    },
    db_error: {
      badgeBg: "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100",
      dotClass: "bg-rose-500",
      icon: <Database className="h-3 w-3 text-rose-600" />,
      label: "DB Terputus",
      desc: "Tidak dapat menghubungi server database.",
    },
    offline: {
      badgeBg: "bg-red-50 border-red-300 text-red-800 hover:bg-red-100",
      dotClass: "bg-red-600",
      icon: <WifiOff className="h-3 w-3 text-red-600" />,
      label: "Offline",
      desc: "Perangkat tidak memiliki akses internet.",
    },
  }[status];

  return (
    <div ref={containerRef} className="relative ml-auto hidden sm:block">
      {/* Clickable Badge */}
      <button
        onClick={() => setPopoverOpen(!popoverOpen)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all shadow-sm ${config.badgeBg}`}
        title="Klik untuk melihat detail koneksi & latensi"
      >
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span className="flex items-center gap-1.5 font-semibold">
          {config.label}
        </span>
      </button>

      {/* Detail Popover */}
      {popoverOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Status Jaringan & Database
              </h4>
            </div>
            <button
              onClick={() => checkHealth(true)}
              disabled={isChecking}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              title="Ping Ulang"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin text-slate-600" : ""}`} />
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {/* Internet Status */}
            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Wifi className="h-3.5 w-3.5 text-slate-400" /> Jaringan Internet:
              </span>
              <span className="flex items-center gap-1 font-semibold">
                {isOnline ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Tersambung</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600">Offline</span>
                  </>
                )}
              </span>
            </div>

            {/* Database Status */}
            <div className="flex items-center justify-between py-1 border-t border-slate-50">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Database className="h-3.5 w-3.5 text-slate-400" /> Database Supabase:
              </span>
              <span className="flex items-center gap-1 font-semibold">
                {dbStatus === "connected" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Terhubung</span>
                  </>
                ) : dbStatus === "reconnecting" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    <span className="text-amber-700">Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    <span className="text-rose-600">Terputus</span>
                  </>
                )}
              </span>
            </div>

            {/* Server Latency */}
            <div className="flex items-center justify-between py-1 border-t border-slate-50">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Activity className="h-3.5 w-3.5 text-slate-400" /> Latensi Server:
              </span>
              <span
                className={`font-semibold ${
                  latency === null
                    ? "text-slate-400"
                    : latency < 300
                    ? "text-emerald-600"
                    : latency < 1000
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {latency !== null ? `${latency} ms` : "-"}
              </span>
            </div>

            {/* Network Type if available */}
            {effectiveType && (
              <div className="flex items-center justify-between py-1 border-t border-slate-50">
                <span className="text-slate-500">Tipe Kecepatan:</span>
                <span className="font-semibold uppercase text-slate-700">
                  {effectiveType}
                </span>
              </div>
            )}

            {/* Last Checked */}
            <div className="flex items-center justify-between py-1 border-t border-slate-50 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Terakhir Dicek:
              </span>
              <span>
                {lastChecked ? lastChecked.toTimeString().slice(0, 8) : "-"}
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <button
              onClick={() => checkHealth(true)}
              disabled={isChecking}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Menguji Koneksi..." : "Uji Latensi Sekarang"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
