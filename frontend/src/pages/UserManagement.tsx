import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABEL } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => api.get("/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); api.get("/employees", { params: { status: "ACTIVE" } }).then((r) => setEmployees(r.data)); }, []);

  const save = async () => {
    try {
      if (form.id) await api.put(`/users/${form.id}`, form);
      else await api.post("/users", form);
      toast.success("User tersimpan");
      setForm(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const deactivate = async (u) => {
    try { await api.delete(`/users/${u.id}`); toast.success("User dinonaktifkan"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const roleBadge = { admin: "bg-red-100 text-red-700", operator: "bg-blue-100 text-blue-700", viewer: "bg-slate-200 text-slate-600" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Manajemen User &amp; Role</h2>
          <p className="text-sm text-slate-500">{users.length} user terdaftar</p>
        </div>
        <Button onClick={() => setForm({ name: "", email: "", password: "", role: "operator", status: "ACTIVE", employee_id: "" })} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="add-user-btn">
          <UserPlus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`user-row-${u.id}`}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3"><Badge className={`${roleBadge[u.role]} hover:${roleBadge[u.role]}`}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="px-4 py-3"><Badge className={u.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}>{u.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setForm({ ...u, password: "", employee_id: u.employee_id || "" })} data-testid={`edit-user-${u.id}`}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                      {Boolean(user && u.id !== user.id) && <Button size="icon" variant="ghost" onClick={() => deactivate(u)} data-testid={`deactivate-user-${u.id}`}><Power className="h-4 w-4 text-rose-500" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email" /></div>
              <div className="space-y-1.5"><Label>Password {form.id && <span className="text-xs text-slate-400">(kosongkan jika tidak diubah)</span>}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger data-testid="user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="viewer">Viewer / Kepala</SelectItem>
                      <SelectItem value="komandan">Komandan Regu</SelectItem>
                      <SelectItem value="kasubid">Kasubid</SelectItem>
                      <SelectItem value="staff">Pegawai / Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="user-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Aktif</SelectItem>
                      <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tautkan ke Pegawai <span className="text-xs text-slate-400">(wajib untuk role Staff/Kasubid/Komandan agar bisa lihat "Absensi Saya")</span></Label>
                <Select value={form.employee_id || "none"} onValueChange={(v) => setForm({ ...form, employee_id: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="user-employee"><SelectValue placeholder="Tidak ditautkan" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none">Tidak ditautkan</SelectItem>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.nama} — {e.nip}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
            <Button onClick={save} className="bg-red-600 hover:bg-red-700" data-testid="save-user-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
