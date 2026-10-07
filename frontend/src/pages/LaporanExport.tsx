import { useEffect, useState } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/MonthPicker";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  FileText,
  Database,
  Loader2,
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import JSZip from "jszip";

function addMonths(ym: string, n: number) {
  let [y, m] = ym.split("-").map(Number);
  m += n;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}
const curMonth = new Date().toISOString().slice(0, 7);

export default function LaporanExport() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [start, setStart] = useState(addMonths(curMonth, -2));
  const [end, setEnd] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [category, setCategory] = useState("all");
  const [sections, setSections] = useState({ summary: true, breakdown: true, detail: false });
  const [exp, setExp] = useState("");

  // Backup status & Push notifications state
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [backupProgress, setBackupProgress] = useState<{
    stage: string;
    percent: number;
    currentTable?: string;
  } | null>(null);

  const isAdmin = Boolean(user && typeof user === "object" && user.role === "admin");

  const loadBackupStatus = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/notifications/backup-status");
      setBackupStatus(res.data);
    } catch {
      // ignore
    }
  };

  const checkPushSubscription = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;

    const sub = await getExistingSubscription();
    setPushSubscribed(!!sub);
  };

  useEffect(() => {
    api.get("/teams").then((r) => setTeams(r.data));
    if (isAdmin) {
      loadBackupStatus();
      checkPushSubscription();
    }
  }, [user, isAdmin]);

  const params = () => {
    const p: Record<string, any> = { start, end };
    if (teamId !== "all") p.team_id = teamId;
    if (category !== "all") p.category = category;
    return p;
  };

  const exportExcel = async () => {
    setExp("excel");
    try {
      await downloadFile(
        "/export/excel",
        { ...params(), include_breakdown: sections.breakdown, include_detail: sections.detail },
        `Rekap_${start}_${end}.xlsx`
      );
      toast.success("Excel berhasil diunduh");
    } catch (e) {
      toast.error(apiError(e));
    }
    setExp("");
  };

  const exportPdf = async () => {
    setExp("pdf");
    try {
      await downloadFile(
        "/export/pdf",
        { ...params(), include_summary: sections.summary, include_breakdown: sections.breakdown, include_detail: sections.detail },
        `Rekap_${start}_${end}.pdf`
      );
      toast.success("PDF berhasil diunduh");
    } catch (e) {
      toast.error(apiError(e));
    }
    setExp("");
  };

  const backup = async () => {
    setExp("backup");
    const toastId = toast.loading("Menyiapkan proses backup database...");
    setBackupProgress({ stage: "Menghubungi server untuk daftar tabel...", percent: 5 });

    try {
      // 1. Ambil daftar tabel yang tersedia dari backend
      const tablesRes = await api.get("/backup/tables");
      const tables: Array<{ name: string; label: string }> = tablesRes.data?.tables || [];
      if (!tables.length) {
        throw new Error("Daftar tabel database tidak ditemukan dari server.");
      }

      const zip = new JSZip();
      let totalRecords = 0;
      const metadata: Record<string, any> = {
        generated_at: new Date().toISOString(),
        backup_version: "2.0",
        system: "Sistem Informasi Absensi DAMKAR Mimika",
        tables: {},
      };

      // 2. Ambil data tiap tabel satu per satu dari backend
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const stepPercent = Math.round(5 + ((i + 0.5) / tables.length) * 80);
        const statusMsg = `Mengambil data: ${table.label || table.name} (${i + 1}/${tables.length})...`;

        toast.loading(statusMsg, { id: toastId });
        setBackupProgress({
          stage: statusMsg,
          percent: stepPercent,
          currentTable: table.name,
        });

        const tableRes = await api.get(`/backup/table/${table.name}`);
        const rows = tableRes.data?.data || [];
        totalRecords += rows.length;

        // Simpan per tabel sebagai file JSON tersendiri yang terformat rapi
        const jsonContent = JSON.stringify(rows, null, 2);
        zip.file(`${table.name}.json`, jsonContent);

        metadata.tables[table.name] = {
          label: table.label,
          records_count: rows.length,
        };
      }

      metadata.total_tables = tables.length;
      metadata.total_records = totalRecords;
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));

      // 3. Kompresi ke file ZIP di browser
      toast.loading("Mengompresi seluruh file JSON ke format ZIP...", { id: toastId });
      setBackupProgress({ stage: "Mengompresi file ke ZIP...", percent: 90 });

      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (meta) => {
          setBackupProgress({
            stage: `Mengompresi ZIP (${Math.round(meta.percent)}%)...`,
            percent: 88 + Math.round(meta.percent * 0.1),
          });
        }
      );

      // 4. Unduh file ZIP melalui browser
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
      const filename = `backup_damkar_${datePart}_${timePart}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      // 5. Catat log audit ke backend agar riwayat & pengingat backup terupdate
      try {
        await api.post("/backup/record-audit", {
          total_tables: tables.length,
          total_records: totalRecords,
          filename,
        });
      } catch (err) {
        console.warn("Audit record failed:", err);
      }

      toast.success(
        `Backup selesai! ${tables.length} tabel (${totalRecords.toLocaleString("id-ID")} baris data) berhasil diunduh ke ${filename}`,
        { id: toastId, duration: 6000 }
      );
      await loadBackupStatus();
    } catch (e: any) {
      toast.error(apiError(e) || "Gagal melakukan backup database", { id: toastId });
    } finally {
      setBackupProgress(null);
      setExp("");
    }
  };

  const togglePush = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        const res = await unsubscribeFromPush();
        if (res.success) {
          setPushSubscribed(false);
          toast.success("Notifikasi Web Push dinonaktifkan di perangkat ini.");
          loadBackupStatus();
        } else {
          toast.error(res.error || "Gagal menonaktifkan notifikasi.");
        }
      } else {
        const res = await subscribeToPush();
        if (res.success) {
          setPushSubscribed(true);
          toast.success("Web Push aktif! Anda akan menerima pengingat berkala untuk backup database.");
          loadBackupStatus();
        } else {
          toast.error(res.error || "Gagal mengaktifkan Web Push.");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan.");
    } finally {
      setPushLoading(false);
    }
  };

  const resubscribePush = async () => {
    setPushLoading(true);
    try {
      const res = await subscribeToPush();
      if (res.success) {
        setPushSubscribed(true);
        toast.success("Subscription Web Push berhasil diperbarui dengan kunci server terbaru!");
        loadBackupStatus();
      } else {
        toast.error(res.error || "Gagal memperbarui Web Push.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan.");
    } finally {
      setPushLoading(false);
    }
  };

  const testPush = async () => {
    try {
      const res = await api.post("/notifications/test", {
        title: "🔔 Pengingat Backup DAMKAR (Tes)",
        body: "Web Push berhasil! Notifikasi pengingat database backup Anda telah aktif di browser.",
        url: "/laporan",
      });
      if (res.data?.status === "success") {
        toast.success(res.data.message);
      } else if (res.data?.status === "warning") {
        toast.warning(res.data.message);
      } else {
        toast.error(res.data?.message || "Notifikasi gagal terkirim.");
      }
    } catch (err: any) {
      toast.error(apiError(err));
    }
  };

  const triggerReminderAll = async () => {
    try {
      const res = await api.post("/notifications/backup-reminder", { force: true });
      toast.success(res.data?.message || "Pengingat backup berhasil disiarkan ke admin.");
      loadBackupStatus();
    } catch (err: any) {
      toast.error(apiError(err));
    }
  };

  const formatBackupDate = (isoStr: string | null) => {
    if (!isoStr) return "Belum pernah";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const Section = ({ k, title, desc }: { k: "summary" | "breakdown" | "detail"; title: string; desc: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <Checkbox
        checked={sections[k]}
        onCheckedChange={(v) => setSections({ ...sections, [k]: !!v })}
        data-testid={`section-${k}`}
        className="mt-0.5"
      />
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900">Laporan &amp; Export Resmi</h2>
        <p className="text-sm text-slate-500">Buat laporan absensi resmi dengan Kop Surat Pemkab Mimika.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-slate-200 p-5 lg:col-span-2 space-y-4">
          <h3 className="font-heading font-bold text-slate-800">Filter Laporan</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 flex flex-col">
              <Label>Bulan Mulai</Label>
              <MonthPicker
                data-testid="lap-start"
                value={start}
                onChange={(val) => {
                  setStart(val);
                  if (val > end) setEnd(val);
                }}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label>Bulan Selesai</Label>
              <MonthPicker
                data-testid="lap-end"
                value={end}
                min={start}
                onChange={(val) => setEnd(val)}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Regu</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-11" data-testid="lap-team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Regu</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11" data-testid="lap-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="Kasubid">Kasubid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Isi Laporan</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Section k="summary" title="Ringkasan" desc="Total & rekap per pegawai" />
              <Section k="breakdown" title="Breakdown Bulanan" desc="Rincian per bulan" />
              <Section k="detail" title="Detail Absensi" desc="Baris per tanggal" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button onClick={exportExcel} disabled={!!exp} className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="lap-excel-btn">
              {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Export Excel
            </Button>
            <Button onClick={exportPdf} disabled={!!exp} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="lap-pdf-btn">
              {exp === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Export PDF
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-[#0F172A] p-5 text-white">
            <FileText className="h-8 w-8 text-red-400" />
            <h3 className="font-heading mt-3 font-bold">Format Resmi</h3>
            <p className="mt-1 text-sm text-slate-300">
              PDF A4 landscape, kop surat Pemkab Mimika, header tabel berulang, nomor halaman, dan total keseluruhan.
            </p>
          </Card>

          {isAdmin && (
            <Card className="border-slate-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-slate-800">Backup Database</h3>
                    <p className="text-xs text-slate-500">Unduh data JSON lengkap</p>
                  </div>
                </div>
                {backupStatus && (
                  backupStatus.is_backup_due ? (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" /> Perlu Backup
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 text-white gap-1 text-xs hover:bg-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Aman
                    </Badge>
                  )
                )}
              </div>

              {/* Status information */}
              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" /> Terakhir Backup:
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatBackupDate(backupStatus?.last_backup_time)}
                  </span>
                </div>
                {backupStatus?.days_since_backup !== null && backupStatus?.days_since_backup !== undefined && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Jarak Backup:</span>
                    <span className="font-medium text-slate-800">
                      {backupStatus.days_since_backup === 0 ? "Hari ini" : `${backupStatus.days_since_backup} hari lalu`}{" "}
                      <span className="text-slate-400 font-normal">(Batas: {backupStatus.threshold_days} hari)</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-600">
                  <span>Perangkat Admin Terdaftar:</span>
                  <span className="font-semibold text-slate-800">
                    {backupStatus?.admin_subscribers_count ?? 0} perangkat
                  </span>
                </div>
              </div>

              {/* Backup Progress indicator if in progress */}
              {backupProgress && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs">
                  <div className="flex items-center justify-between font-medium text-amber-900">
                    <span className="flex items-center gap-1.5 truncate">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-600" />
                      <span className="truncate">{backupProgress.stage}</span>
                    </span>
                    <span className="shrink-0 font-bold ml-2">{backupProgress.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                    <div
                      className="h-full bg-amber-600 transition-all duration-300 rounded-full"
                      style={{ width: `${backupProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={backup}
                disabled={!!exp}
                variant="outline"
                className="w-full gap-2 border-slate-300 hover:bg-slate-100"
                data-testid="backup-btn"
              >
                {exp === "backup" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    <span>Memproses Backup ({backupProgress?.percent ?? 0}%)...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 text-slate-700" />
                    <span>Backup Database (ZIP)</span>
                  </>
                )}
              </Button>
              <p className="text-[11px] text-slate-400 text-center">
                Mengekstrak setiap tabel sebagai file JSON individual dan mengompresi langsung ke file .zip di browser.
              </p>

              {/* Web Push Notification Section */}
              <div className="border-t border-slate-100 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Bell className="h-3.5 w-3.5 text-amber-500" />
                    <span>Pengingat Web Push</span>
                  </div>
                  {pushSubscribed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Aktif
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Nonaktif</span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Terima notifikasi otomatis langsung di browser jika database belum dibackup lebih dari 7 hari.
                </p>

                {!pushSupported ? (
                  <p className="text-[11px] text-amber-600">Browser tidak mendukung Web Push.</p>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={togglePush}
                      disabled={pushLoading}
                      variant={pushSubscribed ? "outline" : "default"}
                      size="sm"
                      className={`w-full gap-1.5 text-xs ${!pushSubscribed ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                    >
                      {pushLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : pushSubscribed ? (
                        <>
                          <BellOff className="h-3.5 w-3.5 text-slate-500" /> Matikan Notifikasi di Perangkat Ini
                        </>
                      ) : (
                        <>
                          <BellRing className="h-3.5 w-3.5" /> Aktifkan Pengingat di Browser Ini
                        </>
                      )}
                    </Button>

                    {pushSubscribed && (
                      <div className="space-y-1.5 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={testPush}
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-8 gap-1 text-slate-700"
                          >
                            <Bell className="h-3 w-3" /> Tes Push
                          </Button>
                          <Button
                            onClick={triggerReminderAll}
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-8 gap-1 text-slate-700"
                          >
                            <Send className="h-3 w-3" /> Broadcast
                          </Button>
                        </div>
                        <Button
                          onClick={resubscribePush}
                          disabled={pushLoading}
                          variant="ghost"
                          size="sm"
                          className="w-full text-[11px] h-7 gap-1 text-slate-500 hover:text-slate-700"
                        >
                          <RefreshCw className={`h-3 w-3 ${pushLoading ? "animate-spin" : ""}`} /> Sinkron / Perbarui Kunci
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
