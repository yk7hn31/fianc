import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-heading-sm font-semibold">{title}</h1>
      <form action={logout}>
        {/*
          `h-11`, because `size="sm"` is 28px tall and this button is on every
          page in the app. See the note on the size variants in
          components/ui/button.tsx.
        */}
        <Button variant="ghost" size="sm" className="h-11" type="submit">
          Sign out
        </Button>
      </form>
    </header>
  );
}
