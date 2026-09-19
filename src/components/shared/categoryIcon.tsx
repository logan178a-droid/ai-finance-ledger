import {
  ShoppingCart,
  UtensilsCrossed,
  Car,
  Fuel,
  ShoppingBag,
  Receipt,
  Clapperboard,
  Repeat,
  Landmark,
  CreditCard,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/types";

const ICONS: Record<Category, LucideIcon> = {
  Groceries: ShoppingCart,
  "Food & Dining": UtensilsCrossed,
  Transportation: Car,
  Fuel: Fuel,
  Shopping: ShoppingBag,
  "Bills & Utilities": Receipt,
  Entertainment: Clapperboard,
  Subscriptions: Repeat,
  Salary: Landmark,
  Transfer: Repeat,
  "Credit Card Payment": CreditCard,
  Healthcare: Stethoscope,
  Other: Wallet,
};

export function CategoryIcon({ category, size = 16, className }: { category: Category; size?: number; className?: string }) {
  const Icon = ICONS[category] ?? Wallet;
  return <Icon size={size} className={className} />;
}
