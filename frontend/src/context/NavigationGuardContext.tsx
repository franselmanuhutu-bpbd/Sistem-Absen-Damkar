import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface NavigationGuardContextType {
  isDirty: boolean;
  dirtyCount: number;
  dirtyDescription: string;
  setDirtyState: (dirty: boolean, count?: number, description?: string) => void;
  confirmAction: (onProceed: () => void, customDesc?: string) => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(
  undefined
);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [dirtyDescription, setDirtyDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMessage, setActiveMessage] = useState("");

  const pendingActionRef = useRef<(() => void) | null>(null);

  const setDirtyState = useCallback(
    (dirty: boolean, count: number = 0, description: string = "") => {
      setIsDirty(dirty);
      setDirtyCount(count);
      setDirtyDescription(description);
    },
    []
  );

  const confirmAction = useCallback(
    (onProceed: () => void, customDesc?: string): boolean => {
      if (!isDirty) {
        onProceed();
        return true;
      }
      pendingActionRef.current = onProceed;
      setActiveMessage(customDesc || dirtyDescription);
      setDialogOpen(true);
      return false;
    },
    [isDirty, dirtyDescription]
  );

  const handleConfirm = () => {
    setIsDirty(false);
    setDirtyCount(0);
    setDialogOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) {
      action();
    }
  };

  const handleCancel = () => {
    pendingActionRef.current = null;
    setDialogOpen(false);
  };

  // Browser reload/close guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <NavigationGuardContext.Provider
      value={{
        isDirty,
        dirtyCount,
        dirtyDescription,
        setDirtyState,
        confirmAction,
      }}
    >
      {children}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-md border-slate-200">
          <DialogHeader className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Perubahan Belum Disimpan
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                {dirtyCount > 0 ? (
                  <>
                    Terdapat <span className="font-semibold text-slate-900">{dirtyCount} perubahan</span>{" "}
                    {activeMessage || "data"} yang belum disimpan.
                  </>
                ) : (
                  <>Terdapat perubahan {activeMessage || "data"} yang belum disimpan.</>
                )}
                {" "}Apakah Anda yakin ingin berpindah dan membuang perubahan ini?
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              Tetap di Sini
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white sm:w-auto"
            >
              Buang &amp; Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error("useNavigationGuard must be used within NavigationGuardProvider");
  }
  return context;
}
