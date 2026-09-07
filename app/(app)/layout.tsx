import { requireUser } from "@/lib/auth/guard";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <SidebarNav userName={user.name} />
      {/*
        The bottom bar is fixed, so the page has to reserve its height. A flat
        pb-24 was 96px against a bar of ~57px plus whatever the device reports
        as its bottom inset — fine on an iPhone's 34px home indicator, ~8px
        short on Android gesture nav at 48px. Computed from the real inset
        instead so it cannot under-clear.
      */}
      <main className="flex-1 min-w-0 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
