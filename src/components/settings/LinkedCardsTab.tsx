"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Landmark, CreditCard as CardIcon, Check, Pencil } from "lucide-react";

export interface LinkedAccountRow {
  id: string;
  kind: "account" | "card";
  name: string;
  lastFourDigits: string;
}

/**
 * Share-to-app capture builds this list up automatically: the first time a
 * shared bank SMS mentions an account/card we haven't seen, it's created
 * here on its own. This tab is just for cleanup afterwards — rename an
 * auto-created entry to something recognizable (e.g. "Kotak Credit Card
 * •1253" -> "Kotak Freedom Card"), fix a last-4 digit if it was misread, or
 * delete a wrongly-split duplicate from Accounts / Credit Cards.
 */
export function LinkedCardsTab({ initialRows }: { initialRows: LinkedAccountRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [nameValues, setNameValues] = useState<Record<string, string>>(() => Object.fromEntries(initialRows.map((r) => [r.id, r.name])));
  const [digitValues, setDigitValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.id, r.lastFourDigits]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { showToast } = useToast();

  async function save(row: LinkedAccountRow) {
    const name = (nameValues[row.id] ?? "").trim();
    const digits = (digitValues[row.id] ?? "").trim();
    if (!name) {
      showToast({ message: "Name can't be empty." });
      return;
    }
    if (digits && !/^\d{4}$/.test(digits)) {
      showToast({ message: "Enter exactly 4 digits, or leave it blank." });
      return;
    }
    setSavingId(row.id);
    try {
      const url = row.kind === "account" ? `/api/accounts/${row.id}` : `/api/credit-cards/${row.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, lastFourDigits: digits }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast({ message: body.error ?? "Couldn't save that." });
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name, lastFourDigits: digits } : r)));
      setSavedId(row.id);
      setTimeout(() => setSavedId((cur) => (cur === row.id ? null : cur)), 1600);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-1">Cards & accounts</h2>
      <p className="text-xs text-muted mb-4">
        These build up on their own — the first time you share a bank SMS or notification for an account/card we
        haven&rsquo;t seen, it&rsquo;s added here automatically. Rename any of them, fix a last-4 digit, or delete a
        wrongly-split duplicate from Accounts / Credit Cards.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No accounts or cards yet — add one manually, or just share a bank SMS and it&rsquo;ll appear here on its own.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const dirty = (nameValues[row.id] ?? "") !== row.name || (digitValues[row.id] ?? "") !== row.lastFourDigits;
            return (
              <li key={row.id} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted">
                  {row.kind === "account" ? <Landmark size={16} /> : <CardIcon size={16} />}
                </span>
                <div className="relative flex-1 min-w-[10rem]">
                  <Input
                    value={nameValues[row.id] ?? ""}
                    onChange={(e) => setNameValues((v) => ({ ...v, [row.id]: e.target.value }))}
                    placeholder="Account name"
                    className="pr-7"
                  />
                  <Pencil size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
                </div>
                <Input
                  value={digitValues[row.id] ?? ""}
                  onChange={(e) => setDigitValues((v) => ({ ...v, [row.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="1234"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-24 text-center shrink-0"
                />
                <Button variant="secondary" size="sm" onClick={() => save(row)} loading={savingId === row.id} disabled={!dirty}>
                  {savedId === row.id ? <Check size={14} /> : "Save"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
