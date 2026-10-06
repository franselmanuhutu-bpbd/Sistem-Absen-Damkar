import { useEffect, useState, useRef } from "react";
import { monthLabel } from "@/lib/constants";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const curMonth = new Date().toISOString().slice(0, 7);
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  showArrows?: boolean;
  "data-testid"?: string;
  min?: string;
  max?: string;
}

export function MonthPicker({
  value,
  onChange,
  disabled = false,
  className,
  showArrows = true,
  "data-testid": dataTestId,
  min,
  max,
}: MonthPickerProps) {
  const [curY, curM] = (value || curMonth).split("-").map(Number);
  const [viewYear, setViewYear] = useState<number>(curY || new Date().getFullYear());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [valY] = (value || "").split("-").map(Number);
    if (valY) setViewYear(valY);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const goToPrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    let m = curM - 1;
    let y = curY;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const newVal = `${y}-${String(m).padStart(2, "0")}`;
    if (min && newVal < min) return;
    onChange(newVal);
  };

  const goToNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    let m = curM + 1;
    let y = curY;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const newVal = `${y}-${String(m).padStart(2, "0")}`;
    if (max && newVal > max) return;
    onChange(newVal);
  };

  const handleSelectMonth = (monthIndex: number) => {
    if (disabled) return;
    const newVal = `${viewYear}-${String(monthIndex).padStart(2, "0")}`;
    onChange(newVal);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <div
        className={cn(
          "flex h-10 items-center rounded-md border border-slate-200 bg-white shadow-sm transition-colors",
          disabled && "opacity-50 pointer-events-none bg-slate-50"
        )}
      >
        {showArrows && (
          <button
            type="button"
            disabled={disabled || (!!min && value <= min)}
            onClick={goToPrevMonth}
            className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-l-md border-r border-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          data-testid={dataTestId}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-full flex-1 items-center justify-between gap-2 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors",
            !showArrows && "rounded-md"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 text-red-600 shrink-0" />
            <span className="truncate">{monthLabel(value) || "Pilih Bulan"}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {showArrows && (
          <button
            type="button"
            disabled={disabled || (!!max && value >= max)}
            onClick={goToNextMonth}
            className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-r-md border-l border-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          {/* Year navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
              title="Tahun sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-heading text-sm font-bold text-slate-900">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
              title="Tahun berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Months Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((name, idx) => {
              const mNum = idx + 1;
              const isSelected = viewYear === curY && mNum === curM;
              const mStr = `${viewYear}-${String(mNum).padStart(2, "0")}`;
              const isOutRange = (min && mStr < min) || (max && mStr > max);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={isOutRange}
                  onClick={() => handleSelectMonth(mNum)}
                  className={cn(
                    "rounded-lg py-2 text-xs font-semibold transition-all",
                    isSelected
                      ? "bg-red-600 text-white shadow-sm shadow-red-500/20"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    isOutRange && "opacity-30 pointer-events-none"
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, "0");
                onChange(`${y}-${m}`);
                setIsOpen(false);
              }}
              className="text-[11px] font-semibold text-red-600 hover:underline"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
