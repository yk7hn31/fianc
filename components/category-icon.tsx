import { Circle, icons } from "lucide-react";

export function CategoryIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = (icons as Record<string, typeof Circle>)[name] ?? Circle;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
