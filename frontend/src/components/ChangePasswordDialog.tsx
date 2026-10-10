import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Eye, EyeOff, Loader2, ShieldCheck, Settings, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/constants";
import {
  getExistingSubscription,
  isNativePushEnabled,
  isNativePushRuntime,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const checkPush = async () => {
      const supported = isPushSupported();
      if (!active) return;
      setPushSupported(supported);
      if (!supported) return;
      const subscribed = isNativePushRuntime()
        ? isNativePushEnabled()
        : Boolean(await getExistingSubscription());
      if (active) setPushSubscribed(subscribed);
    };
    checkPush();
    return () => {
      active = false;
    };
  }, [open]);

  const togglePush = async () => {
    setPushLoading(true);
    try {
      const result = pushSubscribed
        ? await unsubscribeFromPush()
        : await subscribeToPush();
      if (!result.success) {
        toast.error(result.error || "Gagal mengubah pengaturan notifikasi.");
        return;
      }
      setPushSubscribed(!pushSubscribed);
      toast.success(pushSubscribed ? "Notifikasi dinonaktifkan." : "Notifikasi diaktifkan.");
    } finally {
      setPushLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Masukkan password lama Anda.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Password baru tidak boleh sama dengan password lama.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }

    setSubmitting(true);
    try {
      await api.put("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password Anda berhasil diperbarui!");
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          if (!o) resetForm();
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="w-full">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Pengaturan Pengguna</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Informasi profil akun dan keamanan password.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User Profile Summary */}
        {user && typeof user === "object" && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase shadow-sm">
              {user.name?.[0] || user.email?.[0] || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</p>
                <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-white border-slate-300 text-slate-700">
                  {ROLE_LABEL[user.role] || user.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-1 text-sm">
          <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <KeyRound className="h-3.5 w-3.5 text-amber-500" />
            <span>Ubah Password</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Notifikasi Push</Label>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pushSupported
                    ? pushSubscribed
                      ? "Notifikasi aktif di perangkat ini."
                      : "Aktifkan untuk menerima pengingat."
                    : "Perangkat ini tidak mendukung notifikasi push."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={pushSubscribed ? "outline" : "default"}
                disabled={!pushSupported || pushLoading}
                onClick={togglePush}
                className={!pushSubscribed ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
              >
                {pushLoading ? "Memproses..." : pushSubscribed ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current-pwd">Password Lama</Label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrent ? "text" : "password"}
                placeholder="Masukkan password saat ini..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-11"
                data-testid="input-current-password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Password Baru</Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNew ? "text" : "password"}
                placeholder="Minimal 6 karakter..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                data-testid="input-new-password"
              />
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-[11px] text-amber-600">Password baru minimal 6 karakter</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">Konfirmasi Password Baru</Label>
            <div className="relative">
              <Input
                id="confirm-pwd"
                type={showConfirm ? "text" : "password"}
                placeholder="Ulangi password baru..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11"
                data-testid="input-confirm-password"
              />
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] text-rose-600">Konfirmasi password tidak cocok</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                resetForm();
                onOpenChange(false)}
              }
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={ submitting 
                || !currentPassword 
                || newPassword.length < 6 
                || newPassword !== confirmPassword
              }
              className="bg-red-600 hover:bg-red-700"
              data-testid="submit-change-password-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Simpan Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const UserSettingsDialog = ChangePasswordDialog;
