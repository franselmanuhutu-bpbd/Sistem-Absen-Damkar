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
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/users");
      setUsers(r.data || []);
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
          {loading ? (
            <Skeleton className="h-4 w-28 mt-1" />
          ) : (
            <p className="text-sm text-slate-500">{users.length} user terdaftar</p>
          )}
        </div>
        <Button onClick={() => setForm({ name: "", email: "", password: "", role: "operator", status: "ACTIVE", employee_id: "" })} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="add-user-btn">
          <UserPlus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Belum ada user terdaftar.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`user-row-${u.id}`}>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

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
