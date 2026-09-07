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
  // data-icon so tests and styles key off a name this app owns, rather than
  // lucide's generated class, which a version bump could rename.
  return (
    <Icon
      className={className}
      strokeWidth={1.5}
      data-icon={name}
      aria-hidden
    />
  );
}
