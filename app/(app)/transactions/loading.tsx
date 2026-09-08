import { Skeleton } from "@/components/ui/skeleton";
import {
  HeaderSkeleton,
  RowsSkeleton,
} from "@/components/app-shell/page-skeleton";

export default function TransactionsLoading() {
  return (
    <>
      <HeaderSkeleton title="Transactions" />
      <div className="mb-5 hidden md:block">
        <Skeleton className="h-9 w-40 rounded-pill" />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-11 w-48 rounded-pill" />
        <Skeleton className="h-11 w-32 rounded-pill" />
        <Skeleton className="h-11 w-32 rounded-pill" />
      </div>
      <RowsSkeleton count={10} />
    </>
  );
}
