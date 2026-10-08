import { useEffect, useState, useCallback } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel } from "@/lib/constants";
import { MonthPicker } from "@/components/MonthPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Info, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const curMonth = new Date().toISOString().slice(0, 7);

export default function RekapBulanan() {
  const [month, setMonth] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exp, setExp] = useState("");

  const totalDaysMonth = month
    ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    : 0;

  useEffect(() => {
    api.get("/teams").then((r) => setTeams(r.data)).catch((e) => toast.error(apiError(e)));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, any> = { month };
    if (teamId !== "all") params.team_id = teamId;
    if (category !== "all") params.category = category;
    api
      .get("/recap/monthly", { params })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [month, teamId, category]);

  useEffect(() => { load(); }, [load]);

  const doExport = async (type: string) => {
    setExp(type);
    const params: Record<string, any> = { start: month, end: month };
    if (teamId !== "all") params.team_id = teamId;
    if (category !== "all") params.category = category;
    try {
      if (type === "excel") {
        params.include_breakdown = false;
        params.include_detail = true;
        await downloadFile("/export/excel", params, `Rekap_Bulanan_${month}.xlsx`);
      } else {
        params.include_summary = true;
        await downloadFile("/export/pdf", params, `Rekap_Bulanan_${month}.pdf`);
      }
      toast.success("Laporan berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };

  const g = data?.grand_total || {};

  const filteredRows = (data?.rows || []).filter((r: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const matchName = r.nama ? r.nama.toLowerCase().includes(q) : false;
    const matchNip = r.nip ? String(r.nip).toLowerCase().includes(q) : false;
    return matchName || matchNip;
  });

  const filteredGrand = filteredRows.reduce((acc: any, r: any) => {
    STATUSES.forEach((s) => {
      acc[s] = (acc[s] || 0) + (r[s] || 0);
    });
    return acc;
  }, {});

  const displayGrand = search.trim() ? filteredGrand : g;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Rekap Bulanan</h2>
          <p className="text-sm text-slate-500">Rekap kehadiran {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} data-testid="rekap-month" />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-10 w-42 bg-white" data-testid="rekap-team"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Regu</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 w-38 bg-white" data-testid="rekap-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
              <SelectItem value="Kasubid">Kasubid</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-[200px] flex-1 sm:flex-initial sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Cari nama atau NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 pr-8 bg-white"
              data-testid="search-rekap-month"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={() => doExport("excel")} disabled={!!exp} data-testid="export-excel-btn" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
          <Button onClick={() => doExport("pdf")} disabled={!!exp} data-testid="export-pdf-btn" className="gap-2 bg-red-600 hover:bg-red-700">
            {exp === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {loading ? (
          <>
            <Card className="border-slate-200 bg-slate-900 p-3 text-center text-white">
              <Skeleton className="mx-auto h-8 w-12 bg-slate-800" />
              <p className="mt-1 text-[11px] text-slate-300">Pegawai</p>
            </Card>
            {STATUSES.map((s) => (
              <Card key={s} className="border border-slate-200 p-3 text-center">
                <Skeleton className="mx-auto h-8 w-10" />
                <p className="mt-1 text-[11px] font-semibold text-slate-400">{s}</p>
              </Card>
            ))}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200">
        {loading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">No</th>
                  <th className="px-3 py-3">NIP</th>
                  <th className="px-3 py-3">Nama</th>
                  <th className="px-3 py-3">Regu</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Jabatan</th>
                  {STATUSES.map((s) => <th key={s} className="px-2 py-3 text-center">{s}</th>)}
                  <th className="px-3 py-3 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span>Jumlah Hari Kerja</span>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-pointer items-center text-blue-500 hover:text-blue-700 transition-colors p-0.5 rounded-full hover:bg-blue-50">
                              <Info className="h-3.5 w-3.5 shrink-0" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs p-3 text-center shadow-xl">
                            <div className="space-y-1">
                              <p className="font-bold text-white text-xs">
                                Total Hari {month ? monthLabel(month) : "Bulan"}: <span className="text-emerald-400">{totalDaysMonth} Hari</span>
                              </p>
                              <p className="text-[11px] text-slate-200">
                                Rumus: <span className="font-mono font-bold text-amber-300">{totalDaysMonth} − Status OFF</span>
                              </p>
                              <p className="text-[11px] text-slate-400 border-t border-slate-700/80 pt-1 mt-1">
                                Hari kerja dihitung dari total hari kalender bulan ({totalDaysMonth} hari) dikurangi akumulasi status OFF per pegawai.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center">Total Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r: any) => (
                  <tr key={r.employee_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`rekap-row-${r.employee_id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{r.no}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.nip}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{r.nama}</td>
                    <td className="px-3 py-2.5 text-slate-500">{r.regu}</td>
                    <td className="px-3 py-2.5"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.category === "Kasubid" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.category}</span></td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{r.jabatan}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-2 py-2.5 text-center font-semibold">
                        <span className={r[s] > 0 ? STATUS_CONFIG[s].text : "text-slate-300"}>{r[s]}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{r.jumlah_hari_kerja}</td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">{r.total_kehadiran}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      {search ? `Tidak ada pegawai yang sesuai dengan pencarian "${search}".` : "Tidak ada data pada bulan ini."}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <td className="px-3 py-3" colSpan={5}>TOTAL ({filteredRows.length}{search ? ` dari ${data?.total_pegawai || 0}` : ""} pegawai)</td>
                  <td className="hidden lg:table-cell" />
                  {STATUSES.map((s) => (
                    <td key={s} className="px-2 py-3 text-center">{displayGrand[s] ?? 0}</td>
                  ))}
                  <td className="px-3 py-3 text-center">{filteredRows.reduce((a: number, r: any) => a + (r.jumlah_hari_kerja || 0), 0)}</td>
                  <td className="px-3 py-3 text-center">{displayGrand.HDR ?? 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
