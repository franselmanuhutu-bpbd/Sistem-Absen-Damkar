import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";

const today = new Date().toISOString().slice(0, 10);

export default function ManajemenRegu() {
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState("");
  const [members, setMembers] = useState([]);
  const [allEmp, setAllEmp] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    api.get("/teams").then((r) => { setTeams(r.data); if (r.data[0]) setActiveTeam(r.data[0].id); });
    api.get("/employees", { params: { status: "ACTIVE" } }).then((r) => setAllEmp(r.data));
  }, []);

  const loadMembers = (tid) => {
    setLoading(true);
    api.get(`/teams/${tid}/members`, { params: { date: today } }).then((r) => setMembers(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { if (activeTeam) loadMembers(activeTeam); }, [activeTeam]);

  const submitRoll = async () => {
    try {
      await api.post("/assignments", { employee_id: roll.employee_id, team_id: roll.team_id, start_date: roll.start_date, end_date: null });
      toast.success("Penempatan regu berhasil disimpan");
      setRoll(null);
      loadMembers(activeTeam);
      api.get("/employees", { params: { status: "ACTIVE" } }).then((r) => setAllEmp(r.data));
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Manajemen Regu &amp; Rolling</h2>
          <p className="text-sm text-slate-500">Atur komposisi &amp; rolling pegawai antarregu (berbasis periode).</p>
        </div>
        <Button onClick={() => setRoll({ employee_id: "", team_id: activeTeam, start_date: today })} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="roll-btn">
          <ArrowRightLeft className="h-4 w-4" /> Tambah / Pindah Regu
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <Button key={t.id} variant={activeTeam === t.id ? "default" : "outline"} onClick={() => setActiveTeam(t.id)} data-testid={`team-tab-${t.code}`} className={`gap-2 ${activeTeam === t.id ? "bg-slate-900" : ""}`}>
            <Flame className="h-4 w-4" /> {t.name}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="font-heading font-bold text-slate-800">{teams.find((t) => t.id === activeTeam)?.name}</p>
          <Badge variant="outline">{members.length} anggota aktif</Badge>
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : members.length === 0 ? (
          <p className="py-16 text-center text-slate-400">Belum ada anggota di regu ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">No</th><th className="px-3 py-3">Nama</th>
                  <th className="hidden px-3 py-3 md:table-cell">NIP</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Jabatan</th>
                  <th className="px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {members.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`member-row-${e.id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{e.no}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{e.nama}</td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{e.jabatan}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRoll({ employee_id: e.id, team_id: "", start_date: today })} data-testid={`move-btn-${e.id}`}>
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Pindahkan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!roll} onOpenChange={(o) => !o && setRoll(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Penempatan / Rolling Regu</DialogTitle></DialogHeader>
          {roll && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pegawai</Label>
                <Select value={roll.employee_id} onValueChange={(v) => setRoll({ ...roll, employee_id: v })}>
                  <SelectTrigger data-testid="roll-employee"><SelectValue placeholder="Pilih pegawai" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {allEmp.map((e) => <SelectItem key={e.id} value={e.id}>{e.nama} {e.current_team_name ? `(${e.current_team_name})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pindah ke Regu</Label>
                <Select value={roll.team_id} onValueChange={(v) => setRoll({ ...roll, team_id: v })}>
                  <SelectTrigger data-testid="roll-team"><SelectValue placeholder="Pilih regu tujuan" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Mulai Penempatan</Label>
                <Input type="date" value={roll.start_date} onChange={(e) => setRoll({ ...roll, start_date: e.target.value })} data-testid="roll-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                Penempatan lama otomatis ditutup sehari sebelum tanggal mulai. Histori absensi sebelumnya tidak berubah.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoll(null)}>Batal</Button>
            <Button onClick={submitRoll} disabled={!roll?.employee_id || !roll?.team_id} className="bg-red-600 hover:bg-red-700" data-testid="roll-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
