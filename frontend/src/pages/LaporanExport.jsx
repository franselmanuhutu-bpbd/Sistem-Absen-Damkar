import { useEffect, useState } from "react";
import api, { downloadFile, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";

function addMonths(ym, n) {
  let [y, m] = ym.split("-").map(Number);
  m += n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
const curMonth = new Date().toISOString().slice(0, 7);

export default function LaporanExport() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [start, setStart] = useState(addMonths(curMonth, -2));
  const [end, setEnd] = useState(curMonth);
  const [teamId, setTeamId] = useState("all");
  const [category, setCategory] = useState("all");
  const [sections, setSections] = useState({ summary: true, breakdown: true, detail: false });
  const [exp, setExp] = useState("");

  useEffect(() => { api.get("/teams").then((r) => setTeams(r.data)); }, []);

  const params = () => {
    const p = { start, end };
    if (teamId !== "all") p.team_id = teamId;
    if (category !== "all") p.category = category;
    return p;
  };

  const exportExcel = async () => {
    setExp("excel");
    try {
      await downloadFile("/export/excel", { ...params(), include_breakdown: sections.breakdown, include_detail: sections.detail }, `Rekap_${start}_${end}.xlsx`);
      toast.success("Excel berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };
  const exportPdf = async () => {
    setExp("pdf");
    try {
      await downloadFile("/export/pdf", { ...params(), include_summary: sections.summary, include_breakdown: sections.breakdown, include_detail: sections.detail }, `Rekap_${start}_${end}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };
  const backup = async () => {
    setExp("backup");
    try {
      await downloadFile("/backup", {}, `backup_damkar_${Date.now()}.json`);
      toast.success("Backup database berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExp("");
  };

  const Section = ({ k, title, desc }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <Checkbox checked={sections[k]} onCheckedChange={(v) => setSections({ ...sections, [k]: !!v })} data-testid={`section-${k}`} className="mt-0.5" />
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
            <div className="space-y-1.5"><Label>Bulan Mulai</Label><Input type="month" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} data-testid="lap-start" className="h-11" /></div>
            <div className="space-y-1.5"><Label>Bulan Selesai</Label><Input type="month" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="lap-end" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Regu</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-11" data-testid="lap-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Regu</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11" data-testid="lap-category"><SelectValue /></SelectTrigger>
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
            <Button onClick={exportExcel} disabled={exp} className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="lap-excel-btn">
              {exp === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Export Excel
            </Button>
            <Button onClick={exportPdf} disabled={exp} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="lap-pdf-btn">
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
          {user?.role === "admin" && (
            <Card className="border-slate-200 p-5">
              <Database className="h-8 w-8 text-slate-700" />
              <h3 className="font-heading mt-3 font-bold text-slate-800">Backup Database</h3>
              <p className="mt-1 text-sm text-slate-500">Unduh seluruh data (pegawai, regu, absensi, audit) dalam format JSON.</p>
              <Button onClick={backup} disabled={exp} variant="outline" className="mt-3 w-full gap-2" data-testid="backup-btn">
                {exp === "backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Backup Sekarang
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
