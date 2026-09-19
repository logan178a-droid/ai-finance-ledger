"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/StoreContext";
import { formatINR, cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { KNOWN_CATEGORIES } from "@/lib/ai/parseTransaction";
import { format, parseISO } from "date-fns";
import { Search, X, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Transaction, TransactionType } from "@/lib/types";

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "CC Payment",
  refund: "Refund",
};

const selectClass = "rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

export function TransactionsTable() {
  const { transactions, accounts, creditCards } = useStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? creditCards.find((c) => c.id === id)?.name ?? "—";

  const categoryOptions = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).sort(), [transactions]);
  const accountOptions = useMemo(
    () => [
      ...accounts.map((a) => ({ id: a.id, label: a.name })),
      ...creditCards.map((c) => ({ id: c.id, label: c.name })),
    ],
    [accounts, creditCards]
  );

  const hasFilters = typeFilter !== "all" || accountFilter !== "all" || categoryFilter !== "all" || !!fromDate || !!toDate || !!query.trim();

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setAccountFilter("all");
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
  }

  const filtered = useMemo(() => {
    return [...transactions]
      .sort((a, b) => parseISO(b.transaction_date).getTime() - parseISO(a.transaction_date).getTime())
      .filter((t) => {
        if (typeFilter !== "all" && t.transaction_type !== typeFilter) return false;
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (accountFilter !== "all" && t.account_id !== accountFilter && t.credit_card_id !== accountFilter && t.transfer_to_account_id !== accountFilter) {
          return false;
        }
        if (fromDate && t.transaction_date < fromDate) return false;
        if (toDate && t.transaction_date > toDate) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      });
  }, [transactions, query, typeFilter, categoryFilter, accountFilter, fromDate, toDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by merchant or category..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted mr-1">
            <SlidersHorizontal size={13} /> Filters:
          </span>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | "all")} className={selectClass}>
            <option value="all">All types</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={selectClass}>
            <option value="all">All accounts/cards</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
            <option value="all">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={cn(selectClass, "py-2")} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={cn(selectClass, "py-2")} />
          </label>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground px-2 py-1.5 rounded-lg transition-colors"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Merchant</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isCredit = t.transaction_type === "income" || t.transaction_type === "refund";
                const isNeutral = t.transaction_type === "transfer" || t.transaction_type === "credit_card_payment";
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-background transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{format(parseISO(t.transaction_date), "d MMM yyyy")}</td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={t.category} size={14} className="text-muted" />
                        {t.merchant}
                        {t.source === "ai" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">AI</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.category}</td>
                    <td className="px-4 py-3 text-muted">{accountName(t.account_id ?? t.credit_card_id)}</td>
                    <td className="px-4 py-3 text-muted">{TYPE_LABEL[t.transaction_type]}</td>
                    <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", isCredit ? "text-positive" : isNeutral ? "text-muted" : "text-foreground")}>
                      {isCredit ? "+" : isNeutral ? "" : "-"}
                      {formatINR(t.amount)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm">
                    {hasFilters ? (
                      <div className="flex flex-col items-center gap-2 text-muted">
                        <span>No transactions match these filters.</span>
                        <button onClick={clearFilters} className="text-xs font-medium text-accent hover:underline">
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted">No transactions yet — try telling the assistant what you spent, or add one manually from the Dashboard.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <TransactionDrawer
          transaction={selected}
          accountName={accountName(selected.account_id ?? selected.credit_card_id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// Transfers and credit-card payments are paired/linked entries (two legs
// sharing a transferId, or tied to a card's liability) — editing them
// generically here could desync that pairing, so editing is offered only
// for the straightforward single-entry types.
const EDITABLE_TYPES = new Set<TransactionType>(["expense", "income", "refund"]);

function TransactionDrawer({ transaction, accountName, onClose }: { transaction: Transaction; accountName: string; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { accounts, creditCards, updateTransaction, removeTransaction } = useStore();
  const router = useRouter();
  const { showToast } = useToast();

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
      onClose();
      router.refresh();
    } catch {
      setDeleteError("Couldn't delete that transaction. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const [amount, setAmount] = useState(String(transaction.amount));
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [category, setCategory] = useState<string>(transaction.category);
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
          merchant: merchant.trim() || null,
          categoryName: category,
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
        merchant: merchant.trim(),
        category: category as Transaction["category"],
        transaction_date: date,
        account_id: isCard ? undefined : paymentId,
        credit_card_id: isCard ? paymentId : undefined,
      });
      showToast({ message: "Transaction updated." });
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-sm h-full bg-surface p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{editing ? "Edit transaction" : "Transaction detail"}</h3>
          <div className="flex items-center gap-1">
            {!editing && EDITABLE_TYPES.has(transaction.transaction_type) && (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-md hover:bg-background text-muted hover:text-foreground"
                aria-label="Edit transaction"
              >
                <Pencil size={16} />
              </button>
            )}
            {!editing && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="p-1.5 rounded-md hover:bg-negative-soft text-muted hover:text-danger"
                aria-label="Delete transaction"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-background text-muted" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4 text-sm">
            <Input label="Amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <Input label="Paid to / Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Payment method</label>
              <select
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
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
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                {KNOWN_CATEGORIES.filter((c) => c !== "Transfer" && c !== "Credit Card Payment").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={save} loading={saving} className="flex-1">
                Save changes
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <Detail label="Amount" value={formatINR(transaction.amount)} />
            <Detail label="Merchant" value={transaction.merchant} />
            <Detail label="Category" value={transaction.category} />
            <Detail label="Account" value={accountName} />
            <Detail label="Type" value={TYPE_LABEL[transaction.transaction_type]} />
            <Detail label="Date" value={format(parseISO(transaction.transaction_date), "d MMM yyyy")} />
            <Detail label="Source" value={transaction.source === "ai" ? "AI Assistant" : transaction.source === "seed" ? "Demo seed data" : "Manual entry"} />
            {transaction.ai_confidence !== undefined && transaction.source === "ai" && (
              <Detail label="AI Confidence" value={`${Math.round(transaction.ai_confidence * 100)}%`} />
            )}
            {transaction.raw_text && (
              <div>
                <div className="text-xs text-muted mb-1.5">Original input</div>
                <div className="rounded-xl bg-background border border-border p-3 text-sm italic">&ldquo;{transaction.raw_text}&rdquo;</div>
              </div>
            )}
            {!EDITABLE_TYPES.has(transaction.transaction_type) && (
              <p className="text-xs text-muted pt-2 border-t border-border">
                {transaction.transaction_type === "transfer" ? "Transfers" : "Credit card payments"} can&rsquo;t be edited here since they&rsquo;re linked to another entry — delete and re-enter if needed.
              </p>
            )}
          </div>
        )}
      </div>
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
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
