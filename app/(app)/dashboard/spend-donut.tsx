"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * recharts is the single heaviest thing the app downloads — most of the
 * dashboard route's ~98 kB — and the donut is one card below the fold on a
 * phone. Loading it on its own chunk keeps it off the critical path of the
 * dashboard tab: the stats, budgets and Recent list render and respond while
 * the chart is still arriving.
 *
 * `ssr: false` as well, so the chart's several hundred SVG nodes stay out of
 * the streamed payload too. The placeholder holds the same h-56 the chart
 * occupies, so nothing below it moves when it lands.
 */
const SpendDonutChart = dynamic(
  () => import("./spend-donut-chart").then((m) => m.SpendDonutChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center">
        <Skeleton className="size-40 rounded-full" />
      </div>
    ),
  },
);

export function SpendDonut(props: {
  data: { name: string; spentMinor: number }[];
  currency: string;
}) {
  return <SpendDonutChart {...props} />;
}
