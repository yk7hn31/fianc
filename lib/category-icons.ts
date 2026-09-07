import {
  Banknote,
  Bus,
  Circle,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PawPrint,
  Plane,
  Plug,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The complete set of icons a category can carry, as named imports.
 *
 * The obvious implementation looks up lucide's `icons` registry by name, but
 * that registry holds every one of the ~1800 icons and defeats tree-shaking:
 * it pushed the categories route's First Load JS to 328 kB against 193 kB for
 * a comparable page. Since a category's icon can only ever come from the
 * picker or the seed list, naming them here costs nothing and ships only what
 * is used. Adding an icon means adding it here.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Circle,
  ShoppingCart,
  House,
  Bus,
  UtensilsCrossed,
  Plug,
  HeartPulse,
  ShoppingBag,
  Banknote,
  Plane,
  Dumbbell,
  Gift,
  GraduationCap,
  PawPrint,
  Wrench,
  Film,
};

/**
 * What the icon picker offers, in display order — object literals iterate
 * string keys in insertion order, so this is deterministic. Typed as a
 * non-empty tuple so `z.enum` can be built from it, which keeps the action's
 * accepted values and the picker's offered values the same list.
 */
export const ICON_CHOICES = Object.keys(CATEGORY_ICONS) as [string, ...string[]];
