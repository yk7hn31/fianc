import {
  CardSkeleton,
  HeaderSkeleton,
} from "@/components/app-shell/page-skeleton";

export default function SettingsLoading() {
  return (
    <>
      <HeaderSkeleton title="Settings" />
      <CardSkeleton lines={4} />
      <div className="mt-4">
        <CardSkeleton lines={3} />
      </div>
    </>
  );
}
