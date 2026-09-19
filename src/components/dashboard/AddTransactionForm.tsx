"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/StoreContext";
import { KNOWN_CATEGORIES } from "@/lib/ai/parseTransaction";
import { formatINR, cn } from "@/lib/utils";
import { format } from "date-fns";

type ManualType = "expense" | "income" | "transfer";

const TYPES: { value: ManualType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

const selectClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent";

/**
 * First-class manual entry form — a deliberate second path alongside the AI
 * capture surface (`/ai`), not a replacement for it. Submits through the
 * exact same real backend endpoints (`POST /api/transactions` /
 * `/api/transfers`) that the AI-confirmed flow uses, so a manually entered
 * transaction is indistinguishable in the ledger from an AI one except for
 * its `source` field.
 */
export function AddTransactionForm({ onSaved }: { onSaved?: () => void } = {}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { accounts, creditCards } = useStore();

  const [type, setType] = useState<ManualType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [paymentId, setPaymentId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paymentOptions = useMemo(
    () => [
      ...accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.type === "bank" ? "Bank" : a.type === "cash" ? "Cash" : "Investment"})` })),
      ...creditCards.map((c) => ({ id: c.id, label: `${c.name} (Credit Card)` })),
    ],
    [accounts, creditCards]
  );
  // Transfers move money between the user's own bank/cash/investment
  // accounts only — never a credit card (that's a credit-card payment, a
  // different transaction type entirely).
  const transferAccountOptions = accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.type === "bank" ? "Bank" : a.type === "cash" ? "Cash" : "Investment"})` }));

  function reset() {
    setType("expense");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentId("");
    setToAccountId("");
    setCategory("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (type === "transfer") {
      if (!paymentId || !toAccountId) {
        setError("Choose both a source and destination account.");
        return;
      }
      if (paymentId === toAccountId) {
        setError("Source and destination accounts must be different.");
        return;
      }
    } else if (!paymentId) {
      setError("Choose a payment method.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (type === "transfer") {
        res = await fetch("/api/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amt,
            transactionDate: date,
            fromAccountId: paymentId,
            toAccountId,
            source: "manual",
          }),
        });
      } else {
        const isCard = creditCards.some((c) => c.id === paymentId);
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionType: type,
            amount: amt,
            transactionDate: date,
            description: description.trim() || null,
            categoryName: category || null,
            accountId: isCard ? null : paymentId,
            creditCardId: isCard ? paymentId : null,
            source: "manual",
          }),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save that transaction.");
        return;
      }

      showToast({
        message:
          type === "transfer"
            ? `Transferred ${formatINR(amt)}`
            : `${type === "income" ? "Added income of" : "Added expense of"} ${formatINR(amt)}${description ? ` — ${description}` : ""}`,
      });
      reset();
      router.refresh();
      onSaved?.();
    } catch {
      setError("Couldn't save that transaction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted mb-1.5 block">Transaction type</label>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => {
                setType(t.value);
                setPaymentId("");
                setToAccountId("");
              }}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors",
                type === t.value ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Input label="Amount" type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />

      {type !== "transfer" && (
        <Input label="Description" placeholder="e.g. Electricity Bill" value={description} onChange={(e) => setDescription(e.target.value)} />
      )}

      <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      {type === "transfer" ? (
        <>
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">From account</label>
            <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className={selectClass}>
              <option value="">Select account</option>
              {transferAccountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">To account</label>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={selectClass}>
              <option value="">Select account</option>
              {transferAccountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Payment method</label>
          <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className={selectClass}>
            <option value="">Select payment method</option>
            {paymentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {type !== "transfer" && (
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">Select category</option>
            {KNOWN_CATEGORIES.filter((c) => c !== "Transfer" && c !== "Credit Card Payment").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" loading={submitting} className="w-full">
        Save transaction
      </Button>
    </form>
  );
}
