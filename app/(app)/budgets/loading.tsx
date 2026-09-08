import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton } from "@/components/app-shell/page-skeleton";

export default function BudgetsLoading() {
  return (
    <>
      <HeaderSkeleton title="Budgets" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-48 rounded-pill" />
        <Skeleton className="h-9 w-36 rounded-pill" />
      </div>
      <ul className="divide-y divide-border rounded-card border border-border bg-card shadow-card">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-pill" />
          </li>
        ))}
      </ul>
    </>
  );
}
