import { useEffect, useState } from "react";
import api from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { History, Search } from "lucide-react";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/audit", { params: { limit: 300 } }).then((r) => setLogs(r.data)); }, []);

  const filtered = logs.filter((l) =>
    !q || [l.user_name, l.user_email, l.action, l.employee_name].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Audit Log Aktivitas</h2>
        <p className="text-sm text-slate-500">Riwayat seluruh perubahan data &amp; absensi.</p>
      </div>

      <Card className="border-slate-200 p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Cari aktivitas / user / pegawai..." value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9 bg-white" data-testid="audit-search" />
        </div>
      </Card>

      <Card className="border-slate-200 p-0">
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && <p className="py-16 text-center text-slate-400">Tidak ada aktivitas.</p>}
          {filtered.map((l) => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-3" data-testid={`audit-row-${l.id}`}>
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-800">{l.user_name || l.user_email}</span>
                  <span className="text-sm text-slate-500">{l.action}</span>
                  {l.employee_name && <span className="text-sm font-medium text-slate-700">— {l.employee_name}</span>}
                  {l.old_status != null || l.new_status ? (
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={l.old_status} />
                      <span className="text-slate-400">→</span>
                      <StatusBadge status={l.new_status} />
                    </span>
                  ) : null}
                  {l.detail && <span className="text-xs text-slate-400">({l.detail})</span>}
                </div>
                {l.date && <p className="text-xs text-slate-400 mt-0.5">Tanggal absensi: {l.date}</p>}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{fmt(l.timestamp)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
