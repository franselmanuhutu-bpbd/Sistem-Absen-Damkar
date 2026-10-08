import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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

export function useUpdater() {
  const context = useContext(UpdateContext);
  if (!context) {
    return {
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
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isTauriEnvironment()) {
      if (!silent) {
        toast.info("Pembaruan otomatis hanya tersedia pada versi desktop.");
      }
      return;
    }

    setIsChecking(true);
    try {
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
          toast.success("Aplikasi sudah menggunakan versi terbaru (v1.0.0).", {
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
          toast.success("Aplikasi sudah menggunakan versi terbaru (v1.0.0).", {
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
      setIsChecking(false);
    }
  }, []);

  // Startup background check (setelah 3 detik)
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const timer = setTimeout(() => {
      checkForUpdates(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const installUpdate = async () => {
    if (!updateInfo) return;
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
                Versi {updateInfo.version} Siap Dipasang
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
                    <span>Memasang Pembaruan...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Unduh & Perbarui</span>
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
    toast.info("Pembaruan otomatis hanya tersedia pada versi desktop.");
    return;
  }
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update?.available) {
      toast.info(`Versi baru v${update.version} tersedia!`);
    } else {
      toast.success("Aplikasi sudah menggunakan versi terbaru (v1.0.0).");
    }
  } catch (err: any) {
    const errMsg = String(err?.message || err || "");
    if (errMsg.includes("404") || errMsg.includes("release JSON")) {
      toast.success("Aplikasi sudah menggunakan versi terbaru (v1.0.0).", {
        description: "Belum ada rilis baru di GitHub.",
      });
    } else {
      toast.error("Gagal memeriksa pembaruan: Periksa koneksi internet Anda.");
    }
  }
}
