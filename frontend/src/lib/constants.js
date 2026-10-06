export const STATUSES = ["HDR", "OFF", "SKT", "TK", "IZN", "DL"];

export const STATUS_CONFIG = {
  HDR: { label: "Hadir", short: "HADIR", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 border-emerald-300", btn: "bg-emerald-600 hover:bg-emerald-700", text: "text-emerald-600", hex: "#16A34A" },
  OFF: { label: "Off / Libur", short: "OFF", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-300", btn: "bg-slate-600 hover:bg-slate-700", text: "text-slate-600", hex: "#64748B" },
  SKT: { label: "Sakit", short: "SAKIT", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800 border-blue-300", btn: "bg-blue-600 hover:bg-blue-700", text: "text-blue-600", hex: "#2563EB" },
  TK: { label: "Tanpa Keterangan", short: "ALPHA (TK)", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-800 border-rose-300", btn: "bg-rose-600 hover:bg-rose-700", text: "text-rose-600", hex: "#DC2626" },
  IZN: { label: "Izin", short: "IZIN", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800 border-amber-300", btn: "bg-amber-600 hover:bg-amber-700", text: "text-amber-600", hex: "#D97706" },
  DL: { label: "Dinas Luar", short: "DINAS LUAR", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-800 border-purple-300", btn: "bg-purple-600 hover:bg-purple-700", text: "text-purple-600", hex: "#9333EA" },
};

export const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export const ROLE_LABEL = { admin: "Administrator", operator: "Operator", viewer: "Viewer / Kepala" };
