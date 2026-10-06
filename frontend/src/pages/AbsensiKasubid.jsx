import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

const today = new Date().toISOString().slice(0, 10);

export default function AbsensiKasubid() {
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    api.get("/kasubid/roster", { params: { date } }).then((r) => setRoster(r.data)).finally(() => setLoading(false));
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const applyStatus = async (status) => {
    const ids = selected.size > 0 ? Array.from(selected) : roster.map((e) => e.id);
    if (ids.length === 0) { toast.warning("Tidak ada Kasubid aktif"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/attendance/batch", { date, employee_ids: ids, status });
      toast.success(`${data.updated} Kasubid ditandai ${status} — ${STATUS_CONFIG[status].label}`);
      setSelected(new Set());
      load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 pb-28">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Absensi Kasubid</h2>
        <p className="text-sm text-slate-500">Input absensi khusus pejabat Kasubid yang sedang aktif.</p>
      </div>

      <Card className="border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Tanggal</label>
          <Input type="date" data-testid="ks-input-date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-48 bg-white" />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : roster.length === 0 ? (
        <Card className="flex items-center gap-3 border-amber-200 bg-amber-50 p-6 text-amber-800" data-testid="ks-empty">
          <Info className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Belum ada Kasubid yang aktif sehingga absensi Kasubid tidak dapat dilakukan. Tetapkan pejabat melalui menu Pengaturan Kasubid.</p>
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
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => (
                  <tr key={e.id} data-testid={`ks-roster-${e.id}`} onClick={() => toggle(e.id)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors ${selected.has(e.id) ? "bg-amber-50/60" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} className="h-5 w-5" data-testid={`ks-check-${e.id}`} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5" /> {e.position_label}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">{e.nama}</td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{e.jabatan}</td>
                    <td className="px-3 py-3 text-center"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {roster.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:left-64">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 sm:grid-cols-6">
            {STATUSES.map((s) => (
              <Button key={s} disabled={saving} onClick={() => applyStatus(s)} data-testid={`ks-batch-${s}-btn`} className={`min-h-[48px] font-bold text-white ${STATUS_CONFIG[s].btn}`}>
                {STATUS_CONFIG[s].short}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-400">Tanpa memilih = berlaku untuk semua Kasubid aktif</p>
        </div>
      )}
    </div>
  );
}
