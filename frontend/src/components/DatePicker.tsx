import { useEffect, useState, useRef } from "react";
import { formatDateId, MONTH_NAMES } from "@/lib/constants";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const todayStr = new Date().toISOString().slice(0, 10);
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  showArrows?: boolean;
  "data-testid"?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  className,
  showArrows = true,
  "data-testid": dataTestId,
  min,
  max,
  placeholder = "Pilih Tanggal",
}: DatePickerProps) {
  const parsed = (value || todayStr).split("-").map(Number);
  const curY = parsed[0] || new Date().getFullYear();
  const curM = parsed[1] || new Date().getMonth() + 1;
  const curD = parsed[2] || new Date().getDate();

  const [viewYear, setViewYear] = useState<number>(curY);
  const [viewMonth, setViewMonth] = useState<number>(curM); // 1-12
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m);
      }
    }
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

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const goToPrevDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !value) return;
    const newVal = addDays(value, -1);
    if (min && newVal < min) return;
    onChange(newVal);
  };

  const goToNextDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !value) return;
    const newVal = addDays(value, 1);
    if (max && newVal > max) return;
    onChange(newVal);
  };

  const goToPrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    if (disabled) return;
    const mStr = String(viewMonth).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const newVal = `${viewYear}-${mStr}-${dStr}`;
    onChange(newVal);
    setIsOpen(false);
  };

  // Generate calendar days for viewYear & viewMonth
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const displayLabel = value ? formatDateId(value) : placeholder;

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
            disabled={disabled || (!!min && !!value && value <= min)}
            onClick={goToPrevDay}
            className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-l-md border-r border-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Hari sebelumnya"
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
            "flex h-full flex-1 items-center justify-between gap-2 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer min-w-0",
            !showArrows && "rounded-md"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 text-red-600 shrink-0" />
            <span className="truncate text-s">{displayLabel}</span>
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
            disabled={disabled || (!!max && !!value && value >= max)}
            onClick={goToNextDay}
            className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-r-md border-l border-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Hari berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          {/* Month & Year navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-heading text-sm font-bold text-slate-900">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400 mb-1">
            {DOW.map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const mStr = String(viewMonth).padStart(2, "0");
              const dStr = String(day).padStart(2, "0");
              const thisDateStr = `${viewYear}-${mStr}-${dStr}`;
              const isSelected = value === thisDateStr;
              const isToday = thisDateStr === todayStr;
              const isOutRange = (min && thisDateStr < min) || (max && thisDateStr > max);

              return (
                <button
                  key={thisDateStr}
                  type="button"
                  disabled={Boolean(isOutRange)}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center mx-auto rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    isSelected
                      ? "bg-red-600 text-white shadow-sm shadow-red-500/30 font-bold"
                      : isToday
                        ? "border border-red-300 text-red-600 bg-red-50/50 hover:bg-red-50"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    isOutRange && "opacity-25 pointer-events-none"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange(todayStr);
                setIsOpen(false);
              }}
              className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
