import { useEffect, useState, useCallback } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel, MONTH_NAMES } from "@/lib/constants";
import { MonthPicker } from "@/components/MonthPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Info, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

function addMonths(ym: string, n: number) {
  let [y, m] = ym.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function getDaysInPeriod(startYm: string, endYm: string) {
  if (!startYm || !endYm) return 0;
  let [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  let total = 0;
  while (sy < ey || (sy === ey && sm <= em)) {
    total += new Date(sy, sm, 0).getDate();
    sm++;
    if (sm > 12) {
      sm = 1;
      sy++;
    }
  }
  return total;
}

const curMonth = new Date().toISOString().slice(0, 7);
const QUICK = [{ k: 1, l: "1 Bulan" }, { k: 3, l: "3 Bulan" }, { k: 6, l: "6 Bulan" }, { k: 12, l: "12 Bulan" }, { k: 0, l: "Custom" }];

export default function RekapPeriode() {
  const [start, setStart] = useState(addMonths(curMonth, -2));
  const [end, setEnd] = useState(curMonth);
  const [quick, setQuick] = useState(3);
  const [teamId, setTeamId] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exp, setExp] = useState("");

  const totalPeriodDays = getDaysInPeriod(start, end);

  useEffect(() => { api.get("/teams").then((r) => setTeams(r.data)).catch((e) => toast.error(apiError(e))); }, []);

  const applyQuick = (k) => {
    setQuick(k);
    if (k > 0) setEnd(addMonths(start, k - 1));
  };
  const onStart = (v) => {
    setStart(v);
    if (quick > 0) setEnd(addMonths(v, quick - 1));
    else if (v > end) setEnd(v);
  };

  const load = useCallback(() => {
    if (start > end) return;
    setLoading(true);
    const params: Record<string, any> = { start, end };
    if (teamId !== "all") params.team_id = teamId;
    if (category !== "all") params.category = category;
    api.get("/recap/period", { params }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [start, end, teamId, category]);

  useEffect(() => { load(); }, [load]);

  const doExport = async (type: string) => {
    setExp(type);
    const params: Record<string, any> = { start, end };
    if (teamId !== "all") params.team_id = teamId;
    if (category !== "all") params.category = category;
    try {
      if (type === "excel") {
        params.include_breakdown = true; params.include_detail = false;
        await downloadFile("/export/excel", params, `Rekap_Periode_${start}_${end}.xlsx`);
      } else {
        params.include_summary = true; params.include_breakdown = true;
        await downloadFile("/export/pdf", params, `Rekap_Periode_${start}_${end}.pdf`);
      }
      toast.success("Laporan berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };

  const g = data?.grand_total || {};
  const months = data?.months || [];

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

  const filteredBreakdown = (data?.breakdown || []).filter((b: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const matchName = b.nama ? b.nama.toLowerCase().includes(q) : false;
    const matchNip = b.nip ? String(b.nip).toLowerCase().includes(q) : false;
    return matchName || matchNip;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Rekap Rentang Periode</h2>
        <p className="text-sm text-slate-500">Rekap akumulasi beberapa bulan + breakdown bulanan.</p>
      </div>

      <Card className="border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button
              key={q.k}
              variant={quick === q.k ? "default" : "outline"}
              onClick={() => applyQuick(q.k)}
              data-testid={`quick-${q.k}`}
              className={quick === q.k ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {q.l}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 flex flex-col">
            <label className="text-sm font-medium text-slate-600">Bulan Mulai</label>
            <MonthPicker
              data-testid="period-start"
              value={start}
              onChange={(val) => onStart(val)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5 flex flex-col">
            <label className="text-sm font-medium text-slate-600">Bulan Selesai</label>
            <MonthPicker
              data-testid="period-end"
              value={end}
              disabled={quick > 0}
              min={start}
              onChange={(val) => setEnd(val)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-600">Regu</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="h-11 bg-white" data-testid="period-team"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Regu</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-600">Kategori</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 bg-white" data-testid="period-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
                <SelectItem value="Kasubid">Kasubid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-600">Cari Pegawai</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Cari nama atau NIP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-9 pr-8 bg-white"
                data-testid="search-rekap-periode"
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
            Periode: {data?.period_label || `${monthLabel(start)} – ${monthLabel(end)}`} ({months.length} bulan)
          </span>
          <Button onClick={() => doExport("excel")} disabled={!!exp} data-testid="period-export-excel" className="ml-auto gap-2 bg-emerald-600 hover:bg-emerald-700">
            {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
          <Button onClick={() => doExport("pdf")} disabled={!!exp} data-testid="period-export-pdf" className="gap-2 bg-red-600 hover:bg-red-700">
            {exp === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </Card>

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

      <Tabs defaultValue="total">
        <TabsList>
          <TabsTrigger value="total" data-testid="tab-total">Rekap Total</TabsTrigger>
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">Breakdown per Bulan</TabsTrigger>
        </TabsList>

        <TabsContent value="total">
          <Card className="overflow-hidden border-slate-200">
            {loading ? 
            <TableSkeleton rows={8} columns={7} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-3">No</th>
                      <th className="px-3 py-3">NIP</th>
                      <th className="px-3 py-3">Nama</th>
                      <th className="px-3 py-3">Regu</th>
                      <th className="px-3 py-3">Kategori</th>
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
                                    Total Hari Periode ({data?.period_label || `${monthLabel(start)} – ${monthLabel(end)}`}):{" "}
                                    <span className="text-emerald-400">{totalPeriodDays} Hari</span>
                                  </p>
                                  <p className="text-[11px] text-slate-200">
                                    Rumus: <span className="font-mono font-bold text-amber-300">{totalPeriodDays} − Status OFF</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400 border-t border-slate-700/80 pt-1 mt-1">
                                    Akumulasi hari kalender periode ({totalPeriodDays} hari) dikurangi akumulasi status OFF per pegawai.
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
                      <tr key={r.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-400">{r.no}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.nip}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{r.nama}</td>
                        <td className="px-3 py-2.5 text-slate-500">{r.regu}</td>
                        <td className="px-3 py-2.5"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.category === "Kasubid" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.category}</span></td>
                        {STATUSES.map((s) => (
                          <td key={s} className="px-2 py-2.5 text-center font-semibold">
                            <span className={r[s] > 0 ? STATUS_CONFIG[s].text : "text-slate-300"}>{r[s]}</span>
                          </td>))}
                        <td className="px-3 py-2.5 text-center font-extrabold text-slate-700">{r.jumlah_hari_kerja}</td>
                        <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">{r.total_kehadiran}</td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-slate-400">
                          {search ? `Tidak ada pegawai yang sesuai dengan pencarian "${search}".` : "Tidak ada data pada periode ini."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td className="px-3 py-3" colSpan={5}>TOTAL ({filteredRows.length}{search ? ` dari ${data?.total_pegawai || 0}` : ""} pegawai)</td>
                      {STATUSES.map((s) => <td key={s} className="px-2 py-3 text-center">{displayGrand[s] ?? 0}</td>)}
                      <td className="px-3 py-3 text-center">{filteredRows.reduce((a: number, r: any) => a + (r.jumlah_hari_kerja || 0), 0)}</td>
                      <td className="px-3 py-3 text-center">{displayGrand.HDR ?? 0}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <p className="mb-2 text-xs text-slate-500">Setiap baris mengikuti regu pegawai pada bulan tersebut (histori rolling terjaga).</p>
          <Card className="overflow-hidden border-slate-200">
            {loading ? <TableSkeleton rows={8} columns={6} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-3">No</th>
                      <th className="px-3 py-3">Nama</th>
                      <th className="px-3 py-3">Regu</th>
                      <th className="px-3 py-3">Bulan</th>
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
                                    Total Hari Per Bulan Kalender
                                  </p>
                                  <p className="text-[11px] text-slate-200">
                                    Rumus: <span className="font-mono font-bold text-amber-300">Hari Bulan − Status OFF</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 border-t border-slate-700/80 pt-1 mt-1">
                                    Dihitung dari jumlah hari pada bulan baris terkait (28–31 hari) dikurangi akumulasi status OFF pegawai.
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
                    {filteredBreakdown.map((b: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`breakdown-row-${i}`}>
                        <td className="px-3 py-2.5 text-slate-400">{b.no}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{b.nama}</td>
                        <td className="px-3 py-2.5"><span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{b.regu}</span></td>
                        <td className="px-3 py-2.5 text-slate-500">{b.month_label}</td>
                        {STATUSES.map((s) => <td key={s} className="px-2 py-2.5 text-center font-semibold"><span className={b[s] > 0 ? STATUS_CONFIG[s].text : "text-slate-300"}>{b[s]}</span></td>)}
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{b.jumlah_hari_kerja}</td>
                        <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">{b.total_kehadiran}</td>
                      </tr>
                    ))}
                    {filteredBreakdown.length === 0 && (
                      <tr><td colSpan={12} className="py-10 text-center text-slate-400">{search ? `Tidak ada data yang sesuai dengan pencarian "${search}".` : "Tidak ada data pada periode ini."}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
