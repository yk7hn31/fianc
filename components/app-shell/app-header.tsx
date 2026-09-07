import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-heading-sm font-semibold">{title}</h1>
      <form action={logout}>
        <Button variant="ghost" size="sm" type="submit">
          Sign out
        </Button>
      </form>
    </header>
  );
}
