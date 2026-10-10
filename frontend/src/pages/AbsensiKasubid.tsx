import { useEffect, useState, useCallback, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Loader2, Info, Save, RotateCcw, CheckCheck, Square } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { DatePicker } from "@/components/DatePicker";

import { useNavigationGuard } from "@/context/NavigationGuardContext";

const today = new Date().toISOString().slice(0, 10);

export default function AbsensiKasubid() {
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialStatuses, setInitialStatuses] = useState<Record<string, string>>({});
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { setDirtyState, confirmAction } = useNavigationGuard();

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    api
      .get("/kasubid/roster", { params: { date } })
      .then((r) => {
        setRoster(r.data);
        const map: Record<string, string> = {};
        r.data.forEach((e: any) => {
          map[e.id] = e.status || "";
        });
        setInitialStatuses(map);
        setPendingStatuses(map);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Dirty count computation
  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const [id, st] of Object.entries(pendingStatuses)) {
      if (st && st !== (initialStatuses[id] || "")) {
        count++;
      }
    }
    return count;
  }, [pendingStatuses, initialStatuses]);

  // Register dirty state to global navigation guard
  useEffect(() => {
    setDirtyState(dirtyCount > 0, dirtyCount, "absensi Kasubid");
    return () => setDirtyState(false);
  }, [dirtyCount, setDirtyState]);

  const handleDateChange = (newDate: string) => {
    if (newDate === date) return;
    confirmAction(() => {
      setDate(newDate);
    }, "absensi Kasubid");
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectAll = () => setSelected(new Set(roster.map((e) => e.id)));
  const clearAll = () => setSelected(new Set());

  // Set single row status in memory
  const handleSetRowStatus = (id: string, status: string) => {
    setPendingStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === status ? "" : status,
    }));
  };

  // Batch set status in memory for selected Kasubid (or all if none selected)
  const handleBatchStageStatus = (status: string) => {
    const ids = selected.size > 0 ? Array.from(selected) : roster.map((e) => e.id);
    if (ids.length === 0) {
      toast.warning("Tidak ada Kasubid aktif");
      return;
    }
    setPendingStatuses((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        next[id] = status;
      }
      return next;
    });
    toast.info(`${ids.length} Kasubid ditandai ${status} (klik Simpan Absensi untuk menerapkan)`);
  };

  const handleResetChanges = () => {
    setPendingStatuses(initialStatuses);
    toast.info("Perubahan status dibatalkan");
  };

  // Save all changed statuses in one batch
  const handleSaveAll = async () => {
    const changedEntries = Object.entries(pendingStatuses).filter(
      ([id, st]) => st && st !== (initialStatuses[id] || "")
    );

    if (changedEntries.length === 0) {
      toast.info("Tidak ada perubahan status untuk disimpan");
      return;
    }

    const byStatus: Record<string, string[]> = {};
    for (const [id, st] of changedEntries) {
      if (!byStatus[st]) byStatus[st] = [];
      byStatus[st].push(id);
    }

    setSaving(true);
    try {
      await Promise.all(
        Object.entries(byStatus).map(([status, employee_ids]) =>
          api.post("/attendance/batch", {
            date,
            employee_ids,
            status,
          })
        )
      );
      toast.success(`${changedEntries.length} absensi Kasubid berhasil disimpan!`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header with date picker on top-right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Absensi Kasubid</h2>
          <p className="text-sm text-slate-500">Input absensi khusus pejabat Kasubid aktif.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 shrink-0">Tanggal</label>
          <DatePicker
            data-testid="ks-input-date"
            value={date}
            onChange={(val) => handleDateChange(val)}
            className="w-64"
          />
        </div>
      </div>

      {roster.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Pilih Semua
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="gap-2">
            <Square className="h-4 w-4" /> Batalkan Pilihan
          </Button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {selected.size} dipilih / {roster.length} Kasubid
          </span>
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 animate-pulse">
              {dirtyCount} perubahan belum disimpan
            </span>
          )}
        </div>
      )}

      {loading ? (
        <Card className="overflow-hidden border-slate-200">
          <TableSkeleton rows={4} columns={5} />
        </Card>
      ) : roster.length === 0 ? (
        <Card className="flex items-center gap-3 border-amber-200 bg-amber-50 p-6 text-amber-800" data-testid="ks-empty">
          <Info className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Belum ada Kasubid yang aktif sehingga absensi Kasubid tidak dapat dilakukan. Tetapkan pejabat melalui menu Pengaturan Kasubid.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-3 py-3">Posisi</th>
                  <th className="px-3 py-3">Nama</th>
                  <th className="hidden px-3 py-3 md:table-cell">NIP</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Jabatan</th>
                  <th className="px-3 py-3 text-center min-w-[270px]">Pilih Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => {
                  const currentStatus = pendingStatuses[e.id] || "";
                  const isRowDirty = currentStatus !== (initialStatuses[e.id] || "");
                  return (
                    <tr
                      key={e.id}
                      data-testid={`ks-roster-${e.id}`}
                      onClick={() => toggle(e.id)}
                      className={`cursor-pointer border-b border-slate-100 transition-colors ${selected.has(e.id) ? "bg-amber-50/60" : isRowDirty ? "bg-amber-50/40" : "hover:bg-slate-50"
                        }`}
                    >
                      <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(e.id)}
                          onCheckedChange={() => toggle(e.id)}
                          className="h-5 w-5"
                          data-testid={`ks-check-${e.id}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          <Star className="h-3.5 w-3.5" /> {e.position_label}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{e.nama}</td>
                      <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                      <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{e.jabatan}</td>
                      <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                        <div className="inline-flex flex-wrap items-center justify-center gap-1">
                          {STATUSES.map((s) => {
                            const isSelected = currentStatus === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleSetRowStatus(e.id, s)}
                                data-testid={`ks-status-opt-${e.id}-${s}`}
                                title={`${s} — ${STATUS_CONFIG[s].label}`}
                                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${isSelected
                                  ? `${STATUS_CONFIG[s].btn} text-white shadow ring-2 ring-slate-900/20 scale-105`
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                        {isRowDirty && (
                          <div className="mt-0.5 text-[11px] font-medium text-amber-700">
                            (Belum disimpan)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sticky action bar */}
      {roster.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Set {selected.size > 0 ? `(${selected.size} dipilih)` : "semua"}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleBatchStageStatus(s)}
                    data-testid={`ks-batch-${s}-btn`}
                    className={`font-bold text-white shadow-sm ${STATUS_CONFIG[s].btn}`}
                  >
                    {STATUS_CONFIG[s].short}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              {dirtyCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={handleResetChanges}
                  className="gap-1.5 text-slate-500 hover:text-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Batalkan
                </Button>
              )}
              <Button
                onClick={handleSaveAll}
                disabled={saving || dirtyCount === 0}
                className="gap-2 bg-slate-900 font-bold text-white hover:bg-slate-800 px-5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Absensi {dirtyCount > 0 ? `(${dirtyCount})` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
