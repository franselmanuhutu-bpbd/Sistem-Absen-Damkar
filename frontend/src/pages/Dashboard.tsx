import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Users, Flame, Star, AlertCircle, ArrowRight } from "lucide-react";
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
  total_employees: number;
  totals: Record<string, number>;
  per_team: PerTeamData[];
  kasubid: KasubidData[];
}

function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const [date, setDate] = useState<string>(getTodayLocal);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get("/dashboard", { params: { date } })
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((err) => {
        console.error("Gagal memuat data dashboard:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const totals = data?.totals || {};
  const totalRecorded = Object.values(totals).reduce((a, b) => a + (b || 0), 0);
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
          <Input
            type="date"
            data-testid="dashboard-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-44 bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {loading ? (
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
      {loading ? (
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

      {/* Empty notice for date with 0 attendance */}
      {!loading && totalRecorded === 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Belum ada data kehadiran pada tanggal ini</p>
              <p className="text-xs text-amber-700">Grafik dan statistik kehadiran per regu masih bernilai 0.</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 gap-1.5 text-xs self-start sm:self-auto">
            <Link to="/input-absensi">
              Input Absensi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Chart */}
      <Card className="border-slate-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="font-heading text-base font-bold text-slate-800">Grafik Kehadiran per Regu</h3>
            <p className="text-xs text-slate-500">Komposisi status kehadiran regu operasional</p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3">
            {STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s].hex }} />
                <span className="font-medium">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-72 w-full flex items-end gap-6 pt-6 pb-2 px-6">
            {[55, 80, 45, 90, 65, 75].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [val, STATUS_CONFIG[name]?.label || name]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                {STATUSES.map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={s}
                    stackId="a"
                    fill={STATUS_CONFIG[s].hex}
                    radius={s === "DL" ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Per team cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-base font-bold text-slate-800">Statistik per Regu</h3>
          {!loading && (data?.per_team?.length ?? 0) > 0 && (
            <span className="text-xs text-slate-500">{data?.per_team?.length} Regu Operasional</span>
          )}
        </div>

        {loading ? (
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.per_team || []).map((t) => (
              <Card key={t.team.id} data-testid={`team-card-${t.team.code}`} className="border-slate-200 p-5 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-slate-900">{t.team.name}</p>
                      <p className="text-xs text-slate-400">
                        {t.members} anggota · ⭐ {t.commander_name || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {STATUSES.map((s) => (
                    <div key={s} className={`rounded-lg border p-2 text-center transition-transform ${STATUS_CONFIG[s].badge}`}>
                      <p className="text-lg font-extrabold leading-none">{t[s] ?? 0}</p>
                      <p className="text-[10px] font-semibold mt-1">{s}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
