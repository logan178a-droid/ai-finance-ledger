"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isAfter } from "date-fns";
import { Pencil, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store/StoreContext";
import { formatINR, cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { KNOWN_CATEGORIES } from "@/lib/ai/parseTransaction";
import { mostRecentStatementDate } from "@/lib/ledger/ledgerEngine";
import { CATEGORY_SUBCATEGORIES, SOURCE_LABEL, isAiSource, type Transaction, type TransactionType } from "@/lib/types";

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "Credit Card Payment",
  refund: "Refund",
};

// Transfers and credit-card payments are paired/linked entries (two legs
// sharing a transferId, or tied to a card's liability) — editing them
// generically here could desync that pairing, so editing is offered only
// for the straightforward single-entry types.
const EDITABLE_TYPES = new Set<TransactionType>(["expense", "income", "refund"]);

const selectClass = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

/**
 * The single, contextual "what is this transaction" view — used everywhere a
 * transaction can be expanded (the global Activity list, an Account Ledger
 * row, a Credit Card's activity list). Which fields show depends on the
 * transaction's type, per the redesign spec: an ordinary expense/income shows
 * one set, a credit-card charge adds statement info, a transfer shows both
 * legs, etc — never a single fixed field list.
 */
export function TransactionDetail({
  transaction,
  balanceAfter,
  onClose,
}: {
  transaction: Transaction;
  /** "Balance of the account/card this transaction affected, immediately after it" — the caller computes this from the ledger snapshot since it depends on the full history, not just this row. Omitted when not meaningful (e.g. a global list row where computing it isn't warranted). */
  balanceAfter?: number;
  onClose?: () => void;
}) {
  const { accounts, creditCards, removeTransaction } = useStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === transaction.account_id);
  const card = creditCards.find((c) => c.id === transaction.credit_card_id);
  const transferToAccount = accounts.find((a) => a.id === transaction.transfer_to_account_id);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? "Couldn't delete that transaction.");
        return;
      }
      removeTransaction(transaction.id);
      showToast({ message: "Transaction deleted." });
      setConfirmingDelete(false);
      onClose?.();
      router.refresh();
    } catch {
      setDeleteError("Couldn't delete that transaction. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <EditForm
        transaction={transaction}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  // Credit-card-specific: which statement cycle this charge falls in, and
  // whether it's already been billed — approximated from the card's current
  // statement day (the app doesn't store a per-transaction statement
  // snapshot, so this is computed the same way the card's live status is).
  let statementInfo: { cycleLabel: string; status: "Unbilled" | "Billed"; dueDate: string } | null = null;
  if (card) {
    const txDate = parseISO(transaction.transaction_date);
    const lastStatementDate = mostRecentStatementDate(card.statementDay, new Date());
    const isUnbilled = isAfter(txDate, lastStatementDate);
    statementInfo = {
      cycleLabel: format(lastStatementDate, "MMMM yyyy"),
      status: isUnbilled ? "Unbilled" : "Billed",
      dueDate: format(monthDayOnOrAfter(lastStatementDate, card.dueDay), "d MMM yyyy"),
    };
  }

  return (
    <div className="space-y-3.5 text-sm">
      <Detail label="Description" value={transaction.description} />
      {transaction.merchant && <Detail label="Merchant" value={transaction.merchant} />}
      <Detail label="Category" value={transaction.category} />
      {transaction.subcategory && <Detail label="Subcategory" value={transaction.subcategory} />}

      {transaction.transaction_type === "transfer" ? (
        <>
          <Detail label="Transfer From" value={account?.name ?? "—"} />
          <Detail label="Transfer To" value={transferToAccount?.name ?? "—"} />
          <Detail label="Transfer Amount" value={formatINR(transaction.amount)} />
          {transaction.transfer_id && <Detail label="Transfer ID" value={transaction.transfer_id.slice(0, 8)} mono />}
        </>
      ) : (
        <>
          <Detail label={transaction.transaction_type === "income" ? "Destination Account" : "Account"} value={account?.name ?? card?.name ?? "—"} />
          <Detail label="Payment Method" value={account?.name ?? card?.name ?? "—"} />
        </>
      )}

      {transaction.transaction_type === "income" && transaction.merchant && <Detail label="Income Source" value={transaction.merchant} />}

      {transaction.category === "Investment" && (
        <>
          {transaction.subcategory && <Detail label="Investment Type" value={transaction.subcategory} />}
          {transaction.merchant && <Detail label="Platform" value={transaction.merchant} />}
          <Detail label="Asset" value={transaction.description} />
        </>
      )}

      {card && statementInfo && (
        <>
          <Detail label="Credit Card" value={card.name} />
          <Detail label="Statement Cycle" value={statementInfo.cycleLabel} />
          <Detail
            label="Statement Status"
            value={statementInfo.status}
            tone={statementInfo.status === "Unbilled" ? "warning" : undefined}
          />
          <Detail label="Due Date" value={statementInfo.dueDate} />
        </>
      )}

      <Detail label="Transaction Type" value={TYPE_LABEL[transaction.transaction_type]} />
      <Detail label="Date" value={format(parseISO(transaction.transaction_date), "d MMM yyyy")} />
      {balanceAfter !== undefined && <Detail label="Running Balance" value={formatINR(balanceAfter)} />}

      <div className="pt-2 border-t border-border space-y-3.5">
        <Detail label="Added by" value={SOURCE_LABEL[transaction.source]} />
        {isAiSource(transaction.source) && transaction.ai_confidence !== undefined && (
          <Detail label="AI Confidence" value={`${Math.round(transaction.ai_confidence * 100)}%`} />
        )}
        {transaction.raw_text && (
          <div>
            <div className="text-xs text-muted mb-1.5">Original input</div>
            <div className="rounded-xl bg-background border border-border p-3 text-sm italic">&ldquo;{transaction.raw_text}&rdquo;</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {EDITABLE_TYPES.has(transaction.transaction_type) ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} className="flex-1">
            <Pencil size={13} /> Edit
          </Button>
        ) : (
          <span className="flex-1 text-xs text-muted flex items-center">
            {transaction.transaction_type === "transfer" ? "Transfers" : "Credit card payments"} can&rsquo;t be edited — delete and re-enter if needed.
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(true)} className="text-danger hover:text-danger">
          <Trash2 size={13} /> Delete
        </Button>
        {onClose && (
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close">
            <X size={14} />
          </Button>
        )}
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => {
          setConfirmingDelete(false);
          setDeleteError(null);
        }}
        title="Delete this transaction?"
        description={
          transaction.transaction_type === "transfer"
            ? "This can't be undone. Both linked entries (the debit and the credit) will be removed, and balances will be recalculated."
            : "This can't be undone. Balances will be recalculated."
        }
      >
        {deleteError && <p className="text-xs text-danger mb-3">{deleteError}</p>}
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete} loading={deleting} className="flex-1">
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function monthDayOnOrAfter(from: Date, day: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate.getTime() >= from.getTime()) return candidate;
  return new Date(from.getFullYear(), from.getMonth() + 1, day);
}

function Detail({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "warning" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className={cn("font-medium text-right truncate", mono && "font-mono text-xs", tone === "warning" && "text-warning")}>{value}</span>
    </div>
  );
}

function EditForm({ transaction, onCancel, onSaved }: { transaction: Transaction; onCancel: () => void; onSaved: () => void }) {
  const { accounts, creditCards, updateTransaction } = useStore();
  const { showToast } = useToast();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [description, setDescription] = useState(transaction.description);
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [category, setCategory] = useState<string>(transaction.category);
  const [subcategory, setSubcategory] = useState(transaction.subcategory ?? "");
  const [date, setDate] = useState(transaction.transaction_date);
  const [paymentId, setPaymentId] = useState(transaction.account_id ?? transaction.credit_card_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paymentOptions = [
    ...accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.type === "bank" ? "Bank" : a.type === "cash" ? "Cash" : "Investment"})` })),
    ...creditCards.map((c) => ({ id: c.id, label: `${c.name} (Credit Card)` })),
  ];

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    if (!paymentId) {
      setError("Choose a payment method.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isCard = creditCards.some((c) => c.id === paymentId);
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          description: description.trim(),
          merchant: merchant.trim() || null,
          categoryName: category,
          subcategory: subcategory || null,
          transactionDate: date,
          accountId: isCard ? null : paymentId,
          creditCardId: isCard ? paymentId : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save changes.");
        return;
      }
      updateTransaction(transaction.id, {
        amount: amt,
        description: description.trim(),
        merchant: merchant.trim() || undefined,
        category: category as Transaction["category"],
        subcategory: subcategory || undefined,
        transaction_date: date,
        account_id: isCard ? undefined : paymentId,
        credit_card_id: isCard ? paymentId : undefined,
      });
      showToast({ message: "Transaction updated." });
      onSaved();
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3.5 text-sm">
      <Input label="Amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="Merchant (optional)" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
      <div>
        <label className="text-xs font-medium text-muted mb-1.5 block">Category</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSubcategory("");
          }}
          className={selectClass}
        >
          {KNOWN_CATEGORIES.filter((c) => c !== "Transfer" && c !== "Credit Card Payment").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted mb-1.5 block">Subcategory</label>
        <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={selectClass}>
          <option value="">—</option>
          {(CATEGORY_SUBCATEGORIES[category as keyof typeof CATEGORY_SUBCATEGORIES] ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button onClick={save} loading={saving} className="flex-1">
          Save changes
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
