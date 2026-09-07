import { Circle } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/category-icons";

export function CategoryIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[name] ?? Circle;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
