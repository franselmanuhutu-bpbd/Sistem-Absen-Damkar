import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, columns = 6, className = "" }: TableSkeletonProps) {
  return (
    <div className={`p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? "w-8" : i === 1 ? "w-28" : "flex-1"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2.5 border-b border-slate-100/60 last:border-0">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? "w-8" : j === 1 ? "w-32" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
