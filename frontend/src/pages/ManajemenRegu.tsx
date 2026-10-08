import { useEffect, useState, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightLeft, Flame, Star, Loader2, Pencil, Crown, History, RotateCcw, Search, X, Calendar, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { cn } from "@/lib/utils";
import { formatDateId } from "@/lib/constants";

const today = new Date().toISOString().slice(0, 10);

// Helper untuk menambahkan N bulan ke tanggal YYYY-MM-DD (siklus 3 bulan/triwulan, 6 bulan, dll.)
function addMonthsToDate(dateStr: string, months: number): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1 + months, d);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ManajemenRegu() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(today);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTeam, setActiveTeam] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [allEmp, setAllEmp] = useState<any[]>([]);
  const [kasubid, setKasubid] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // State untuk penataan / rolling regu (Batch Multi-select)
  const [roll, setRoll] = useState<{
    employee_ids: string[];
    team_id: string;
    // Mode tanggal: tunggal (1 hari), rentang (triwulan dll), atau seterusnya
    mode: "tunggal" | "rentang" | "seterusnya";
    start_date: string;
    end_date: string;
  } | null>(null);

  const [rollSearch, setRollSearch] = useState("");
  const [rollFilterTab, setRollFilterTab] = useState<"all" | "unassigned" | "other">("unassigned");
  const [submittingRoll, setSubmittingRoll] = useState(false);
  const [submittingRename, setSubmittingRename] = useState(false);
  const [submittingCmd, setSubmittingCmd] = useState(false);
  const [submittingKasubid, setSubmittingKasubid] = useState(false);
  const [rename, setRename] = useState<any>(null);
  const [cmd, setCmd] = useState<any>(null);
  const [ksForm, setKsForm] = useState<any>(null);
  const [hist, setHist] = useState<any>(null);
  const [histData, setHistData] = useState<any[]>([]);

  // State konfigurasi dialog reset penempatan regu
  const [resetConfig, setResetConfig] = useState<{
    open: boolean;
    mode: "single" | "range" | "all"; // Lingkup tanggal reset: 1 hari terpilih, rentang tanggal, atau semua periode
    date: string; // Tanggal tunggal
    start_date: string; // Rentang mulai
    end_date: string; // Rentang selesai
    team_id: string; // Regu spesifik atau "" untuk semua regu
    submitting: boolean;
  }>({
    open: false,
    mode: "single",
    date: today,
    start_date: today,
    end_date: today,
    team_id: "",
    submitting: false,
  });

  const isAdmin = Boolean(user && user.role === "admin");

  const loadTeams = () => api.get("/teams").then((r) => { setTeams(r.data); if (!activeTeam && r.data[0]) setActiveTeam(r.data[0].id); }).catch((e) => toast.error(apiError(e)));
  const loadEmp = (d = selectedDate) => api.get("/employees", { params: { status: "ACTIVE", date: d } }).then((r) => setAllEmp(r.data)).catch((e) => toast.error(apiError(e)));
  const loadKasubid = (d = selectedDate) => api.get("/kasubid", { params: { date: d } }).then((r) => setKasubid(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { loadEmp(selectedDate); loadKasubid(selectedDate); }, [selectedDate]);

  const loadDetail = (tid = activeTeam, d = selectedDate) => {
    if (!tid) return;
    setLoading(true);
    api.get(`/teams/${tid}/detail`, { params: { date: d } }).then((r) => setDetail(r.data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  };
  useEffect(() => { if (activeTeam) loadDetail(activeTeam, selectedDate); }, [activeTeam, selectedDate]);

  // Simpan penempatan anggota massal dengan fleksibilitas mode tanggal (Single date, Range date, Seterusnya)
  const submitRoll = async () => {
    if (!roll?.employee_ids?.length || !roll?.team_id) {
      toast.error("Pilih setidaknya satu pegawai dan tentukan regu tujuan.");
      return;
    }
    if (roll.mode === "rentang" && roll.end_date && roll.end_date < roll.start_date) {
      toast.error("Tanggal akhir tidak boleh lebih awal dari tanggal mulai.");
      return;
    }
    setSubmittingRoll(true);
    try {
      // Tentukan tanggal akhir sesuai mode yang dipilih
      const finalEndDate = roll.mode === "tunggal"
        ? roll.start_date
        : (roll.mode === "rentang" ? (roll.end_date || null) : null);

      const res = await api.post("/assignments/batch", {
        employee_ids: roll.employee_ids,
        team_id: roll.team_id,
        start_date: roll.start_date,
        end_date: finalEndDate,
      });
      const count = res.data?.count ?? roll.employee_ids.length;
      const modeLabel = roll.mode === "tunggal"
        ? `Tanggal Tunggal (${formatDateId(roll.start_date)})`
        : (roll.mode === "rentang" ? `Rentang ${formatDateId(roll.start_date)} s/d ${formatDateId(finalEndDate!)}` : "Seterusnya");

      toast.success(`${count} penempatan regu berhasil disimpan [${modeLabel}]`);
      setRoll(null);
      loadDetail(activeTeam, selectedDate);
      loadEmp(selectedDate);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmittingRoll(false);
    }
  };

  const selectedRollEmployees = useMemo(() => {
    if (!roll?.employee_ids?.length) return [];
    const selectedSet = new Set(roll.employee_ids);
    return allEmp.filter((e) => selectedSet.has(e.id));
  }, [allEmp, roll?.employee_ids]);

  const filteredRollEmployees = useMemo(() => {
    if (!roll) return [];
    const q = rollSearch.trim().toLowerCase();
    return allEmp.filter((emp: any) => {
      if (rollFilterTab === "unassigned" && emp.current_team_id) return false;
      if (rollFilterTab === "other" && (!emp.current_team_id || emp.current_team_id === roll.team_id)) return false;

      if (!q) return true;
      const matchName = emp.nama ? emp.nama.toLowerCase().includes(q) : false;
      const matchNip = emp.nip ? String(emp.nip).toLowerCase().includes(q) : false;
      const matchTeam = emp.current_team_name ? emp.current_team_name.toLowerCase().includes(q) : false;
      const matchJabatan = emp.jabatan ? emp.jabatan.toLowerCase().includes(q) : false;
      return matchName || matchNip || matchTeam || matchJabatan;
    });
  }, [allEmp, roll, rollSearch, rollFilterTab]);

  const unassignedEmpCount = useMemo(() => allEmp.filter((e) => !e.current_team_id).length, [allEmp]);
  const otherTeamsEmpCount = useMemo(() => {
    if (!roll?.team_id) return 0;
    return allEmp.filter((e) => e.current_team_id && e.current_team_id !== roll.team_id).length;
  }, [allEmp, roll?.team_id]);

  const toggleRollEmployee = (id: string) => {
    if (!roll) return;
    const current = roll.employee_ids || [];
    const exists = current.includes(id);
    const next = exists ? current.filter((x: string) => x !== id) : [...current, id];
    setRoll({ ...roll, employee_ids: next });
  };

  const selectAllFiltered = () => {
    if (!roll) return;
    const current = new Set(roll.employee_ids || []);
    filteredRollEmployees.forEach((emp: any) => current.add(emp.id));
    setRoll({ ...roll, employee_ids: Array.from(current) });
  };

  const deselectAllFiltered = () => {
    if (!roll) return;
    const toRemove = new Set(filteredRollEmployees.map((e: any) => e.id));
    const next = (roll.employee_ids || []).filter((id: string) => !toRemove.has(id));
    setRoll({ ...roll, employee_ids: next });
  };

  const clearAllRollSelection = () => {
    if (!roll) return;
    setRoll({ ...roll, employee_ids: [] });
  };

  // Buka dialog penataan / rolling regu (Batch Multi-select)
  const openRollDialog = (employeeIds: string[] = [], teamId: string = activeTeam) => {
    setRollSearch("");
    setRollFilterTab("unassigned");
    setRoll({
      employee_ids: employeeIds,
      team_id: teamId,
      mode: "tunggal", // Default ke rentang tanggal (kebutuhan reguler triwulan)
      start_date: selectedDate,
      end_date: addMonthsToDate(selectedDate, 3), // Default 3 bulan ke depan
    });
  };
  const submitRename = async () => {
    if (!rename?.name?.trim()) return;
    setSubmittingRename(true);
    try {
      await api.put(`/teams/${rename.id}/rename`, { name: rename.name.trim() });
      toast.success("Nama regu diperbarui");
      setRename(null);
      loadTeams();
      loadDetail(activeTeam, selectedDate);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmittingRename(false);
    }
  };

  const submitCmd = async () => {
    if (!cmd?.employee_id) return;
    setSubmittingCmd(true);
    try {
      await api.post("/commanders", { team_id: activeTeam, employee_id: cmd.employee_id, start_date: cmd.start_date });
      toast.success("Komandan Regu ditetapkan");
      setCmd(null);
      loadDetail(activeTeam, selectedDate);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmittingCmd(false);
    }
  };

  const submitKasubid = async () => {
    if (!ksForm?.employee_id) return;
    setSubmittingKasubid(true);
    try {
      await api.post("/kasubid", { position_id: ksForm.position_id, employee_id: ksForm.employee_id, start_date: ksForm.start_date });
      toast.success("Kasubid ditetapkan");
      setKsForm(null);
      loadKasubid(selectedDate);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmittingKasubid(false);
    }
  };

  // Pegawai yang sudah terpilih di Kasubid 1 tidak boleh muncul di pilihan Kasubid 2 (dan sebaliknya)
  const availableKasubidEmployees = useMemo(() => {
    if (!ksForm) return allEmp;
    const otherKasubidEmployeeIds = new Set(
      kasubid
        .filter((k: any) => k.position_id !== ksForm.position_id && k.employee_id)
        .map((k: any) => k.employee_id)
    );
    return allEmp.filter((e: any) => !otherKasubidEmployeeIds.has(e.id));
  }, [allEmp, kasubid, ksForm]);
  const openHist = () => {
    setHist(true);
    api.get(`/teams/${activeTeam}/history`).then((r) => setHistData(r.data)).catch((e) => toast.error(apiError(e)));
  };

  // Buka dialog reset dengan prefill tanggal acuan terpilih dan regu yang sedang dibuka/dilihat user
  const openResetDialog = () => {
    setResetConfig({
      open: true,
      mode: "single", // Default mengosongkan tanggal yang sedang aktif dilihat
      date: selectedDate,
      start_date: selectedDate,
      end_date: addMonthsToDate(selectedDate, 3),
      team_id: activeTeam || "", // Prefill otomatis ke regu yang sedang aktif dipilih di UI
      submitting: false,
    });
  };

  // Eksekusi reset penempatan regu dengan dukungan tanggal tunggal, rentang tanggal, atau reset total
  const submitReset = async () => {
    setResetConfig((prev) => ({ ...prev, submitting: true }));
    try {
      // Siapkan payload dengan parameter mode dan regu target
      const payload: any = {
        mode: resetConfig.mode,
        team_id: resetConfig.team_id || null, // null berarti semua regu
        reset_attendance_teams: true, // Kosongkan juga status regu di data absensi terkait
      };

      if (resetConfig.mode === "single") {
        payload.date = resetConfig.date;
      } else if (resetConfig.mode === "range") {
        if (resetConfig.end_date < resetConfig.start_date) {
          toast.error("Tanggal akhir tidak boleh lebih awal dari tanggal mulai.");
          setResetConfig((prev) => ({ ...prev, submitting: false }));
          return;
        }
        payload.start_date = resetConfig.start_date;
        payload.end_date = resetConfig.end_date;
      }

      // Kirim permintaan reset ke backend API
      const { data } = await api.post("/assignments/reset", payload);
      toast.success(`Reset penempatan regu berhasil (${data.scope || "selesai"}).`);
      setResetConfig((prev) => ({ ...prev, open: false, submitting: false }));

      // Sinkronkan kembali tampilan dan data anggota
      const targetDate = resetConfig.mode === "single"
        ? resetConfig.date
        : (resetConfig.mode === "range" ? resetConfig.start_date : selectedDate);

      if (targetDate && targetDate !== selectedDate) {
        setSelectedDate(targetDate);
      } else {
        loadDetail(activeTeam, selectedDate);
        loadEmp(selectedDate);
      }
    } catch (e) {
      toast.error(apiError(e));
      setResetConfig((prev) => ({ ...prev, submitting: false }));
    }
  };

  const curTeam = teams.find((t) => t.id === activeTeam);

  const filteredMembers = (detail?.members || []).filter((e: any) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    const matchName = e.nama ? e.nama.toLowerCase().includes(q) : false;
    const matchNip = e.nip ? String(e.nip).toLowerCase().includes(q) : false;
    return matchName || matchNip;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-around">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Struktur Organisasi &amp; Rolling</h2>
          <p className="text-sm text-slate-500">Kelola Kasubid, 6 regu, Komandan Regu, dan rolling pegawai berbasis periode.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Tanggal Acuan</span>
            <Input
              type="date"
              data-testid="manajemen-regu-date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-40 bg-white cursor-pointer text-xs"
            />
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={openResetDialog}
              data-testid="reset-assignments-btn"
              className="h-9 w-52 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Penempatan Regu
            </Button>
          )}
        </div>
      </div>

      {selectedDate !== today && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-sky-950 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-sky-600" />
            <span>
              Menampilkan struktur regu &amp; penempatan pada tanggal <b>{formatDateId(selectedDate)}</b>. Rolling / penempatan baru akan otomatis berlaku mulai tanggal ini.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-sky-300 bg-white hover:bg-sky-100 text-sky-900 self-start sm:self-auto shrink-0"
            onClick={() => setSelectedDate(today)}
          >
            Kembali ke Hari Ini
          </Button>
        </div>
      )}

      {/* Dialog Reset Fleksibel (Single Date, Range Date, atau All) */}
      <Dialog open={resetConfig.open} onOpenChange={(o) => setResetConfig((prev) => ({ ...prev, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <RotateCcw className="h-5 w-5" />
              Reset Penempatan Regu
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih lingkup tanggal untuk mengosongkan penempatan regu operasional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Pilihan Lingkup Tanggal Reset */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Pilih Lingkup Tanggal yang Dikosongkan:</Label>
              <div className="space-y-2">
                {/* 1. Tanggal Terpilih Saja */}
                <div
                  onClick={() => setResetConfig((prev) => ({ ...prev, mode: "single" }))}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer transition-colors space-y-1",
                    resetConfig.mode === "single"
                      ? "border-sky-500 bg-sky-50/70"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={resetConfig.mode === "single"}
                        onChange={() => { }}
                        className="text-sky-600"
                      />
                      Tanggal Terpilih Saja ({formatDateId(resetConfig.date)})
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Paling Aman
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-4">
                    Hanya mengosongkan penempatan regu pada tanggal {formatDateId(resetConfig.date)}. Penempatan sebelum dan sesudah tanggal ini tetap utuh.
                  </p>
                  {resetConfig.mode === "single" && (
                    <div className="pt-2 pl-4">
                      <Label className="text-[11px] text-slate-600">Ubah Tanggal Target:</Label>
                      <Input
                        type="date"
                        value={resetConfig.date}
                        onChange={(e) => setResetConfig((prev) => ({ ...prev, date: e.target.value }))}
                        className="h-8 text-xs bg-white mt-1 w-44"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Rentang Tanggal Tertentu */}
                <div
                  onClick={() => setResetConfig((prev) => ({ ...prev, mode: "range" }))}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer transition-colors space-y-1",
                    resetConfig.mode === "range"
                      ? "border-sky-500 bg-sky-50/70"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={resetConfig.mode === "range"}
                        onChange={() => { }}
                        className="text-sky-600"
                      />
                      Rentang Tanggal (Kuartal / Periode Tertentu)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-4">
                    Mengosongkan penempatan regu yang berada di antara tanggal mulai dan tanggal akhir.
                  </p>
                  {resetConfig.mode === "range" && (
                    <div className="grid grid-cols-2 gap-2 pt-2 pl-4">
                      <div>
                        <Label className="text-[11px] text-slate-600">Mulai:</Label>
                        <Input
                          type="date"
                          value={resetConfig.start_date}
                          onChange={(e) => setResetConfig((prev) => ({ ...prev, start_date: e.target.value }))}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-600">Sampai:</Label>
                        <Input
                          type="date"
                          value={resetConfig.end_date}
                          onChange={(e) => setResetConfig((prev) => ({ ...prev, end_date: e.target.value }))}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Reset Total (Semua Periode) */}
                <div
                  onClick={() => setResetConfig((prev) => ({ ...prev, mode: "all" }))}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer transition-colors space-y-1",
                    resetConfig.mode === "all"
                      ? "border-rose-400 bg-rose-50/70"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={resetConfig.mode === "all"}
                        onChange={() => { }}
                        className="text-rose-600"
                      />
                      Semua Periode (Reset Total)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-800 border-rose-300">
                      Seluruh Riwayat
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-4">
                    Menghapus seluruh riwayat penempatan regu dari awal waktu hingga seterusnya.
                  </p>
                </div>
              </div>
            </div>

            {/* Pilihan Lingkup Regu */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Lingkup Regu yang Direset:</Label>
              <Select
                value={resetConfig.team_id || "all"}
                onValueChange={(v) => setResetConfig((prev) => ({ ...prev, team_id: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 bg-white text-xs">
                  <SelectValue placeholder="Pilih lingkup regu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Regu (Regu 1 s/d 6)</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Hanya {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
              ℹ️ <b>Catatan:</b> Data master pegawai (54 orang, nama, NIP) tetap aman. Komandan Regu &amp; Kasubid tidak terhapus.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={resetConfig.submitting}
              onClick={() => setResetConfig((prev) => ({ ...prev, open: false }))}
            >
              Batal
            </Button>
            <Button
              onClick={submitReset}
              disabled={resetConfig.submitting}
              className="bg-rose-600 hover:bg-rose-700 gap-1.5"
              data-testid="reset-confirm-btn"
            >
              {resetConfig.submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {resetConfig.mode === "all" ? "Ya, Reset Total" : "Reset Penempatan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Button size="sm" variant="outline" onClick={() => setKsForm({ position_id: k.position_id, employee_id: "", start_date: selectedDate, label: k.label })} data-testid={`ks-set-${k.position_id}`}>
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
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Cari nama atau NIP..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="h-8 pl-8 pr-7 bg-white text-xs"
                data-testid="search-team-members"
              />
              {memberSearch && (
                <button
                  type="button"
                  onClick={() => setMemberSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Badge className="gap-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Crown className="h-3.5 w-3.5" /> Komandan: {detail?.commander?.nama || "—"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setCmd({ employee_id: "", start_date: selectedDate })} data-testid="set-commander-btn">
              <Crown className="mr-1.5 h-4 w-4" /> Komandan
            </Button>
            <Button size="sm" variant="outline" onClick={openHist} data-testid="team-history-btn">
              <History className="mr-1.5 h-4 w-4" /> Riwayat
            </Button>
            <Button size="sm" onClick={() => openRollDialog([], activeTeam)} className="bg-red-600 hover:bg-red-700" data-testid="roll-btn">
              <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Rolling
            </Button>
          </div>
        </div>
        {loading ? <TableSkeleton rows={8} columns={5} /> : (detail?.members?.length || 0) === 0 ? (
          <p className="py-16 text-center text-slate-400">Belum ada anggota di regu ini.</p>
        ) : filteredMembers.length === 0 ? (
          <p className="py-12 text-center text-slate-400">Tidak ada anggota yang cocok dengan pencarian "{memberSearch}".</p>
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
                {filteredMembers.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`member-row-${e.id}`}>
                    <td className="px-3 py-2.5 text-slate-400">{e.no}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{e.nama} {e.is_commander && <span title="Komandan Regu">⭐</span>}</td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-500 md:table-cell">{e.nip}</td>
                    <td className="hidden px-3 py-2.5 text-slate-500 lg:table-cell">{e.jabatan}</td>
                    <td className="px-3 py-2.5">{e.is_commander ? <Badge className="bg-amber-100 text-amber-700">⭐ Komandan</Badge> : <Badge variant="outline">Anggota</Badge>}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openRollDialog([e.id], "")} data-testid={`move-btn-${e.id}`}>
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

      {/* Rolling dialog (Batch / Multi-select) */}
      <Dialog open={!!roll} onOpenChange={(o) => !o && setRoll(null)}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-3xl lg:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-6 overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ArrowRightLeft className="h-5 w-5 text-red-600" />
              Penempatan / Rolling Regu (Batch)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih regu tujuan, tanggal mulai, dan cari serta centang beberapa pegawai sekaligus untuk ditambahkan ke regu.
            </DialogDescription>
          </DialogHeader>

          {roll && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Target Team & Date Mode Selection */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Pindah ke Regu Tujuan</Label>
                    <Select value={roll.team_id} onValueChange={(v) => setRoll({ ...roll, team_id: v })}>
                      <SelectTrigger data-testid="roll-team" className="h-9 bg-white">
                        <SelectValue placeholder="Pilih regu tujuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="font-medium">{t.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Mode Periode Penempatan</Label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setRoll({ ...roll, mode: "tunggal", end_date: roll.end_date || addMonthsToDate(roll.start_date, 3) })}
                        className={cn(
                          "py-1.5 px-2 rounded-md font-semibold text-[11px] transition-all",
                          roll.mode === "tunggal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Tunggal
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoll({ ...roll, mode: "rentang" })}
                        className={cn(
                          "py-1.5 px-2 rounded-md font-semibold text-[11px] transition-all",
                          roll.mode === "rentang" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Rentang Waktu
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoll({ ...roll, mode: "seterusnya" })}
                        className={cn(
                          "py-1.5 px-2 rounded-md font-semibold text-[11px] transition-all",
                          roll.mode === "seterusnya" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Seterusnya
                      </button>
                    </div>
                  </div>
                </div>

                {/* Date range inputs and quick presets */}
                {roll.mode === "rentang" && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Tanggal Mulai Penempatan</Label>
                        <Input
                          type="date"
                          value={roll.start_date}
                          onChange={(e) => setRoll({ ...roll, start_date: e.target.value })}
                          data-testid="roll-date"
                          className="h-8 bg-white cursor-pointer text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Tanggal Selesai Penempatan</Label>
                        <Input
                          type="date"
                          value={roll.end_date}
                          onChange={(e) => setRoll({ ...roll, end_date: e.target.value })}
                          className="h-8 bg-white cursor-pointer text-xs"
                        />
                      </div>
                    </div>

                    {/* Quick preset buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">Preset Cepat:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRoll({ ...roll, end_date: addMonthsToDate(roll.start_date, 3) })}
                        className="h-6 text-[11px] px-2 bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      >
                        +3 Bulan (Triwulan)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRoll({ ...roll, end_date: addMonthsToDate(roll.start_date, 1) })}
                        className="h-6 text-[11px] px-2 bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      >
                        +1 Bulan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRoll({ ...roll, end_date: addMonthsToDate(roll.start_date, 6) })}
                        className="h-6 text-[11px] px-2 bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      >
                        +6 Bulan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRoll({ ...roll, end_date: addMonthsToDate(roll.start_date, 12) })}
                        className="h-6 text-[11px] px-2 bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      >
                        +1 Tahun
                      </Button>
                    </div>
                  </div>
                )}

                {roll.mode === "tunggal" && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <div className="sm:w-1/2 space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">Tanggal Penempatan (1 Hari Saja)</Label>
                      <Input
                        type="date"
                        value={roll.start_date}
                        onChange={(e) => setRoll({ ...roll, start_date: e.target.value })}
                        data-testid="roll-date"
                        className="h-8 bg-white cursor-pointer text-xs"
                      />
                    </div>
                    <p className="text-[11px] text-red-700 pt-3">
                      Berlaku khusus tanggal <b>{formatDateId(roll.start_date)}</b>. Ideal untuk pergantian tugas harian tanpa mengubah jadwal sebelum/sesudahnya.
                    </p>
                  </div>
                )}

                {roll.mode === "seterusnya" && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <div className="sm:w-1/2 space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">Tanggal Mulai Penempatan</Label>
                      <Input
                        type="date"
                        value={roll.start_date}
                        onChange={(e) => setRoll({ ...roll, start_date: e.target.value })}
                        data-testid="roll-date"
                        className="h-8 bg-white cursor-pointer text-xs"
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 pt-1">
                      Berlaku mulai <b>{formatDateId(roll.start_date)}</b> seterusnya tanpa batas waktu akhir.
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Employees Area (Chips / Tags) */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Pegawai Terpilih
                    </span>
                    <Badge variant={roll.employee_ids.length > 0 ? "default" : "secondary"} className="text-xs">
                      {roll.employee_ids.length} orang
                    </Badge>
                  </div>
                  {roll.employee_ids.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllRollSelection}
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                    >
                      Kosongkan Semua
                    </Button>
                  )}
                </div>

                {roll.employee_ids.length === 0 ? (
                  <p className="text-[12px] text-slate-400 italic py-1">
                    Belum ada pegawai dipilih. Cari dan centang pegawai pada daftar di bawah untuk menambahkan ke regu.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 pt-1">
                    {selectedRollEmployees.map((emp: any) => (
                      <span
                        key={emp.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 pl-2 pr-1 py-1 text-xs font-medium text-slate-800"
                      >
                        <span className="truncate max-w-[180px]">{emp.nama}</span>
                        {emp.current_team_name && (
                          <span className="text-[11px] text-slate-500 font-normal">
                            ({emp.current_team_name.replace("Regu ", "R")})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleRollEmployee(emp.id)}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          title="Hapus dari daftar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-Select Employee Search and Checklist */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Cari pegawai (nama, NIP, atau jabatan)..."
                      value={rollSearch}
                      onChange={(e) => setRollSearch(e.target.value)}
                      className="h-8 pl-8 pr-7 text-xs bg-slate-50"
                      data-testid="roll-search"
                    />
                    {rollSearch && (
                      <button
                        type="button"
                        onClick={() => setRollSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={rollFilterTab === "all" ? "default" : "outline"}
                      onClick={() => setRollFilterTab("all")}
                      className={`h-7 px-2.5 text-xs ${rollFilterTab === "all" ? "bg-slate-800 text-white" : ""}`}
                    >
                      Semua ({allEmp.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rollFilterTab === "unassigned" ? "default" : "outline"}
                      onClick={() => setRollFilterTab("unassigned")}
                      className={`h-7 px-2.5 text-xs ${rollFilterTab === "unassigned" ? "bg-slate-800 text-white" : ""}`}
                    >
                      Belum Ada Regu ({unassignedEmpCount})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rollFilterTab === "other" ? "default" : "outline"}
                      onClick={() => setRollFilterTab("other")}
                      className={`h-7 px-2.5 text-xs ${rollFilterTab === "other" ? "bg-slate-800 text-white" : ""}`}
                    >
                      Regu Lain ({otherTeamsEmpCount})
                    </Button>
                  </div>
                </div>

                {/* Batch select/deselect actions */}
                <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                  <span>
                    Menampilkan <b>{filteredRollEmployees.length}</b> pegawai
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      disabled={filteredRollEmployees.length === 0}
                      className="text-xs font-semibold text-slate-700 hover:text-red-600 disabled:opacity-40"
                    >
                      + Pilih Semua Ditampilkan
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      disabled={filteredRollEmployees.length === 0}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40"
                    >
                      Batal Pilih Ditampilkan
                    </button>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="max-h-60 sm:max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                  {filteredRollEmployees.length === 0 ? (
                    <p className="p-8 text-center text-xs text-slate-400">
                      Tidak ada pegawai yang cocok dengan filter atau kata kunci "{rollSearch}".
                    </p>
                  ) : (
                    filteredRollEmployees.map((emp: any) => {
                      const isSelected = (roll.employee_ids || []).includes(emp.id);
                      const isTargetTeam = Boolean(roll.team_id && emp.current_team_id === roll.team_id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleRollEmployee(emp.id)}
                          data-testid={`roll-emp-item-${emp.id}`}
                          className={cn(
                            "flex items-center justify-between p-2.5 transition-colors cursor-pointer text-xs",
                            isSelected
                              ? "bg-red-50/70"
                              : "hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRollEmployee(emp.id)}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`roll-checkbox-${emp.id}`}
                            />
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-slate-900 truncate py-1">
                                {emp.nama}
                              </p>
                              <p className="text-[12px] text-slate-500 truncate">
                                {emp.nip ? `NIP: ${emp.nip}` : "Tanpa NIP"} · {emp.jabatan || "Anggota"}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isTargetTeam ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[12px]">
                                Sudah di regu ini
                              </Badge>
                            ) : emp.current_team_name ? (
                              <Badge variant="outline" className="text-[12px] text-slate-600">
                                {emp.current_team_name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[12px] bg-slate-100 text-slate-500">
                                Belum Ada Regu
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Warning note dinamis sesuai mode penempatan */}
              <p className="rounded-lg bg-sky-50 p-2.5 text-xs text-sky-800 border border-sky-200">
                {roll.mode === "tunggal" ? (
                  <>📌 <b>Tanggal Tunggal:</b> Penempatan berlaku khusus pada <b>{formatDateId(roll.start_date)}</b>. Penempatan sebelum dan sesudah tanggal ini tidak terpengaruh.</>
                ) : roll.mode === "rentang" ? (
                  <>📌 <b>Rentang Waktu:</b> Penempatan berlaku dari <b>{formatDateId(roll.start_date)}</b> s/d <b>{formatDateId(roll.end_date || roll.start_date)}</b>. Sistem otomatis menyesuaikan riwayat penempatan tanpa bentrok.</>
                ) : (
                  <>📌 <b>Seterusnya:</b> Penempatan berlaku mulai <b>{formatDateId(roll.start_date)}</b> seterusnya. Penempatan sebelumnya akan ditutup sehari sebelum tanggal ini.</>
                )}
              </p>
            </div>
          )}

          <DialogFooter className="mt-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setRoll(null)}
              data-testid="roll-cancel"
              disabled={submittingRoll}
            >
              Batal
            </Button>
            <Button
              onClick={submitRoll}
              disabled={submittingRoll || !roll?.team_id || (roll?.employee_ids?.length || 0) === 0}
              className="bg-red-600 hover:bg-red-700 gap-1.5"
              data-testid="roll-save-btn"
            >
              {submittingRoll && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan Penempatan ({roll?.employee_ids?.length || 0} Pegawai)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Nama Regu</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              ID regu tetap permanen, histori absensi tidak terpengaruh.
            </DialogDescription>
          </DialogHeader>
          {rename && <Input value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} data-testid="rename-input" />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRename(null)} disabled={submittingRename}>Batal</Button>
            <Button onClick={submitRename} disabled={!rename?.name?.trim() || submittingRename} className="bg-red-600 hover:bg-red-700" data-testid="rename-save-btn">
              {submittingRename && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commander dialog */}
      <Dialog open={!!cmd} onOpenChange={(o) => !o && setCmd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tetapkan Komandan {curTeam?.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih anggota regu sebagai komandan dan tentukan tanggal mulai berlaku.
            </DialogDescription>
          </DialogHeader>
          {cmd && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Komandan (anggota regu)</Label>
                <EmployeeSearchSelect
                  value={cmd.employee_id}
                  onChange={(v) => setCmd({ ...cmd, employee_id: v })}
                  employees={detail?.members || []}
                  placeholder="Cari & pilih komandan (nama atau NIP)..."
                  data-testid="cmd-employee"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku mulai</Label>
                <Input type="date" value={cmd.start_date} onChange={(e) => setCmd({ ...cmd, start_date: e.target.value })} data-testid="cmd-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">Komandan lama tetap tercatat pada laporan periode sebelum tanggal ini.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCmd(null)} disabled={submittingCmd}>Batal</Button>
            <Button onClick={submitCmd} disabled={!cmd?.employee_id || submittingCmd} className="bg-red-600 hover:bg-red-700" data-testid="cmd-save-btn">
              {submittingCmd && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kasubid dialog */}
      <Dialog open={!!ksForm} onOpenChange={(o) => !o && setKsForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tetapkan {ksForm?.label}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih pejabat dari data pegawai dan tentukan tanggal mulai pelantikan.
            </DialogDescription>
          </DialogHeader>
          {ksForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pejabat</Label>
                <EmployeeSearchSelect
                  value={ksForm.employee_id}
                  onChange={(v) => setKsForm({ ...ksForm, employee_id: v })}
                  employees={availableKasubidEmployees}
                  placeholder="Cari & pilih pejabat (nama atau NIP)..."
                  data-testid="ks-employee"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku mulai</Label>
                <Input type="date" value={ksForm.start_date} onChange={(e) => setKsForm({ ...ksForm, start_date: e.target.value })} data-testid="ks-date" />
              </div>
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">Pejabat lama tetap muncul pada laporan sebelum masa jabatan baru.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKsForm(null)} disabled={submittingKasubid}>Batal</Button>
            <Button onClick={submitKasubid} disabled={!ksForm?.employee_id || submittingKasubid} className="bg-red-600 hover:bg-red-700" data-testid="ks-save-btn">
              {submittingKasubid && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team history dialog */}
      <Dialog open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Perubahan Anggota — {curTeam?.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Catatan mutasi dan penempatan personil pada regu ini.
            </DialogDescription>
          </DialogHeader>
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
