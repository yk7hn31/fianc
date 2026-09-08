import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  HeaderSkeleton,
  RowsSkeleton,
} from "@/components/app-shell/page-skeleton";

export default function DashboardLoading() {
  return (
    <>
      <HeaderSkeleton title="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-48 rounded-pill" />
        <Skeleton className="hidden h-9 w-40 rounded-pill md:block" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-5 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-3 h-3 w-32" />
            {/* h-56 is the donut's own height; anything shorter and the
                chart's arrival shoves the Recent list down the page. */}
            <div className="flex h-56 items-center justify-center">
              <Skeleton className="size-40 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-3 h-3 w-20" />
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-pill" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-subheading font-medium">Recent</h2>
      <RowsSkeleton count={6} />
    </>
  );
}
