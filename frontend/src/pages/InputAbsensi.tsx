import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCheck, Square } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const today = new Date().toISOString().slice(0, 10);

export default function InputAbsensi() {
  const [date, setDate] = useState(today);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/teams").then((r) => {
      setTeams(r.data);
      if (r.data[0]) setTeamId(r.data[0].id);
    });
  }, []);

  const loadRoster = useCallback(() => {
    if (!teamId || !date) return;
    setLoading(true);
    setSelected(new Set());
    api
      .get("/attendance/roster", { params: { date, team_id: teamId } })
      .then((r) => setRoster(r.data))
      .finally(() => setLoading(false));
  }, [teamId, date]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const selectAll = () => setSelected(new Set(roster.map((e) => e.id)));
  const clearAll = () => setSelected(new Set());

  const applyStatus = async (status) => {
    if (selected.size === 0) {
      toast.warning("Pilih pegawai terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/attendance/batch", {
        date,
        employee_ids: Array.from(selected),
        status,
      });
      toast.success(`${data.updated} pegawai ditandai ${status} — ${STATUS_CONFIG[status].label}`);
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
    <div className="space-y-5 pb-28">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Input Absensi Harian</h2>
        <p className="text-sm text-slate-500">Pilih tanggal &amp; regu, lalu tandai kehadiran secara massal.</p>
      </div>

      <Card className="border-slate-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-600">Tanggal</label>
            <Input type="date" data-testid="input-date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 bg-white" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-600">Regu</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger data-testid="input-team" className="h-11 bg-white">
                <SelectValue placeholder="Pilih regu" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={selectAll} data-testid="select-all-btn" className="gap-2">
          <CheckCheck className="h-4 w-4" /> Pilih Semua
        </Button>
        <Button variant="outline" onClick={clearAll} data-testid="deselect-all-btn" className="gap-2">
          <Square className="h-4 w-4" /> Batalkan
        </Button>
        <span className="ml-auto rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
          {selected.size} dipilih / {roster.length} anggota
        </span>
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
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => (
                  <tr
                    key={e.id}
                    data-testid={`roster-row-${e.id}`}
                    onClick={() => toggle(e.id)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors ${
                      selected.has(e.id) ? "bg-red-50/60" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggle(e.id)}
                        onClick={() => toggle(e.id)}
                        data-testid={`roster-check-${e.id}`}
                        className="h-5 w-5"
                      />
                    </td>
                    <td className="px-2 py-3 text-slate-400">{e.no}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800">{e.nama}</p>
                      <p className="text-xs text-slate-400 md:hidden">{e.nip}</p>
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{e.pangkat}</td>
                    <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{e.jabatan}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sticky action bar */}
      <div className="bottom-0 left-0 right-0 z-20 border-t border-slate-200 rounded-xl bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:left-12 lg:right-12">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 sm:grid-cols-6">
          {STATUSES.map((s) => (
            <Button
              key={s}
              disabled={saving}
              onClick={() => applyStatus(s)}
              data-testid={`batch-${s}-btn`}
              className={`min-h-[48px] font-bold text-white ${STATUS_CONFIG[s].btn}`}
            >
              {STATUS_CONFIG[s].short}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
