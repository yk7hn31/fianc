import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The pieces a route's `loading.tsx` paints while its data is in flight.
 *
 * Every page in this app is dynamic — `requireUser()` reads the session
 * cookie — and Next only prefetches a dynamic route as far as its nearest
 * loading boundary. With no boundary at all, clicking a tab prefetched
 * nothing and then sat on the old page, unchanged and unmarked, for the
 * whole session lookup plus the page's own queries. These stand in for that
 * gap, at the real heights, so the swap to live content does not jump.
 */

export function HeaderSkeleton({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-5">
      {/*
        The title is a literal, not a skeleton: it is the one thing already
        known before any query runs, and rendering it means the tab reads as
        switched on the click rather than a frame later.
      */}
      <h1 className="text-heading-sm font-semibold">{title}</h1>
      <Skeleton className="h-11 w-[4.5rem] rounded-pill" />
    </header>
  );
}

/** A stand-in for one Card + CardContent block. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            // Ragged, not flush: a column of identical bars reads as a
            // rendered table rather than as pending content.
            style={{ width: `${90 - i * 12}%` }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** A stand-in for a list or table of `count` transaction-shaped rows. */
export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="rounded-card border border-border bg-card shadow-card divide-y divide-border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
