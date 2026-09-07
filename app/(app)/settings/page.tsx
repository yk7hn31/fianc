import { requireUser } from "@/lib/auth/guard";
import { AppHeader } from "@/components/app-shell/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyForm } from "./currency-form";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <AppHeader title="Settings" />

      <Card>
        <CardContent className="p-5">
          <h2 className="text-subheading font-medium mb-1">Money</h2>
          <p className="text-muted-foreground mb-5">
            How amounts are shown and how new ones are read.
          </p>
          <CurrencyForm current={user.baseCurrency} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="text-subheading font-medium mb-1">Account</h2>
          <dl className="grid gap-1">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
