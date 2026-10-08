import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, UserPlus, UserMinus, History, Search, X } from "lucide-react";
import { toast } from "sonner";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { motion } from "framer-motion";

const today = new Date().toISOString().slice(0, 10);

export default function PengaturanKasubid() {
  const [positions, setPositions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [setForm, setSetForm] = useState<any>(null);
  const [vacForm, setVacForm] = useState<any>(null);
  const [histPos, setHistPos] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/kasubid");
      setPositions(r.data || []);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/employees", { params: { status: "ACTIVE" } })
      .then((r) => setEmployees(r.data || []))
      .catch(() => {});
  }, []);

  const submitSet = async () => {
    try {
      await api.post("/kasubid", { position_id: setForm.position_id, employee_id: setForm.employee_id, start_date: setForm.start_date });
      toast.success("Pejabat Kasubid ditetapkan");
      setSetForm(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const submitVacate = async () => {
    try {
      await api.post("/kasubid/vacate", { position_id: vacForm.position_id, employee_id: "", start_date: vacForm.start_date });
      toast.success("Posisi Kasubid dikosongkan");
      setVacForm(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const statusColor = (s: string) => s === "Aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600";

  const filteredPositions = positions.filter((p: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const matchName = p.nama ? p.nama.toLowerCase().includes(q) : false;
    const matchLabel = p.label ? p.label.toLowerCase().includes(q) : false;
    const matchJabatan = p.jabatan ? p.jabatan.toLowerCase().includes(q) : false;
    return matchName || matchLabel || matchJabatan;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Pengaturan Jabatan — Kasubid</h2>
          <p className="text-sm text-slate-500">Kelola pejabat Kasubid: tetapkan, ganti, atau kosongkan posisi. Riwayat absensi lama tetap aman.</p>
        </div>
        <div className="relative min-w-[220px] sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Cari nama atau jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 pr-8 bg-white"
            data-testid="search-kasubid-view"
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </Card>
          ))
        ) : filteredPositions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            {search ? `Tidak ada jabatan atau pejabat Kasubid yang sesuai dengan "${search}".` : "Belum ada jabatan Kasubid."}
          </div>
        ) : (
          filteredPositions.map((p: any) => (
            <motion.div
              key={p.position_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Card className="border-slate-200 p-5 h-full flex flex-col justify-between" data-testid={`pk-card-${p.position_id}`}>
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
                        <Star className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400">{p.label}</p>
                        <p className="font-heading text-lg font-bold text-slate-900">{p.nama || "Belum Diisi / Kosong"}</p>
                        {p.jabatan && <p className="text-xs text-slate-400">{p.jabatan}</p>}
                      </div>
                    </div>
                    <Badge className={`${statusColor(p.status)} hover:${statusColor(p.status)}`}>{p.status}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" onClick={() => setSetForm({ position_id: p.position_id, employee_id: "", start_date: today, label: p.label })} className="gap-1.5 bg-red-600 hover:bg-red-700" data-testid={`pk-set-${p.position_id}`}>
                    <UserPlus className="h-4 w-4" /> {p.status === "Aktif" ? "Ganti Pejabat" : "Tetapkan Pejabat"}
                  </Button>
                  {p.status === "Aktif" && (
                    <Button size="sm" variant="outline" onClick={() => setVacForm({ position_id: p.position_id, start_date: today, label: p.label })} className="gap-1.5" data-testid={`pk-vacate-${p.position_id}`}>
                      <UserMinus className="h-4 w-4" /> Kosongkan
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setHistPos(p)} className="gap-1.5" data-testid={`pk-hist-${p.position_id}`}>
                    <History className="h-4 w-4" /> Riwayat
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Set/Replace dialog */}
      <Dialog open={!!setForm} onOpenChange={(o) => !o && setSetForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tetapkan {setForm?.label}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih pegawai yang menjabat dan tentukan tanggal mulai berlaku.
            </DialogDescription>
          </DialogHeader>
          {setForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pejabat (dari data pegawai)</Label>
                <EmployeeSearchSelect
                  value={setForm.employee_id}
                  onChange={(v) => setSetForm({ ...setForm, employee_id: v })}
                  employees={employees}
                  placeholder="Cari & pilih pejabat (nama atau NIP)..."
                  data-testid="pk-employee"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku mulai (tanggal pelantikan)</Label>
                <Input type="date" value={setForm.start_date} onChange={(e) => setSetForm({ ...setForm, start_date: e.target.value })} data-testid="pk-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">Pejabat lama tetap tercatat pada absensi sebelum tanggal ini. Histori tidak berubah.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetForm(null)}>Batal</Button>
            <Button onClick={submitSet} disabled={!setForm?.employee_id} className="bg-red-600 hover:bg-red-700" data-testid="pk-set-save">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacate dialog */}
      <Dialog open={!!vacForm} onOpenChange={(o) => !o && setVacForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kosongkan {vacForm?.label}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Kosongkan posisi pejabat Kasubid ini mulai tanggal yang ditentukan.
            </DialogDescription>
          </DialogHeader>
          {vacForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Dikosongkan mulai tanggal</Label>
                <Input type="date" value={vacForm.start_date} onChange={(e) => setVacForm({ ...vacForm, start_date: e.target.value })} data-testid="pk-vacate-date" />
              </div>
              <p className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">Setelah dikosongkan, absensi Kasubid untuk posisi ini tidak dapat dilakukan hingga pejabat baru dilantik. Data lama tetap tersimpan.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVacForm(null)}>Batal</Button>
            <Button onClick={submitVacate} className="bg-rose-600 hover:bg-rose-700" data-testid="pk-vacate-save">Kosongkan Posisi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!histPos} onOpenChange={(o) => !o && setHistPos(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Pejabat — {histPos?.label}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Daftar pejabat yang pernah menjabat pada posisi ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(histPos?.history || []).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-semibold text-slate-800">{h.nama || "Kosong"}</p>
                  <p className="text-xs text-slate-500">{h.start_date} → {h.end_date || "sekarang"}</p>
                </div>
                {!h.end_date && <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>}
              </div>
            ))}
            {(histPos?.history || []).length === 0 && <p className="py-6 text-center text-sm text-slate-400">Belum ada riwayat.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
