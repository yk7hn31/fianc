import { requireUser } from "@/lib/auth/guard";
import { listCategories } from "@/lib/queries/categories";
import { AppHeader } from "@/components/app-shell/app-header";
import { CategoryIcon } from "@/components/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { ArchiveButton } from "@/components/archive-button";
import { CategoryForm } from "./category-form";
import { archiveCategory } from "./actions";

export default async function CategoriesPage() {
  const user = await requireUser();
  const all = await listCategories(user.id);
  const groups = [
    { kind: "income" as const, label: "Income" },
    { kind: "expense" as const, label: "Expense" },
  ];

  return (
    <>
      <AppHeader title="Categories" />
      <div className="mb-5">
        <CategoryForm />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ kind, label }) => (
          <Card key={kind}>
            <CardContent className="p-5">
              <p className="text-caption uppercase text-muted-foreground mb-3">
                {label}
              </p>
              <ul className="space-y-2">
                {all
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={c.icon} />
                        {c.name}
                      </span>
                      <ArchiveButton
                        label={c.name}
                        onArchive={archiveCategory.bind(null, c.id)}
                      />
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
