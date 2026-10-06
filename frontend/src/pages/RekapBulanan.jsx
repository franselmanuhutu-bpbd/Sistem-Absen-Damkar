import { useEffect, useState, useCallback } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const curMonth = new Date().toISOString().slice(0, 7);

export default function RekapBulanan() {
  const [month, setMonth] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [teams, setTeams] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exp, setExp] = useState("");

  useEffect(() => {
    api.get("/teams").then((r) => setTeams(r.data));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { month };
    if (teamId !== "all") params.team_id = teamId;
    api.get("/recap/monthly", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [month, teamId]);

  useEffect(() => { load(); }, [load]);

  const doExport = async (type) => {
    setExp(type);
    const params = { start: month, end: month };
    if (teamId !== "all") params.team_id = teamId;
    try {
      if (type === "excel") {
        params.include_breakdown = false;
        params.include_detail = true;
        await downloadFile("/export/excel", params, `Rekap_${month}.xlsx`);
      } else {
        params.include_summary = true;
        await downloadFile("/export/pdf", params, `Rekap_${month}.pdf`);
      }
      toast.success("Laporan berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };

  const g = data?.grand_total || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Rekap Bulanan</h2>
          <p className="text-sm text-slate-500">Rekap kehadiran {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="month" data-testid="rekap-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-40 bg-white" />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-10 w-40 bg-white" data-testid="rekap-team"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Regu</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => doExport("excel")} disabled={exp} data-testid="export-excel-btn" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
          <Button onClick={() => doExport("pdf")} disabled={exp} data-testid="export-pdf-btn" className="gap-2 bg-red-600 hover:bg-red-700">
            {exp === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card className="border-slate-200 bg-slate-900 p-3 text-center text-white">
          <p className="text-2xl font-extrabold">{data?.total_pegawai ?? 0}</p>
          <p className="text-[11px] text-slate-300">Pegawai</p>
        </Card>
        {STATUSES.map((s) => (
          <Card key={s} className={`border p-3 text-center ${STATUS_CONFIG[s].badge}`}>
            <p className="text-2xl font-extrabold">{g[s] ?? 0}</p>
            <p className="text-[11px] font-semibold">{s}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-slate-200">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">No</th>
                  <th className="px-3 py-3">NIP</th>
                  <th className="px-3 py-3">Nama</th>
                  <th className="px-3 py-3">Regu</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Jabatan</th>
                  {STATUSES.map((s) => <th key={s} className="px-2 py-3 text-center">{s}</th>)}
                  <th className="px-3 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((r) => (
                  <tr key={r.employee_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`rekap-row-${r.employee_id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{r.no}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.nip}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{r.nama}</td>
                    <td className="px-3 py-2.5 text-slate-500">{r.regu}</td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{r.jabatan}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-2 py-2.5 text-center font-semibold">
                        <span className={r[s] > 0 ? STATUS_CONFIG[s].text : "text-slate-300"}>{r[s]}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <td className="px-3 py-3" colSpan={4}>TOTAL ({data?.total_pegawai || 0} pegawai)</td>
                  <td className="hidden lg:table-cell" />
                  {STATUSES.map((s) => <td key={s} className="px-2 py-3 text-center">{g[s] ?? 0}</td>)}
                  <td className="px-3 py-3 text-center">{STATUSES.reduce((a, s) => a + (g[s] || 0), 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
