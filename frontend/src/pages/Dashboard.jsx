import { useEffect, useState } from "react";
import api from "@/lib/api";
import { STATUSES, STATUS_CONFIG } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Users, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

const today = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard", { params: { date } }).then((r) => setData(r.data));
  }, [date]);

  const totals = data?.totals || {};
  const chartData = (data?.per_team || []).map((t) => ({
    name: t.team.name.replace("Regu ", "R"),
    ...STATUSES.reduce((a, s) => ({ ...a, [s]: t[s] }), {}),
  }));

  return (
    <div className="space-y-6">
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
            className="h-10 w-44 bg-white"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Card data-testid="stat-total" className="col-span-2 flex items-center gap-4 border-slate-200 bg-[#0F172A] p-5 text-white sm:col-span-1 xl:col-span-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-extrabold leading-none">{data?.total_employees ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-300">Total Pegawai</p>
          </div>
        </Card>
        {STATUSES.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <Card key={s} data-testid={`stat-${s}`} className="flex flex-col justify-between border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="text-xs font-bold text-slate-500">{s}</span>
              </div>
              <p className={`mt-2 text-2xl font-extrabold ${c.text}`}>{totals[s] ?? 0}</p>
              <p className="text-[11px] text-slate-400">{c.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card className="border-slate-200 p-5">
        <h3 className="font-heading text-base font-bold text-slate-800 mb-4">Grafik Kehadiran per Regu</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              {STATUSES.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" radius={s === "DL" ? [4, 4, 0, 0] : 0}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={STATUS_CONFIG[s].hex} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per team cards */}
      <div>
        <h3 className="font-heading text-base font-bold text-slate-800 mb-3">Statistik per Regu</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.per_team || []).map((t) => (
            <Card key={t.team.id} data-testid={`team-card-${t.team.code}`} className="border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-slate-900">{t.team.name}</p>
                    <p className="text-xs text-slate-400">{t.members} anggota</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {STATUSES.map((s) => (
                  <div key={s} className={`rounded-lg border p-2 text-center ${STATUS_CONFIG[s].badge}`}>
                    <p className="text-lg font-extrabold leading-none">{t[s]}</p>
                    <p className="text-[10px] font-semibold mt-1">{s}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
