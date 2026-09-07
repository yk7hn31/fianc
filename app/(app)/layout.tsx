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
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-6 md:pb-6">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
