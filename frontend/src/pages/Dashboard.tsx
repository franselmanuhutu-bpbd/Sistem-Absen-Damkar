import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, formatDateId, monthLabel } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { Users, Flame, Star, AlertCircle, ArrowRight, RefreshCw, Calendar, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
}

interface TeamData {
  id: string;
  name: string;
  code: string;
  order: number;
}

interface PerTeamData {
  team: TeamData;
  members: number;
  commander_id?: string | null;
  commander_name?: string | null;
  current_commander_id?: string | null;
  current_commander_name?: string | null;
  [status: string]: any;
}

interface KasubidData {
  position_id: string;
  label: string;
  employee_id?: string | null;
  nama?: string | null;
  status: string;
}

interface DashboardResponse {
  date: string;
  today?: string;
  latest_date?: string | null;
  has_attendance_today?: boolean;
  is_fallback_to_latest?: boolean;
  total_employees: number;
  totals: Record<string, number>;
  per_team: PerTeamData[];
  monthly_period?: string;
  monthly_leaderboard?: MonthlyLeaderboardItem[];
  kasubid: KasubidData[];
}

interface MonthlyLeaderboardItem {
  team: TeamData;
  hadir: number;
}

function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const [date, setDate] = useState<string>("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const loadedDateRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const maxAttempts = 3;

    const isRetryable = (err: any) => {
      const status = err?.response?.status;
      return !status || status >= 500 || status === 408 || status === 429;
    };

    const wait = (milliseconds: number) =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    const loadDashboard = async () => {
      setLoadError(null);
      let lastError: any;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const params = date ? { date } : {};
          const response = await api.get<DashboardResponse>("/dashboard", {
            params,
          });
          if (!response.data?.totals || !Array.isArray(response.data?.per_team)) {
            throw new Error("Respons dashboard tidak memiliki struktur data yang valid.");
          }
          if (active) {
            setData(response.data);
            loadedDateRef.current = response.data.date;
          }
          return;
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts && isRetryable(err)) {
            await wait(500 * 2 ** (attempt - 1));
          } else {
            break;
          }
        }
      }

      if (active) {
        setLoadError(apiError(lastError));
      }
    };

    setLoading(true);
    loadDashboard().finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [date, retryToken]);

  const totals = data?.totals || {};
  const totalRecorded = Object.values(totals).reduce((a, b) => a + (b || 0), 0);
  const showSkeleton = loading || !data;
  const chartData = (data?.per_team || []).map((t) => ({
    name: t.team.name.replace("Regu ", "R"),
    ...STATUSES.reduce((a, s) => ({ ...a, [s]: t[s] ?? 0 }), {}),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Dashboard Absensi</h2>
          <p className="text-sm text-slate-500">Ringkasan kehadiran pegawai harian per regu</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Tanggal</span>
          <DatePicker
            data-testid="dashboard-date"
            value={date || data?.date || ""}
            onChange={(val) => setDate(val)}
            className="w-64"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {showSkeleton ? (
          <>
            <Card className="col-span-2 flex items-center gap-4 border-slate-200 bg-[#0F172A] p-5 text-white sm:col-span-1 xl:col-span-1">
              <Skeleton className="h-12 w-12 rounded-xl bg-slate-800" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-12 bg-slate-800" />
                <Skeleton className="h-3 w-20 bg-slate-800" />
              </div>
            </Card>
            {STATUSES.map((s) => (
              <Card key={s} className="flex flex-col justify-between border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="my-2 h-7 w-10" />
                <Skeleton className="h-3 w-16" />
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card data-testid="stat-total" className="col-span-2 flex items-center gap-4 border-slate-200 bg-[#0F172A] p-5 text-white sm:col-span-1 xl:col-span-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-sm shadow-red-500/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-extrabold leading-none">{data?.total_employees ?? 0}</p>
                <p className="mt-1 text-xs text-slate-300">Total Pegawai</p>
              </div>
            </Card>
            {STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <Card key={s} data-testid={`stat-${s}`} className="flex flex-col justify-between border-slate-200 p-4 transition-all hover:shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                    <span className="text-xs font-bold text-slate-500">{s}</span>
                  </div>
                  <p className={`mt-2 text-2xl font-extrabold ${c.text}`}>{totals[s] ?? 0}</p>
                  <p className="text-[11px] text-slate-400">{c.label}</p>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Org structure: Kasubid */}
      {showSkeleton ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="flex items-center gap-4 border-slate-200 p-4">
              <Skeleton className="h-11 w-11 rounded-xl bg-amber-50" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        data?.kasubid && data.kasubid.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.kasubid.map((k) => (
              <Card key={k.position_id} data-testid={`kasubid-${k.position_id}`} className="flex items-center gap-4 border-slate-200 p-4 transition-all hover:shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Star className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                  <p className="font-heading text-lg font-bold text-slate-900">{k.nama || "Belum Diisi / Kosong"}</p>
                  <p className="text-[11px] font-semibold" style={{ color: k.status === "Aktif" ? "#16A34A" : "#94A3B8" }}>
                    Status: {k.status || (k.nama ? "Aktif" : "Kosong")}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {!loading && loadError && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold">Dashboard gagal dimuat</p>
              <p className="text-xs text-red-700">{loadError}</p>
              <p className="mt-1 text-xs text-red-600">Periksa koneksi atau status server, lalu coba lagi.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 self-start border-red-300 bg-white text-red-900 hover:bg-red-100/50 sm:self-auto"
            onClick={() => setRetryToken((value) => value + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </Button>
        </div>
      )}

      {/* Notice when auto-falling back to latest attendance data */}
      {!loading && data && data.is_fallback_to_latest && (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950 sm:flex-row sm:items-center sm:justify-between shadow-sm">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
            <div>
              <p className="text-sm font-semibold">
                Menampilkan data absensi terakhir ({formatDateId(data.date)})
              </p>
              <p className="text-xs text-sky-700 mt-0.5">
                Data absensi untuk hari ini ({formatDateId(data.today || getTodayLocal())}) belum diinput.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {data.today && data.today !== data.date && (
              <Button
                size="sm"
                variant="outline"
                className="border-sky-300 bg-white hover:bg-sky-100/60 text-sky-900 text-xs gap-1.5"
                onClick={() => setDate(data.today!)}
              >
                Lihat Hari Ini ({formatDateId(data.today)})
              </Button>
            )}
            <Button asChild size="sm" className="bg-sky-700 hover:bg-sky-800 text-white text-xs gap-1.5">
              <Link to="/input-absensi">
                Input Absensi Hari Ini <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Empty notice for date with 0 attendance */}
      {!loading && data && !loadError && totalRecorded === 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">
                Belum ada data kehadiran pada tanggal ini ({formatDateId(date || data.date)})
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {data.latest_date && data.latest_date !== (date || data.date)
                  ? `Data absensi terakhir yang tersedia adalah tanggal ${formatDateId(data.latest_date)}.`
                  : "Grafik dan statistik kehadiran per regu masih bernilai 0."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {data.latest_date && data.latest_date !== (date || data.date) && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 text-xs"
                onClick={() => setDate(data.latest_date!)}
              >
                Tampilkan Data Terakhir ({formatDateId(data.latest_date)})
              </Button>
            )}
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5">
              <Link to="/input-absensi">
                Input Absensi <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">

        {/* Monthly leaderboard */}
        <Card className="flex h-full flex-col border-slate-200 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-800">Leaderboard Regu Bulan ini</h3>
              <p className="text-xs text-slate-500">
                Peringkat regu berdasarkan jumlah Hadir · {monthLabel(data?.monthly_period)}
              </p>
            </div>
            <Flame className="h-5 w-5 shrink-0 text-amber-500" />
          </div>
          {showSkeleton ? (
            <div className="flex flex-1 flex-col gap-2">
              {[1, 2, 3, 4, 5, 6].map((rank) => (
                <Skeleton key={rank} className="h-12 min-h-12 w-full flex-1" />
              ))}
            </div>
          ) : (data?.monthly_leaderboard?.length ?? 0) === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Belum ada data leaderboard bulan ini.
            </p>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {data?.monthly_leaderboard?.map((item, index) => (
                <div
                  key={item.team.id}
                  data-testid={`monthly-leaderboard-${item.team.code}`}
                  className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${index === 0
                      ? "bg-amber-100 text-amber-700"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-white text-slate-500"
                    }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{item.team.name}</p>
                    <p className="text-xs text-slate-500">Total kehadiran bulan ini</p>
                  </div>
                  <p className="shrink-0 text-lg font-extrabold text-emerald-600">
                    {item.hadir} <span className="text-xs font-semibold text-slate-500">Hadir</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Statistics */}
        <Card className="flex h-full flex-col border-slate-200 p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-800">Statistik per Regu</h3>
            </div>
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-slate-200 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((j) => (
                      <Skeleton key={j} className="h-12 rounded-lg" />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.per_team || []).map((t) => (
                <Card key={t.team.id} data-testid={`team-card-${t.team.code}`} className="flex h-full flex-col border-slate-200 p-5 transition-all hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <Flame className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-heading font-bold text-slate-900">{t.team.name}</p>
                        <p className="text-xs text-slate-500">
                          {t.members} anggota · ⭐ {t.commander_name || "—"}
                        </p>
                        {t.current_commander_name && t.current_commander_name !== t.commander_name && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Saat ini: ⭐ {t.current_commander_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid flex-1 grid-cols-3 items-stretch gap-2">
                    {STATUSES.map((s) => (
                      <div key={s} className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-transform ${STATUS_CONFIG[s].badge}`}>
                        <p className="text-lg font-extrabold leading-none">{t[s] ?? 0}</p>
                        <p className="text-[10px] font-semibold mt-1">{s}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
