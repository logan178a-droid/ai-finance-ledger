"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Landmark, CreditCard as CardIcon, Check, Pencil, Trash2 } from "lucide-react";

export interface LinkedAccountRow {
  id: string;
  kind: "account" | "card";
  name: string;
  lastFourDigits: string;
}

/**
 * The Cards & Accounts management screen — rename, fix a last-4 digit, or
 * delete any account/card, whether you added it yourself (from Accounts) or
 * it was auto-created the first time a shared bank SMS mentioned one we
 * hadn't seen. The last-4 digits are what let AI capture (text, voice, and
 * Share-to-app) match a bank SMS/notification to the right real
 * account/card instead of guessing or creating a duplicate.
 */
export function LinkedCardsTab({ initialRows }: { initialRows: LinkedAccountRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [nameValues, setNameValues] = useState<Record<string, string>>(() => Object.fromEntries(initialRows.map((r) => [r.id, r.name])));
  const [digitValues, setDigitValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.id, r.lastFourDigits]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkedAccountRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const url = deleteTarget.kind === "account" ? `/api/accounts/${deleteTarget.id}` : `/api/credit-cards/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? "Couldn't delete that.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      showToast({ message: `${deleteTarget.name} removed.` });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Couldn't delete that. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

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
        Rename any account/card, fix its last-4 digits, or delete one — including entries auto-created the first time
        a shared bank SMS mentioned an account we hadn&rsquo;t seen before.
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
                <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(row)} className="text-danger hover:text-danger" aria-label={`Delete ${row.name}`}>
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "this"}?`}
        description="This can't be undone. If it has transactions on it, delete or reassign those first."
      >
        {deleteError && <p className="text-xs text-danger mb-3">{deleteError}</p>}
        <div className="flex gap-2">
          <Button variant="destructive" onClick={confirmDelete} loading={deleting} className="flex-1">
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
