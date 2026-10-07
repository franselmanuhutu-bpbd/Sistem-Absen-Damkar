import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmployeeOption {
  id: string;
  nama: string;
  nip?: string;
  current_team_name?: string;
  jabatan?: string;
  is_commander?: boolean;
  [key: string]: any;
}

interface EmployeeSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  employees: EmployeeOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
  allowClear?: boolean;
  emptyMessage?: string;
}

export function EmployeeSearchSelect({
  value,
  onChange,
  employees,
  placeholder = "Pilih pegawai (cari nama atau NIP)...",
  disabled = false,
  className,
  "data-testid": testId,
  allowClear = true,
  emptyMessage = "Tidak ada pegawai ditemukan",
}: EmployeeSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => String(e.id) === String(value)) || null;
  }, [employees, value]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) => {
      const matchName = e.nama ? e.nama.toLowerCase().includes(term) : false;
      const matchNip = e.nip ? String(e.nip).toLowerCase().includes(term) : false;
      const matchTeam = e.current_team_name ? e.current_team_name.toLowerCase().includes(term) : false;
      const matchJabatan = e.jabatan ? e.jabatan.toLowerCase().includes(term) : false;
      return matchName || matchNip || matchTeam || matchJabatan;
    });
  }, [employees, search]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (emp: EmployeeOption) => {
    onChange(emp.id);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredEmployees.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredEmployees[highlightedIndex]) {
        handleSelect(filteredEmployees[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        data-testid={testId}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm text-left shadow-sm ring-offset-background transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          !selectedEmployee && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden mr-2 flex-1">
          {selectedEmployee ? (
            <>
              <User className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{selectedEmployee.nama}</span>
              {selectedEmployee.nip && (
                <span className="text-xs font-mono text-slate-500 shrink-0 truncate">({selectedEmployee.nip})</span>
              )}
              {selectedEmployee.current_team_name && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 shrink-0">
                  {selectedEmployee.current_team_name}
                </span>
              )}
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedEmployee && allowClear && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              title="Hapus pilihan"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Cari berdasarkan nama atau NIP..."
                className="h-8 w-full rounded border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span>{filteredEmployees.length} pegawai ditemukan</span>
              {search && <span className="text-red-600 font-medium">Filter aktif</span>}
            </div>
          </div>

          {/* Employee List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, index) => {
                const isSelected = String(emp.id) === String(value);
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelect(emp)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs transition-colors",
                      isHighlighted ? "bg-slate-100" : "hover:bg-slate-50",
                      isSelected && "bg-red-50 text-red-900 font-medium"
                    )}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("font-medium", isSelected ? "text-red-900" : "text-slate-900")}>
                          {emp.nama}
                        </span>
                        {emp.is_commander && (
                          <span className="text-[10px] rounded bg-amber-100 px-1 text-amber-700 font-semibold">
                            ⭐ Komandan
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        {emp.nip ? <span className="font-mono">NIP: {emp.nip}</span> : <span>Tanpa NIP</span>}
                        {emp.current_team_name && <span>• {emp.current_team_name}</span>}
                        {emp.jabatan && <span className="truncate">• {emp.jabatan}</span>}
                      </div>
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-red-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
