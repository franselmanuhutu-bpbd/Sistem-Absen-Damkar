import { useEffect, useState, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { STATUSES, STATUS_CONFIG, formatDateId } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthPicker } from "@/components/MonthPicker";
import { Search, Loader2, RotateCcw } from "lucide-react";

const curMonth = new Date().toISOString().slice(0, 7);
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function Kalender() {
  const [month, setMonth] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [teams, setTeams] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any[]>([]);
  const [activeDay, setActiveDay] = useState("");

  // Filters for Detail modal
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    api.get("/teams").then((r) => setTeams(r.data)).catch((e) => toast.error(apiError(e)));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { month };
    if (teamId !== "all") params.team_id = teamId;
    api
      .get("/calendar", { params })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [month, teamId]);

  const openDay = (dstr: any) => {
    setActiveDay(dstr);
    setSearchQuery("");
    setFilterTeam("all");
    setFilterStatus("all");
    setDetail([]);
    setDetailLoading(true);
    setOpen(true);

    const params: Record<string, string> = { date: dstr };
    if (teamId !== "all") params.team_id = teamId;
    api
      .get("/attendance/day", { params })
      .then((r) => {
        setDetail(r.data);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setDetailLoading(false));
  };

  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Detail status summary counts
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const r of detail) {
      if (r.status && counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    }
    return counts;
  }, [detail]);

  // Unique teams inside current day detail
  const detailTeams = useMemo(() => {
    const set = new Set<string>();
    for (const r of detail) {
      if (r.regu) set.add(r.regu);
    }
    return Array.from(set).sort();
  }, [detail]);

  // Filtered detail list
  const filteredDetail = useMemo(() => {
    return detail.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNama = (r.nama || "").toLowerCase().includes(q);
        const matchNip = (r.nip || "").toLowerCase().includes(q);
        if (!matchNama && !matchNip) return false;
      }
      if (filterTeam !== "all") {
        if ((r.regu || "Tanpa Regu") !== filterTeam) return false;
      }
      if (filterStatus !== "all") {
        if (r.status !== filterStatus) return false;
      }
      return true;
    });
  }, [detail, searchQuery, filterTeam, filterStatus]);

  const hasActiveFilters = searchQuery !== "" || filterTeam !== "all" || filterStatus !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Kalender Absensi</h2>
          <p className="text-sm text-slate-500">Ringkasan harian — klik tanggal untuk detail.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} data-testid="calendar-month" />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-10 w-40 bg-white" data-testid="calendar-team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Regu</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-200 p-4">
        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-400">
          {DOW.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {loading ? (
            Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[70px] rounded-lg border border-slate-100 bg-slate-50/60 p-2 sm:min-h-[92px] animate-pulse"
              >
                <div className="h-3 w-4 rounded bg-slate-200" />
              </div>
            ))
          ) : (
            cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dstr = `${month}-${String(d).padStart(2, "0")}`;
              const counts = data?.days?.[dstr] || {};
              const total = STATUSES.reduce((a, s) => a + (counts[s] || 0), 0);
              return (
                <button
                  key={i}
                  data-testid={`cal-day-${dstr}`}
                  onClick={() => openDay(dstr)}
                  className="group flex min-h-[70px] flex-col rounded-lg border border-slate-200 bg-white p-1.5 text-left transition-all hover:border-red-300 hover:shadow-sm sm:min-h-[92px]"
                >
                  <span className="text-xs font-bold text-slate-600 group-hover:text-red-600">{d}</span>
                  {total > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 justify-between">
                      {STATUSES.filter((s) => counts[s] > 0).map((s) => (
                        <span
                          key={s}
                          className={`rounded p-2 text-[11px] font-bold leading-tight ${STATUS_CONFIG[s].badge}`}
                        >
                          {counts[s]}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* Redesigned Detail Absensi Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Detail Absensi — {formatDateId(activeDay)}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Daftar status absensi seluruh personil yang tercatat pada tanggal {formatDateId(activeDay)}.
            </DialogDescription>
          </DialogHeader>

          {/* Status summary pills */}
          {!detailLoading && detail.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
              <span className="text-xs font-bold text-slate-500 mr-1">Rekap:</span>
              {STATUSES.map((s) => {
                const count = dayCounts[s] || 0;
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      count > 0 ? STATUS_CONFIG[s].badge : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span>{s}:</span>
                    <span className="font-bold">{count}</span>
                  </span>
                );
              })}
              <span className="ml-auto text-xs font-medium text-slate-500">
                Total: <strong className="text-slate-800">{detail.length}</strong> personil
              </span>
            </div>
          )}

          {/* Filter and search bar */}
          {!detailLoading && detail.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari nama atau NIP personil..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="h-10 w-36 bg-white">
                    <SelectValue placeholder="Semua Regu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Regu</SelectItem>
                    {detailTeams.map((tm) => (
                      <SelectItem key={tm} value={tm}>
                        {tm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 w-36 bg-white">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} — {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterTeam("all");
                      setFilterStatus("all");
                    }}
                    className="h-10 gap-1.5 text-slate-500 hover:text-slate-800"
                    title="Reset Filter"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Content table or loading/empty state */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 mt-2 min-h-[220px]">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                <p className="text-sm font-medium text-slate-600">Memuat detail absensi...</p>
              </div>
            ) : detail.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <p className="font-semibold text-slate-600">Belum ada data absensi pada tanggal ini.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Input data melalui menu Input Absensi atau Absensi Kasubid.
                </p>
              </div>
            ) : filteredDetail.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                <p className="font-semibold text-slate-600">Tidak ada personil yang sesuai dengan pencarian/filter.</p>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci atau bersihkan filter.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterTeam("all");
                    setFilterStatus("all");
                  }}
                  className="mt-3 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Bersihkan Filter
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-3 py-2.5 text-center">No</th>
                    <th className="px-4 py-2.5">Nama &amp; NIP</th>
                    <th className="hidden px-4 py-2.5 md:table-cell">Jabatan</th>
                    <th className="px-4 py-2.5">Regu</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDetail.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 text-center text-xs text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-800">{r.nama}</p>
                        <p className="font-mono text-xs text-slate-400">{r.nip || "-"}</p>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs text-slate-500 md:table-cell">
                        {r.jabatan || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {r.regu || "Tanpa Regu"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
