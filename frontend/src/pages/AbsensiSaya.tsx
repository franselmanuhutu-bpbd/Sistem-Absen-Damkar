import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthPicker } from "@/components/MonthPicker";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserCircle, Flame, Star, Loader2, Calendar as CalIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function addMonths(ym, n) {
  let [y, m] = ym.split("-").map(Number);
  m += n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
const curMonth = new Date().toISOString().slice(0, 7);
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function AbsensiSaya() {
  const [profile, setProfile] = useState(null);
  const [start, setStart] = useState(addMonths(curMonth, -2));
  const [end, setEnd] = useState(curMonth);
  const [recap, setRecap] = useState(null);
  const [month, setMonth] = useState(curMonth);
  const [cal, setCal] = useState(null);
  const [assigns, setAssigns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/me/profile").then((r) => setProfile(r.data)).catch((e) => setErr(apiError(e)));
    api.get("/me/assignments").then((r) => setAssigns(r.data)).catch(() => {});
  }, []);

  const loadRecap = useCallback(() => {
    if (start > end) return;
    api.get("/me/recap", { params: { start, end } }).then((r) => setRecap(r.data)).catch((e) => setErr(apiError(e)));
  }, [start, end]);
  useEffect(() => { loadRecap(); }, [loadRecap]);
  useEffect(() => { api.get("/me/calendar", { params: { month } }).then((r) => setCal(r.data)).catch(() => {}); }, [month]);

  if (err) return <Card className="border-amber-200 bg-amber-50 p-8 text-center text-amber-700">{err}</Card>;
  if (!profile) return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-[#0F172A] p-6 text-white">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl bg-slate-800" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48 bg-slate-800" />
            <Skeleton className="h-4 w-64 bg-slate-800" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-slate-200 p-4">
            <Skeleton className="h-4 w-12 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    </div>
  );

  const e = profile.employee;
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <Card className="border-slate-200 bg-[#0F172A] p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-2xl font-extrabold">
            {e.nama?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-xl font-bold">{e.nama}</h2>
            <p className="text-sm text-slate-300">{e.jabatan} · {e.pangkat}</p>
            <p className="font-mono text-xs text-slate-400">NIP {e.nip}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/10 text-white hover:bg-white/10 gap-1.5"><Flame className="h-3.5 w-3.5" /> {profile.team?.name || "Belum ada regu"}</Badge>
            {profile.commander && <Badge className="bg-white/10 text-white hover:bg-white/10 gap-1.5"><Star className="h-3.5 w-3.5" /> Komandan: {profile.commander}</Badge>}
            {profile.is_commander && <Badge className="bg-amber-500 text-white hover:bg-amber-500">⭐ Anda Komandan Regu</Badge>}
            {profile.kasubid_position && <Badge className="bg-amber-500 text-white hover:bg-amber-500">{profile.kasubid_position}</Badge>}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="rekap">
        <TabsList>
          <TabsTrigger value="rekap" data-testid="my-tab-rekap">Rekap Saya</TabsTrigger>
          <TabsTrigger value="kalender" data-testid="my-tab-kalender">Kalender Saya</TabsTrigger>
          <TabsTrigger value="regu" data-testid="my-tab-regu">Riwayat Regu</TabsTrigger>
        </TabsList>

        <TabsContent value="rekap" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Periode:</span>
            <MonthPicker
              data-testid="my-start"
              value={start}
              onChange={(val) => {
                setStart(val);
                if (val > end) setEnd(val);
              }}
            />
            <span className="text-slate-400 text-xs font-semibold">s/d</span>
            <MonthPicker
              data-testid="my-end"
              value={end}
              min={start}
              onChange={(val) => setEnd(val)}
            />
          </div>
          <p className="text-sm text-slate-500">Transparansi absensi — klik kartu status untuk melihat tanggalnya.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setDetail(s)} data-testid={`my-status-${s}`}
                className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${STATUS_CONFIG[s].badge}`}>
                <p className="text-3xl font-extrabold leading-none">{recap?.counts?.[s] ?? 0}</p>
                <p className="mt-1 text-xs font-bold">{s} — {STATUS_CONFIG[s].label}</p>
                <p className="mt-2 text-[10px] opacity-70">Klik lihat tanggal →</p>
              </button>
            ))}
          </div>
          <Card className="border-slate-200 p-4 text-center">
            <span className="text-sm text-slate-500">Total hari tercatat {recap?.period_label}: </span>
            <span className="text-xl font-extrabold text-slate-900">{recap?.total ?? 0}</span>
          </Card>
        </TabsContent>

        <TabsContent value="kalender">
          <div className="mb-3 flex items-center gap-2">
            <MonthPicker
              data-testid="my-cal-month"
              value={month}
              onChange={(val) => setMonth(val)}
            />
          </div>
          <Card className="border-slate-200 p-4">
            <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-400">
              {DOW.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const dstr = `${month}-${String(d).padStart(2, "0")}`;
                const info = cal?.days?.[dstr];
                const c = info ? STATUS_CONFIG[info.status] : null;
                return (
                  <div key={i} className={`flex min-h-[64px] flex-col rounded-lg border p-1.5 ${c ? c.badge : "border-slate-200 bg-white"}`}>
                    <span className="text-xs font-bold">{d}</span>
                    {info && <span className="mt-auto text-[10px] font-bold">{info.status}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="regu">
          <Card className="border-slate-200 p-4">
            <p className="mb-3 text-sm text-slate-500">Riwayat penempatan regu Anda (histori terjaga per periode).</p>
            <div className="space-y-2">
              {assigns.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">{a.team_name}</p>
                    <p className="text-xs text-slate-500">{a.start_date} → {a.end_date || "sekarang"}</p>
                  </div>
                  {!a.end_date && <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>}
                </div>
              ))}
              {assigns.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Belum ada penempatan regu.</p>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tanggal {detail && STATUS_CONFIG[detail].label} — {recap?.period_label}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {(recap?.dates?.[detail] || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="font-mono text-sm">{d.date}</span>
                <span className="text-xs text-slate-500">{d.regu}</span>
                <StatusBadge status={detail} />
              </div>
            ))}
            {(recap?.dates?.[detail] || []).length === 0 && <p className="py-6 text-center text-sm text-slate-400">Tidak ada tanggal.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
