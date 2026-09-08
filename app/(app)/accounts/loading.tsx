import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { HeaderSkeleton } from "@/components/app-shell/page-skeleton";

export default function AccountsLoading() {
  return (
    <>
      <HeaderSkeleton title="Accounts" />
      <div className="mb-5">
        <Skeleton className="h-9 w-32 rounded-pill" />
      </div>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <Card>
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
