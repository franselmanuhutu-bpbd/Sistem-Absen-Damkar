import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Flame, Star, Loader2, Pencil, Crown, History } from "lucide-react";
import { toast } from "sonner";

const today = new Date().toISOString().slice(0, 10);

export default function ManajemenRegu() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState("");
  const [detail, setDetail] = useState(null);
  const [allEmp, setAllEmp] = useState([]);
  const [kasubid, setKasubid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roll, setRoll] = useState(null);
  const [rename, setRename] = useState(null);
  const [cmd, setCmd] = useState(null);
  const [ksForm, setKsForm] = useState(null);
  const [hist, setHist] = useState(null);
  const [histData, setHistData] = useState([]);
  const isAdmin = user?.role === "admin";

  const loadTeams = () => api.get("/teams").then((r) => { setTeams(r.data); if (!activeTeam && r.data[0]) setActiveTeam(r.data[0].id); });
  const loadEmp = () => api.get("/employees", { params: { status: "ACTIVE" } }).then((r) => setAllEmp(r.data));
  const loadKasubid = () => api.get("/kasubid").then((r) => setKasubid(r.data));
  useEffect(() => { loadTeams(); loadEmp(); loadKasubid(); }, []);

  const loadDetail = (tid) => {
    setLoading(true);
    api.get(`/teams/${tid}/detail`, { params: { date: today } }).then((r) => setDetail(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { if (activeTeam) loadDetail(activeTeam); }, [activeTeam]);

  const submitRoll = async () => {
    try {
      await api.post("/assignments", { employee_id: roll.employee_id, team_id: roll.team_id, start_date: roll.start_date, end_date: null });
      toast.success("Penempatan regu berhasil disimpan");
      setRoll(null); loadDetail(activeTeam); loadEmp();
    } catch (e) { toast.error(apiError(e)); }
  };
  const submitRename = async () => {
    try {
      await api.put(`/teams/${rename.id}/rename`, { name: rename.name });
      toast.success("Nama regu diperbarui");
      setRename(null); loadTeams(); loadDetail(activeTeam);
    } catch (e) { toast.error(apiError(e)); }
  };
  const submitCmd = async () => {
    try {
      await api.post("/commanders", { team_id: activeTeam, employee_id: cmd.employee_id, start_date: cmd.start_date });
      toast.success("Komandan Regu ditetapkan");
      setCmd(null); loadDetail(activeTeam);
    } catch (e) { toast.error(apiError(e)); }
  };
  const submitKasubid = async () => {
    try {
      await api.post("/kasubid", { position_id: ksForm.position_id, employee_id: ksForm.employee_id, start_date: ksForm.start_date });
      toast.success("Kasubid ditetapkan");
      setKsForm(null); loadKasubid();
    } catch (e) { toast.error(apiError(e)); }
  };
  const openHist = () => {
    setHist(true);
    api.get(`/teams/${activeTeam}/history`).then((r) => setHistData(r.data));
  };

  const curTeam = teams.find((t) => t.id === activeTeam);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Struktur Organisasi &amp; Rolling</h2>
        <p className="text-sm text-slate-500">Kelola Kasubid, 6 regu, Komandan Regu, dan rolling pegawai berbasis periode.</p>
      </div>

      {/* Kasubid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kasubid.map((k) => (
          <Card key={k.position_id} className="flex items-center justify-between border-slate-200 p-4" data-testid={`ks-card-${k.position_id}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Star className="h-6 w-6" /></div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">{k.label}</p>
                <p className="font-heading text-lg font-bold text-slate-900">{k.nama || "— belum ditetapkan"}</p>
              </div>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setKsForm({ position_id: k.position_id, employee_id: "", start_date: today, label: k.label })} data-testid={`ks-set-${k.position_id}`}>
                Ganti
              </Button>
            )}
          </Card>
        ))}
      </div>

      {/* Team tabs */}
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <Button key={t.id} variant={activeTeam === t.id ? "default" : "outline"} onClick={() => setActiveTeam(t.id)} data-testid={`team-tab-${t.code}`} className={`gap-2 ${activeTeam === t.id ? "bg-slate-900" : ""}`}>
            <Flame className="h-4 w-4" /> {t.name}
          </Button>
        ))}
      </div>

      {/* Team detail */}
      <Card className="overflow-hidden border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="font-heading text-lg font-bold text-slate-800">{curTeam?.name}</p>
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => setRename({ id: curTeam.id, name: curTeam.name })} data-testid="rename-team-btn">
                <Pencil className="h-4 w-4 text-slate-500" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Crown className="h-3.5 w-3.5" /> Komandan: {detail?.commander?.nama || "—"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setCmd({ employee_id: "", start_date: today })} data-testid="set-commander-btn">
              <Crown className="mr-1.5 h-4 w-4" /> Komandan
            </Button>
            <Button size="sm" variant="outline" onClick={openHist} data-testid="team-history-btn">
              <History className="mr-1.5 h-4 w-4" /> Riwayat
            </Button>
            <Button size="sm" onClick={() => setRoll({ employee_id: "", team_id: activeTeam, start_date: today })} className="bg-red-600 hover:bg-red-700" data-testid="roll-btn">
              <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Rolling
            </Button>
          </div>
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (detail?.members?.length || 0) === 0 ? (
          <p className="py-16 text-center text-slate-400">Belum ada anggota di regu ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">No</th><th className="px-3 py-3">Nama</th>
                  <th className="hidden px-3 py-3 md:table-cell">NIP</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Jabatan</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {detail.members.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`member-row-${e.id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{e.no}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{e.nama} {e.is_commander && <span title="Komandan Regu">⭐</span>}</td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{e.jabatan}</td>
                    <td className="px-3 py-2.5">{e.is_commander ? <Badge className="bg-amber-100 text-amber-700">⭐ Komandan</Badge> : <Badge variant="outline">Anggota</Badge>}</td>
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

      {/* Rolling dialog */}
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
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Mulai Penempatan</Label>
                <Input type="date" value={roll.start_date} onChange={(e) => setRoll({ ...roll, start_date: e.target.value })} data-testid="roll-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                ⚠️ Perubahan ini hanya berlaku mulai {roll.start_date}. Histori penempatan & absensi sebelum tanggal tersebut TIDAK akan berubah.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoll(null)} data-testid="roll-cancel">Batal</Button>
            <Button onClick={submitRoll} disabled={!roll?.employee_id || !roll?.team_id} className="bg-red-600 hover:bg-red-700" data-testid="roll-save-btn">Simpan Rolling</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ubah Nama Regu</DialogTitle></DialogHeader>
          {rename && <Input value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} data-testid="rename-input" />}
          <p className="text-xs text-slate-500">ID regu tetap permanen, histori absensi tidak terpengaruh.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRename(null)}>Batal</Button>
            <Button onClick={submitRename} className="bg-red-600 hover:bg-red-700" data-testid="rename-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commander dialog */}
      <Dialog open={!!cmd} onOpenChange={(o) => !o && setCmd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tetapkan Komandan {curTeam?.name}</DialogTitle></DialogHeader>
          {cmd && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Komandan (anggota regu)</Label>
                <Select value={cmd.employee_id} onValueChange={(v) => setCmd({ ...cmd, employee_id: v })}>
                  <SelectTrigger data-testid="cmd-employee"><SelectValue placeholder="Pilih pegawai" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {(detail?.members || []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku mulai</Label>
                <Input type="date" value={cmd.start_date} onChange={(e) => setCmd({ ...cmd, start_date: e.target.value })} data-testid="cmd-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">Komandan lama tetap tercatat pada laporan periode sebelum tanggal ini.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCmd(null)}>Batal</Button>
            <Button onClick={submitCmd} disabled={!cmd?.employee_id} className="bg-red-600 hover:bg-red-700" data-testid="cmd-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kasubid dialog */}
      <Dialog open={!!ksForm} onOpenChange={(o) => !o && setKsForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tetapkan {ksForm?.label}</DialogTitle></DialogHeader>
          {ksForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pejabat</Label>
                <Select value={ksForm.employee_id} onValueChange={(v) => setKsForm({ ...ksForm, employee_id: v })}>
                  <SelectTrigger data-testid="ks-employee"><SelectValue placeholder="Pilih pegawai" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {allEmp.map((e) => <SelectItem key={e.id} value={e.id}>{e.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku mulai</Label>
                <Input type="date" value={ksForm.start_date} onChange={(e) => setKsForm({ ...ksForm, start_date: e.target.value })} data-testid="ks-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">Pejabat lama tetap muncul pada laporan sebelum masa jabatan baru.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKsForm(null)}>Batal</Button>
            <Button onClick={submitKasubid} disabled={!ksForm?.employee_id} className="bg-red-600 hover:bg-red-700" data-testid="ks-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team history dialog */}
      <Dialog open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Riwayat Perubahan Anggota — {curTeam?.name}</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Tanggal</th><th className="py-2">Pegawai</th><th className="py-2">Aksi</th></tr></thead>
            <tbody>
              {histData.map((h, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs">{h.date}</td>
                  <td className="py-2 text-slate-700">{h.nama}</td>
                  <td className="py-2">
                    <Badge className={h.aksi === "Masuk" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{h.aksi}</Badge>
                  </td>
                </tr>
              ))}
              {histData.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-400">Belum ada riwayat.</td></tr>}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
