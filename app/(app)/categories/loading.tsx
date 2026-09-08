import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { HeaderSkeleton } from "@/components/app-shell/page-skeleton";

export default function CategoriesLoading() {
  return (
    <>
      <HeaderSkeleton title="Categories" />
      <div className="mb-5">
        <Skeleton className="h-9 w-32 rounded-pill" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {["Income", "Expense"].map((label, card) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="mb-3 text-caption uppercase text-muted-foreground">
                {label}
              </p>
              <ul className="space-y-2">
                {/* Roughly the shape of the seeded defaults: one income
                    category against eight expense ones. */}
                {Array.from({ length: card === 0 ? 2 : 6 }, (_, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Skeleton className="size-5 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
