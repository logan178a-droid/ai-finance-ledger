import type { Category } from "@/lib/types";

/** Deterministic color swatch per account (hash of its name) — a visual accent only, not fabricated data, so the same account always gets the same color across renders/sessions. */
const ACCOUNT_SWATCHES = ["#2F63D6", "#E24C4C", "#F0A83C", "#34D6A6", "#9C8CFF", "#4C86FF"];
export function accountSwatch(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ACCOUNT_SWATCHES[hash % ACCOUNT_SWATCHES.length];
}

/** Per-category tint color for IconTile backgrounds/icon strokes — matches the locked design spec's exact palette (coral for bills, violet for shopping, green for income, blue as the general default). */
export const CATEGORY_COLOR: Record<Category, string> = {
  Groceries: "#5FE7C3",
  "Food & Dining": "#F0A83C",
  Transportation: "#4C86FF",
  Fuel: "#F0A83C",
  Shopping: "#B49BFF",
  "Bills & Utilities": "#FF8FA0",
  Entertainment: "#9C8CFF",
  Subscriptions: "#9C8CFF",
  Salary: "#5FE7C3",
  Transfer: "#4C86FF",
  "Credit Card Payment": "#4C86FF",
  Healthcare: "#FF8FA0",
  Investment: "#9C8CFF",
  Other: "#7C89B8",
};
