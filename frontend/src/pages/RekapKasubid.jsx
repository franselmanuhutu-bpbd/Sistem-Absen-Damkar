import { useEffect, useState, useCallback } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Star, FileSpreadsheet, FileText, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

function addMonths(ym, n) {
  let [y, m] = ym.split("-").map(Number);
  m += n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
const curMonth = new Date().toISOString().slice(0, 7);

export default function RekapKasubid() {
  const [start, setStart] = useState(addMonths(curMonth, -2));
  const [end, setEnd] = useState(curMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exp, setExp] = useState("");
  const [detailPos, setDetailPos] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(() => {
    if (start > end) { toast.error("Periode tidak valid"); return; }
    setLoading(true);
    api.get("/recap/kasubid", { params: { start, end } }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [start, end]);
  useEffect(() => { load(); }, [load]);

  const doExport = async (type) => {
    setExp(type);
    try {
      await downloadFile(`/export/kasubid/${type}`, { start, end }, `Rekap_Kasubid_${start}_${end}.${type === "excel" ? "xlsx" : "pdf"}`);
      toast.success("Laporan Kasubid diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };

  const detailRows = (data?.detail || []).filter((d) =>
    (!detailPos || d.position_id === detailPos) && (filterStatus === "all" || d.status === filterStatus)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Rekap Absensi Kasubid</h2>
          <p className="text-sm text-slate-500">Rekap kehadiran pejabat Kasubid 1 &amp; Kasubid 2 (historis per tanggal).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="month" data-testid="kasubid-start" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} className="h-10 w-40 bg-white" />
          <Input type="month" data-testid="kasubid-end" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 w-40 bg-white" />
          <Button onClick={() => doExport("excel")} disabled={exp} data-testid="kasubid-excel" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
          <Button onClick={() => doExport("pdf")} disabled={exp} data-testid="kasubid-pdf" className="gap-2 bg-red-600 hover:bg-red-700">
            {exp === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(data?.positions || []).map((p) => (
            <Card key={p.position_id} className="border-slate-200 p-5" data-testid={`kasubid-card-${p.position_id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Star className="h-6 w-6" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">{p.label}</p>
                    <p className="font-heading text-lg font-bold text-slate-900">{p.nama}</p>
                    <p className="text-xs text-slate-400">{monthLabel(start)} – {monthLabel(end)}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setDetailPos(p.position_id); setFilterStatus("all"); }} data-testid={`kasubid-detail-${p.position_id}`}>
                  <Eye className="h-4 w-4" /> Detail
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STATUSES.map((s) => (
                  <div key={s} className={`rounded-lg border p-2 text-center ${STATUS_CONFIG[s].badge}`}>
                    <p className="text-xl font-extrabold leading-none">{p[s]}</p>
                    <p className="text-[10px] font-semibold mt-1">{s}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-sm text-slate-500">Total hari tercatat: <span className="font-bold text-slate-900">{p.total}</span></p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detailPos} onOpenChange={(o) => !o && setDetailPos(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Absensi {detailPos && data?.positions.find((p) => p.position_id === detailPos)?.label}</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-48" data-testid="kasubid-filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Tanggal</th><th className="py-2">Nama</th><th className="py-2 text-right">Status</th></tr></thead>
            <tbody>
              {detailRows.map((d, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs">{d.date}</td>
                  <td className="py-2 text-slate-700">{d.nama}</td>
                  <td className="py-2 text-right"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
              {detailRows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-400">Tidak ada data.</td></tr>}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
