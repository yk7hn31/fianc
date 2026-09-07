export interface DefaultCategory {
  name: string;
  kind: "income" | "expense";
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Salary", kind: "income", icon: "Banknote" },
  { name: "Groceries", kind: "expense", icon: "ShoppingCart" },
  { name: "Rent", kind: "expense", icon: "House" },
  { name: "Transport", kind: "expense", icon: "Bus" },
  { name: "Dining", kind: "expense", icon: "UtensilsCrossed" },
  { name: "Utilities", kind: "expense", icon: "Plug" },
  { name: "Health", kind: "expense", icon: "HeartPulse" },
  { name: "Shopping", kind: "expense", icon: "ShoppingBag" },
  { name: "Other", kind: "expense", icon: "Circle" },
];
