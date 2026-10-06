import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, UserPlus, UserMinus, History } from "lucide-react";
import { toast } from "sonner";

const today = new Date().toISOString().slice(0, 10);

export default function PengaturanKasubid() {
  const [positions, setPositions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [setForm, setSetForm] = useState(null);
  const [vacForm, setVacForm] = useState(null);
  const [histPos, setHistPos] = useState(null);

  const load = () => api.get("/kasubid").then((r) => setPositions(r.data));
  useEffect(() => { load(); api.get("/employees", { params: { status: "ACTIVE" } }).then((r) => setEmployees(r.data)); }, []);

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

  const statusColor = (s) => s === "Aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Pengaturan Jabatan — Kasubid</h2>
        <p className="text-sm text-slate-500">Kelola pejabat Kasubid: tetapkan, ganti, atau kosongkan posisi. Riwayat absensi lama tetap aman.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {positions.map((p) => (
          <Card key={p.position_id} className="border-slate-200 p-5" data-testid={`pk-card-${p.position_id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Star className="h-6 w-6" /></div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{p.label}</p>
                  <p className="font-heading text-lg font-bold text-slate-900">{p.nama || "Belum Diisi / Kosong"}</p>
                  {p.jabatan && <p className="text-xs text-slate-400">{p.jabatan}</p>}
                </div>
              </div>
              <Badge className={`${statusColor(p.status)} hover:${statusColor(p.status)}`}>{p.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
        ))}
      </div>

      {/* Set/Replace dialog */}
      <Dialog open={!!setForm} onOpenChange={(o) => !o && setSetForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tetapkan {setForm?.label}</DialogTitle></DialogHeader>
          {setForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pejabat (dari data pegawai)</Label>
                <Select value={setForm.employee_id} onValueChange={(v) => setSetForm({ ...setForm, employee_id: v })}>
                  <SelectTrigger data-testid="pk-employee"><SelectValue placeholder="Pilih pegawai" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.nama} — {e.nip}</SelectItem>)}
                  </SelectContent>
                </Select>
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
          <DialogHeader><DialogTitle>Kosongkan {vacForm?.label}</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Riwayat Pejabat — {histPos?.label}</DialogTitle></DialogHeader>
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
