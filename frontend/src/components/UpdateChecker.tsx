import React, { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { isTauriEnvironment } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

interface UpdateContextType {
  currentVersion: string;
  updateInfo: any;
  isChecking: boolean;
  isDownloading: boolean;
  progress: number | null;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

let cachedAppVersion = "";

/**
 * Mengambil versi aplikasi desktop secara dinamis dari binary Tauri.
 * Mengembalikan string format "v1.0.1", atau string kosong jika di browser.
 */
export async function getAppVersion(): Promise<string> {
  if (cachedAppVersion) return cachedAppVersion;
  if (!isTauriEnvironment()) return "";
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const v = await getVersion();
    if (v) {
      cachedAppVersion = v.startsWith("v") ? v : `v${v}`;
      return cachedAppVersion;
    }
  } catch (err) {
    console.warn("[Auto-Updater] Gagal membaca versi aplikasi:", err);
  }
  return "";
}

function isAndroidTauri(): boolean {
  return isTauriEnvironment() && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

async function checkAndroidRelease(currentVersion: string) {
  const response = await fetch(
    "https://api.github.com/repos/franselmanuhutu-bpbd/Sistem-Absen-Damkar/releases/latest",
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!response.ok) throw new Error(`GitHub release check failed: ${response.status}`);

  const release = await response.json();
  const latestVersion = String(release.tag_name || "").replace(/^v/, "");
  const apk = release.assets?.find(
    (asset: { name?: string; browser_download_url?: string }) =>
      asset.name?.endsWith(".apk") && asset.browser_download_url
  );
  if (!latestVersion || !apk || latestVersion === currentVersion.replace(/^v/, "")) return null;

  return {
    available: true,
    version: latestVersion,
    body: release.body || "",
    downloadUrl: apk.browser_download_url,
    mobile: true,
  };
}

export function useUpdater() {
  const context = useContext(UpdateContext);
  if (!context) {
    return {
      currentVersion: "",
      updateInfo: null,
      isChecking: false,
      isDownloading: false,
      progress: null,
      isDialogOpen: false,
      setIsDialogOpen: () => {},
      checkForUpdates: async () => {},
      installUpdate: async () => {},
    };
  }
  return context;
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const isCheckingRef = useRef(false);

  // Ambil versi dinamis saat pertama kali mount
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    getAppVersion().then((v) => {
      if (v) setCurrentVersion(v);
    });
  }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isTauriEnvironment()) {
      if (!silent) {
        toast.info("Pembaruan otomatis hanya tersedia pada versi desktop.");
      }
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    const ver = cachedAppVersion || (await getAppVersion());
    const verSuffix = ver ? ` (${ver})` : "";

    try {
      if (isAndroidTauri()) {
        const update = await checkAndroidRelease(ver);
        if (update) {
          setUpdateInfo(update);
          setIsDialogOpen(true);
          if (!silent) toast.info(`Versi baru v${update.version} tersedia!`);
        } else {
          setUpdateInfo(null);
          if (!silent) toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`);
        }
        return;
      }

      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update?.available) {
        setUpdateInfo(update);
        setIsDialogOpen(true);
        if (!silent) {
          toast.info(`Versi baru v${update.version} tersedia!`, {
            icon: <Sparkles className="h-4 w-4 text-amber-500" />,
          });
        }
      } else {
        setUpdateInfo(null);
        if (!silent) {
          toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`, {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
        }
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err || "");
      // Jika endpoint 404 (belum ada release di GitHub) atau release manifest belum dibuat
      const isNotFoundOrNoRelease =
        errMsg.includes("404") ||
        errMsg.toLowerCase().includes("not found") ||
        errMsg.includes("valid release JSON") ||
        errMsg.includes("release JSON");

      if (isNotFoundOrNoRelease) {
        setUpdateInfo(null);
        if (!silent) {
          toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`, {
            description: "Belum ada rilis baru yang dipublikasikan di GitHub.",
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
        }
      } else {
        console.warn("[Auto-Updater] Gagal memeriksa pembaruan:", err);
        if (!silent) {
          toast.error("Gagal memeriksa pembaruan. Periksa koneksi internet Anda.");
        }
      }
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  // Startup background check (setelah 3 detik)
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const startupTimer = setTimeout(() => checkForUpdates(true), 3000);
    const interval = window.setInterval(() => checkForUpdates(true), 30 * 60 * 1000);
    const checkWhenActive = () => {
      if (document.visibilityState === "visible") checkForUpdates(true);
    };
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("online", checkWhenActive);
    document.addEventListener("visibilitychange", checkWhenActive);
    return () => {
      clearTimeout(startupTimer);
      clearInterval(interval);
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("online", checkWhenActive);
      document.removeEventListener("visibilitychange", checkWhenActive);
    };
  }, [checkForUpdates]);

  const installUpdate = async () => {
    if (!updateInfo) return;
    if (updateInfo.mobile) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(updateInfo.downloadUrl);
        setIsDialogOpen(false);
        toast.info("APK dibuka untuk diunduh. Android akan meminta konfirmasi pemasangan.");
      } catch (err) {
        console.error("[Auto-Updater] Gagal membuka APK:", err);
        toast.error("Gagal membuka halaman unduhan APK.");
      }
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    try {
      let downloaded = 0;
      let total = 0;

      await updateInfo.downloadAndInstall((event: any) => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });

      toast.success("Pembaruan selesai diunduh. Memulai ulang aplikasi...", {
        duration: 3000,
      });

      const { relaunch } = await import("@tauri-apps/plugin-process");
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (err: any) {
      console.error("[Auto-Updater] Gagal memasang pembaruan:", err);
      const detail =
        err?.message ||
        (typeof err === "string" ? err : "") ||
        (typeof err === "object" ? JSON.stringify(err) : "") ||
        "Terjadi kesalahan";
      toast.error("Gagal memasang pembaruan: " + detail);
      setIsDownloading(false);
      setProgress(null);
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        currentVersion,
        updateInfo,
        isChecking,
        isDownloading,
        progress,
        isDialogOpen,
        setIsDialogOpen,
        checkForUpdates,
        installUpdate,
      }}
    >
      {children}
      {updateInfo && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => !isDownloading && setIsDialogOpen(open)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 font-semibold mb-1">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>Pembaruan Aplikasi Tersedia</span>
              </div>
              <DialogTitle className="text-xl">
                {updateInfo.mobile
                  ? `Versi ${updateInfo.version} Tersedia`
                  : `Versi ${updateInfo.version} Siap Dipasang`}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 mt-2">
                {updateInfo.body ? (
                  <span className="whitespace-pre-line">{updateInfo.body}</span>
                ) : (
                  "Versi baru dari Sistem Informasi Absensi DAMKAR Mimika telah tersedia. Pasang pembaruan sekarang untuk mendapatkan fitur terbaru dan perbaikan sistem."
                )}
              </DialogDescription>
            </DialogHeader>

            {isDownloading && (
              <div className="my-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Mengunduh berkas pembaruan...</span>
                  <span>{progress !== null ? `${progress}%` : "Mohon tunggu..."}</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress ?? 15}%` }}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              {!isDownloading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Nanti Saja
                </Button>
              )}
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
                disabled={isDownloading}
                onClick={installUpdate}
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{updateInfo.mobile ? "Buka Unduhan APK" : "Memasang Pembaruan..."}</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>{updateInfo.mobile ? "Unduh APK" : "Unduh & Perbarui"}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </UpdateContext.Provider>
  );
}

// Fallback compatibility component and helper
export function UpdateChecker() {
  return null;
}

export async function triggerManualUpdateCheck() {
  if (!isTauriEnvironment()) {
    toast.info("Pembaruan otomatis hanya tersedia pada aplikasi terpasang.");
    return;
  }
  const ver = cachedAppVersion || (await getAppVersion());
  const verSuffix = ver ? ` (${ver})` : "";
  try {
    if (isAndroidTauri()) {
      const update = await checkAndroidRelease(ver);
      if (update) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(update.downloadUrl);
        toast.info(`Versi baru v${update.version} tersedia. APK dibuka untuk diunduh.`);
      } else {
        toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`);
      }
      return;
    }

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update?.available) {
      toast.info(`Versi baru v${update.version} tersedia!`);
    } else {
      toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`);
    }
  } catch (err: any) {
    const errMsg = String(err?.message || err || "");
    if (errMsg.includes("404") || errMsg.includes("release JSON")) {
      toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`, {
        description: "Belum ada rilis baru di GitHub.",
      });
    } else {
      toast.error("Gagal memeriksa pembaruan: Periksa koneksi internet Anda.");
    }
  }
}
