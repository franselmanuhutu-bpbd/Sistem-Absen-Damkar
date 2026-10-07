import { useEffect, useState, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const PAGE_SIZE = 25;

function getPageNumbers(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get("/audit", { params: { limit: 500 } });
      setLogs(res.data || []);
      if (isRefresh) toast.success("Log audit berhasil diperbarui");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSearchChange = (val: string) => {
    setQ(val);
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((l) =>
      [
        l.user_name,
        l.user_email,
        l.action,
        l.employee_name,
        l.detail,
        l.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [logs, q]);

  // Pagination calculations
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentLogs = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );
  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">
            Audit Log Aktivitas
          </h2>
          {loading ? (
            <Skeleton className="h-4 w-52 mt-1" />
          ) : (
            <p className="text-sm text-slate-500">
              Riwayat seluruh perubahan data &amp; absensi ({logs.length} catatan termuat).
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(true)}
          disabled={loading || refreshing}
          className="self-start sm:self-auto gap-2 bg-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Segarkan
        </Button>
      </div>

      {/* Search and control bar */}
      <Card className="border-slate-200 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Cari aktivitas / user / pegawai..."
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 pl-9 pr-8 bg-white"
              data-testid="audit-search"
            />
            {q && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Per halaman:</span>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                  pageSize === size
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Audit Log Card */}
      <Card className="border-slate-200 p-0 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-3 w-28 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            {q ? (
              <>
                <p>Tidak ada aktivitas yang cocok dengan "{q}".</p>
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Bersihkan filter pencarian
                </button>
              </>
            ) : (
              "Tidak ada aktivitas."
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentPage}-${q}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="divide-y divide-slate-100"
            >
              {currentLogs.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors"
                  data-testid={`audit-row-${l.id}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-slate-800">
                        {l.user_name || l.user_email}
                      </span>
                      <span className="text-sm text-slate-500">{l.action}</span>
                      {l.employee_name && (
                        <span className="text-sm font-medium text-slate-700">
                          — {l.employee_name}
                        </span>
                      )}
                      {l.old_status != null || l.new_status ? (
                        <span className="flex items-center gap-1.5">
                          <StatusBadge status={l.old_status} />
                          <span className="text-slate-400">→</span>
                          <StatusBadge status={l.new_status} />
                        </span>
                      ) : null}
                      {l.detail && (
                        <span className="text-xs text-slate-400">({l.detail})</span>
                      )}
                    </div>
                    {l.date && (
                      <p className="text-xs text-slate-400 mt-1">
                        Tanggal absensi: {l.date}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {fmt(l.timestamp)}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Pagination Bar */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Menampilkan{" "}
              <span className="font-semibold text-slate-800">
                {startIndex + 1}
              </span>
              –
              <span className="font-semibold text-slate-800">{endIndex}</span>{" "}
              dari{" "}
              <span className="font-semibold text-slate-800">{totalItems}</span>{" "}
              aktivitas
              {totalPages > 1 && (
                <span className="ml-1 text-slate-400">
                  (Halaman {currentPage} dari {totalPages})
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 self-center sm:self-auto">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  title="Halaman Pertama"
                  data-testid="audit-pagination-first"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  title="Sebelumnya"
                  data-testid="audit-pagination-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 px-1">
                  {pageNumbers.map((num, idx) =>
                    typeof num === "string" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1 text-xs text-slate-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPage(num)}
                        data-testid={`audit-page-${num}`}
                        className={`h-8 min-w-[32px] rounded px-2 text-xs font-medium transition-colors ${
                          currentPage === num
                            ? "bg-red-600 text-white font-semibold shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {num}
                      </button>
                    )
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  title="Berikutnya"
                  data-testid="audit-pagination-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  title="Halaman Terakhir"
                  data-testid="audit-pagination-last"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
