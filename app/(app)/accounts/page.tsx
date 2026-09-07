import { requireUser } from "@/lib/auth/guard";
import { listAccountsWithBalance } from "@/lib/queries/accounts";
import { formatAmount } from "@/lib/money";
import { AppHeader } from "@/components/app-shell/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { ArchiveButton } from "@/components/archive-button";
import { AccountForm } from "./account-form";
import { archiveAccount } from "./actions";

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await listAccountsWithBalance(user.id);

  return (
    <>
      <AppHeader title="Accounts" />
      <div className="mb-5">
        <AccountForm />
      </div>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground">
          No accounts yet. Add one to start recording transactions.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-2 p-5">
                  <div>
                    <p className="text-caption uppercase text-muted-foreground">
                      {a.type.replace("_", " ")}
                    </p>
                    <p className="text-body-lg font-medium">{a.name}</p>
                    <p className="text-heading font-semibold tabular-nums">
                      {formatAmount(a.balanceMinor, user.baseCurrency)}
                    </p>
                  </div>
                  <ArchiveButton
                    label={a.name}
                    onArchive={archiveAccount.bind(null, a.id)}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
