import { useEffect, useState, useRef } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Power, History, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DataPegawai() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [hist, setHist] = useState(null);
  const [histData, setHistData] = useState([]);
  const fileRef = useRef();
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/employees", { params: { search, status: statusFilter } }).then((r) => setEmployees(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, statusFilter]);

  const save = async () => {
    try {
      if (form.id) await api.put(`/employees/${form.id}`, form);
      else await api.post("/employees", form);
      toast.success("Data pegawai tersimpan");
      setForm(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggleStatus = async (e) => {
    try {
      const { data } = await api.post(`/employees/${e.id}/status`);
      toast.success(`Pegawai ${data.status === "ACTIVE" ? "diaktifkan" : "dinonaktifkan"}`);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const openHist = (e) => {
    setHist(e);
    api.get(`/employees/${e.id}/assignments`).then((r) => setHistData(r.data));
  };

  const doImport = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/employees/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.inserted} pegawai diimport`);
      load();
    } catch (e) { toast.error(apiError(e)); }
    setImporting(false);
    ev.target.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Data Pegawai</h2>
          <p className="text-sm text-slate-500">{employees.length} pegawai terdaftar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === "admin" && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={doImport} data-testid="import-file" />
              <Button variant="outline" onClick={() => fileRef.current.click()} disabled={importing} className="gap-2" data-testid="import-btn">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import Excel
              </Button>
            </>
          )}
          <Button onClick={() => setForm({ nama: "", nip: "", pangkat: "", jabatan: "" })} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="add-employee-btn">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Cari nama atau NIP..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9 bg-white" data-testid="search-employee" />
          </div>
          <div className="flex gap-1">
            {[["", "Semua"], ["ACTIVE", "Aktif"], ["INACTIVE", "Nonaktif"]].map(([v, l]) => (
              <Button key={v} variant={statusFilter === v ? "default" : "outline"} onClick={() => setStatusFilter(v)} className={statusFilter === v ? "bg-slate-900" : ""} size="sm">{l}</Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-slate-200">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">No</th><th className="px-3 py-3">Nama</th>
                  <th className="hidden px-3 py-3 md:table-cell">NIP</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Pangkat</th>
                  <th className="px-3 py-3">Regu Aktif</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`employee-row-${e.id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{e.no}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-800">{e.nama}</p>
                      <p className="text-xs text-slate-400 md:hidden">{e.nip}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{e.pangkat}</td>
                    <td className="px-3 py-2.5">
                      {e.current_team_name ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{e.current_team_name}</Badge> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={e.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-600 hover:bg-slate-200"}>{e.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openHist(e)} data-testid={`hist-btn-${e.id}`} title="Riwayat regu"><History className="h-4 w-4 text-slate-500" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setForm(e)} data-testid={`edit-btn-${e.id}`}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleStatus(e)} data-testid={`toggle-btn-${e.id}`}><Power className={`h-4 w-4 ${e.status === "ACTIVE" ? "text-rose-500" : "text-emerald-500"}`} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form dialog */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit Pegawai" : "Tambah Pegawai"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nama</Label><Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} data-testid="form-nama" /></div>
              <div className="space-y-1.5"><Label>NIP</Label><Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} data-testid="form-nip" /></div>
              <div className="space-y-1.5"><Label>Pangkat / Golongan</Label><Input value={form.pangkat} onChange={(e) => setForm({ ...form, pangkat: e.target.value })} data-testid="form-pangkat" /></div>
              <div className="space-y-1.5"><Label>Jabatan</Label><Input value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} data-testid="form-jabatan" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
            <Button onClick={save} className="bg-red-600 hover:bg-red-700" data-testid="save-employee-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Riwayat Penempatan — {hist?.nama}</DialogTitle></DialogHeader>
          {histData.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Belum ada penempatan regu.</p> : (
            <div className="space-y-2">
              {histData.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">{a.team_name}</p>
                    <p className="text-xs text-slate-500">{a.start_date} → {a.end_date || "sekarang"}</p>
                  </div>
                  {!a.end_date && <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
