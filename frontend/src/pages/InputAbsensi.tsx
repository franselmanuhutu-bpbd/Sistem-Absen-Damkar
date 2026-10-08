import { useEffect, useState, useCallback, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCheck, Square, Flame, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";

import { useNavigationGuard } from "@/context/NavigationGuardContext";

const today = new Date().toISOString().slice(0, 10);

export default function InputAbsensi() {
  const [date, setDate] = useState(today);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState("");
  const [roster, setRoster] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialStatuses, setInitialStatuses] = useState<Record<string, string>>({});
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { setDirtyState, confirmAction } = useNavigationGuard();

  useEffect(() => {
    api
      .get("/teams")
      .then((r) => {
        setTeams(r.data);
        if (r.data[0]) setTeamId(r.data[0].id);
      })
      .catch((e) => toast.error(apiError(e)));
  }, []);

  const loadRoster = useCallback(() => {
    if (!teamId || !date) return;
    setLoading(true);
    setSelected(new Set());
    api
      .get("/attendance/roster", { params: { date, team_id: teamId } })
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
  }, [teamId, date]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Dirty state computation
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
    setDirtyState(dirtyCount > 0, dirtyCount, "absensi staf");
    return () => setDirtyState(false);
  }, [dirtyCount, setDirtyState]);

  const handleTeamChange = (newTeamId: string) => {
    if (newTeamId === teamId) return;
    confirmAction(() => {
      setTeamId(newTeamId);
    }, "absensi staf");
  };

  const handleDateChange = (newDate: string) => {
    if (newDate === date) return;
    confirmAction(() => {
      setDate(newDate);
    }, "absensi staf");
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

  // Batch set status in memory for selected staff
  const handleBatchStageStatus = (status: string) => {
    if (selected.size === 0) {
      toast.warning("Pilih minimal satu pegawai terlebih dahulu");
      return;
    }
    setPendingStatuses((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        next[id] = status;
      }
      return next;
    });
    toast.info(`${selected.size} pegawai ditandai ${status} (klik Simpan Absensi untuk menerapkan)`);
  };

  const handleResetChanges = () => {
    setPendingStatuses(initialStatuses);
    toast.info("Perubahan status dibatalkan");
  };

  // Commit all pending status changes to backend
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
      toast.success(`${changedEntries.length} data absensi berhasil disimpan!`);
      setSelected(new Set());
      loadRoster();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const teamName = teams.find((t) => t.id === teamId)?.name || "";

  return (
    <div className="space-y-5 pb-8">
      {/* Header with title and top-right date picker (following Kalender.tsx) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Input Absensi Harian</h2>
          <p className="text-sm text-slate-500">Pilih tanggal &amp; regu, tentukan kehadiran staf, lalu simpan.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 shrink-0">Tanggal:</label>
          <Input
            type="date"
            data-testid="input-date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-10 w-44 bg-white"
          />
        </div>
      </div>

      {/* Team tabs (following ManajemenRegu.tsx) */}
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <Button
            key={t.id}
            variant={teamId === t.id ? "default" : "outline"}
            onClick={() => handleTeamChange(t.id)}
            data-testid={`team-tab-${t.code || t.id}`}
            className={`gap-2 ${teamId === t.id ? "bg-slate-900 text-white" : ""}`}
          >
            <Flame className="h-4 w-4" /> {t.name}
          </Button>
        ))}
      </div>

      {/* Selection controls & dirty status banner */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} data-testid="select-all-btn" className="gap-2">
          <CheckCheck className="h-4 w-4" /> Pilih Semua
        </Button>
        <Button variant="outline" size="sm" onClick={clearAll} data-testid="deselect-all-btn" className="gap-2">
          <Square className="h-4 w-4" /> Batalkan Pilihan
        </Button>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {selected.size} dipilih / {roster.length} anggota
        </span>
        {dirtyCount > 0 && (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 animate-pulse">
            {dirtyCount} perubahan belum disimpan
          </span>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200">
        {loading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : roster.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="font-medium">Tidak ada anggota aktif di {teamName} pada tanggal ini.</p>
            <p className="text-sm">Atur penempatan di menu Manajemen Regu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="w-12 px-2 py-3">No</th>
                  <th className="px-3 py-3">Nama</th>
                  <th className="hidden px-3 py-3 md:table-cell">NIP</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Pangkat</th>
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
                      data-testid={`roster-row-${e.id}`}
                      onClick={() => toggle(e.id)}
                      className={`cursor-pointer border-b border-slate-100 transition-colors ${
                        selected.has(e.id) ? "bg-red-50/60" : isRowDirty ? "bg-amber-50/40" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(e.id)}
                          onCheckedChange={() => toggle(e.id)}
                          data-testid={`roster-check-${e.id}`}
                          className="h-5 w-5"
                        />
                      </td>
                      <td className="px-2 py-3 text-slate-400">{e.no}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">
                          {e.nama} {e.is_commander && <span title="Komandan Regu">⭐</span>}
                        </p>
                        <p className="text-xs text-slate-400 md:hidden">{e.nip}</p>
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                      <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{e.pangkat}</td>
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
                                data-testid={`status-opt-${e.id}-${s}`}
                                title={`${s} — ${STATUS_CONFIG[s].label}`}
                                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
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
        )}
      </Card>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-20 mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Set {selected.size > 0 ? `(${selected.size} dipilih)` : "terpilih"}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  disabled={saving || selected.size === 0}
                  onClick={() => handleBatchStageStatus(s)}
                  data-testid={`batch-${s}-btn`}
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
    </div>
  );
}
