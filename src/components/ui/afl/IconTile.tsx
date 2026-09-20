import type { ReactNode } from "react";

/**
 * 34px rounded-square icon tile, background tinted to ~12% opacity of the
 * icon's own color — the recurring "category icon" treatment from the
 * locked spec, reused for transaction rows everywhere (Home, Transactions,
 * Account Ledger, Credit Card activity).
 */
export function IconTile({ color, size = 34, children }: { color: string; size?: number; children: ReactNode }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 34 ? 11 : 9,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
