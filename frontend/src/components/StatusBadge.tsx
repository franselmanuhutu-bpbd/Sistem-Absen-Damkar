import { STATUS_CONFIG } from "@/lib/constants";

interface StatusBadgeProps {
  status?: string | null;
  size?: "sm" | "lg";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  if (!status || !STATUS_CONFIG[status]) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        Belum diisi
      </span>
    );
  }
  const c = STATUS_CONFIG[status];
  const pad = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${pad} ${c.badge}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}
