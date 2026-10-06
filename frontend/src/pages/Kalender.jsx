import { useEffect, useState } from "react";
import api from "@/lib/api";
import { STATUSES, STATUS_CONFIG, monthLabel } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const curMonth = new Date().toISOString().slice(0, 7);
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function Kalender() {
  const [month, setMonth] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [teams, setTeams] = useState([]);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState([]);
  const [activeDay, setActiveDay] = useState("");

  useEffect(() => {
    api.get("/teams").then((r) => setTeams(r.data));
  }, []);

  useEffect(() => {
    const params = { month };
    if (teamId !== "all") params.team_id = teamId;
    api.get("/calendar", { params }).then((r) => setData(r.data));
  }, [month, teamId]);

  const openDay = (dstr) => {
    setActiveDay(dstr);
    const params = { date: dstr };
    if (teamId !== "all") params.team_id = teamId;
    api.get("/attendance/day", { params }).then((r) => {
      setDetail(r.data);
      setOpen(true);
    });
  };

  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Kalender Absensi</h2>
          <p className="text-sm text-slate-500">Ringkasan harian — klik tanggal untuk detail.</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" data-testid="calendar-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-40 bg-white" />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-10 w-40 bg-white" data-testid="calendar-team"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Regu</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-200 p-4">
        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-400">
          {DOW.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
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
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {STATUSES.filter((s) => counts[s] > 0).map((s) => (
                      <span key={s} className={`rounded px-1 text-[9px] font-bold leading-tight ${STATUS_CONFIG[s].badge}`}>
                        {counts[s]}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Absensi — {activeDay}</DialogTitle>
          </DialogHeader>
          {detail.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Belum ada data absensi.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="py-2">Nama</th><th className="py-2">Regu</th><th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-700">{r.nama}</td>
                    <td className="py-2 text-slate-500">{r.regu}</td>
                    <td className="py-2 text-right"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
