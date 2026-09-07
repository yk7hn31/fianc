export function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-caption uppercase text-muted-foreground">{label}</p>
      <p className="text-heading-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
    </div>
  );
}
