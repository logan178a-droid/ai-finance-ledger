"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/StoreContext";
import { buildSnapshot, getAccountLedgerRows, getCreditCardLedgerRows } from "@/lib/ledger/selectors";
import { groupByMonthAndDay } from "@/lib/ledger/activity";
import { formatINR, cn } from "@/lib/utils";
import { ActivityRow } from "@/components/transactions/ActivityRow";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import type { Transaction, TransactionType } from "@/lib/types";

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "CC Payment",
  refund: "Refund",
};

const selectClass = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

/**
 * The default, human-friendly "what happened to my money" feed — the
 * Activity view. Minimal by default (Description + Amount, Category ·
 * Account as a secondary line), grouped by month/day with collapsible
 * month summaries, tap-to-expand rows for full contextual detail, compact
 * filters in a drawer rather than a row of dropdowns eating screen space,
 * and an optional Detailed mode that surfaces the running balance per row.
 * This never replaces the underlying ledger — every field the accounting
 * model tracks is still there, just behind progressive disclosure.
 */
export function ActivityView() {
  const { transactions, accounts, creditCards } = useStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const categoryOptions = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).sort(), [transactions]);
  const accountOptions = useMemo(
    () => [...accounts.map((a) => ({ id: a.id, label: a.name })), ...creditCards.map((c) => ({ id: c.id, label: c.name }))],
    [accounts, creditCards]
  );

  const hasFilters = typeFilter !== "all" || accountFilter !== "all" || categoryFilter !== "all" || !!fromDate || !!toDate;
  const activeFilterCount = [typeFilter !== "all", accountFilter !== "all", categoryFilter !== "all", !!fromDate, !!toDate].filter(Boolean).length;

  function clearFilters() {
    setTypeFilter("all");
    setAccountFilter("all");
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
  }

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.transaction_type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (accountFilter !== "all" && t.account_id !== accountFilter && t.credit_card_id !== accountFilter && t.transfer_to_account_id !== accountFilter) {
        return false;
      }
      if (fromDate && t.transaction_date < fromDate) return false;
      if (toDate && t.transaction_date > toDate) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return t.description.toLowerCase().includes(q) || (t.merchant ?? "").toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [transactions, query, typeFilter, categoryFilter, accountFilter, fromDate, toDate]);

  const months = useMemo(() => groupByMonthAndDay(filtered), [filtered]);

  // Balance-after is only computed when the user actually asks to see it
  // (off by default per the spec) — it requires walking each affected
  // account/card's full history, so there's no reason to pay for it
  // otherwise. Even in this mixed, multi-account global list, a row's
  // balance always means the balance of the specific account/card THAT ROW
  // affected, immediately after it — never a blended global number.
  const balanceById = useMemo(() => {
    if (!detailed) return new Map<string, number>();
    const snap = buildSnapshot(accounts, creditCards, transactions);
    const map = new Map<string, number>();
    for (const a of accounts) {
      for (const row of getAccountLedgerRows(snap, a.id)) map.set(row.transaction.id, row.balanceAfter);
    }
    for (const c of creditCards) {
      for (const row of getCreditCardLedgerRows(snap, c.id)) map.set(row.transaction.id, row.balanceAfter);
    }
    return map;
  }, [detailed, accounts, creditCards, transactions]);

  function toggleMonth(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, merchant, category..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors shrink-0",
              hasFilters ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            <SlidersHorizontal size={14} /> Filters
            {activeFilterCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setDetailed((d) => !d)}
            className={cn(
              "text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors shrink-0",
              detailed ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            {detailed ? "Detailed" : "Simple"}
          </button>
        </div>
      </div>

      {months.length === 0 ? (
        <Card className="p-10 text-center text-sm">
          {hasFilters || query ? (
            <div className="flex flex-col items-center gap-2 text-muted">
              <span>No transactions match these filters.</span>
              <button
                onClick={() => {
                  clearFilters();
                  setQuery("");
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <span className="text-muted">No transactions yet — try telling the assistant what you spent, or add one manually from the Dashboard.</span>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {months.map((month) => {
            const collapsed = collapsedMonths.has(month.monthKey);
            return (
              <Card key={month.monthKey} className="overflow-hidden p-0">
                <button
                  onClick={() => toggleMonth(month.monthKey)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-background/60 hover:bg-background transition-colors text-left"
                >
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted">
                    {month.label} — {month.count} transaction{month.count === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-medium text-muted hidden sm:inline">
                      Expenses {formatINR(month.expenses)} · Income {formatINR(month.income)}
                    </span>
                    <ChevronDown size={16} className={cn("text-muted transition-transform", collapsed && "-rotate-90")} />
                  </span>
                </button>

                {!collapsed && (
                  <div>
                    {month.days.map((day) => (
                      <div key={day.dateKey}>
                        <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
                          <span className="text-xs font-medium text-muted">{day.label}</span>
                          <span className="text-[11px] text-muted sm:hidden">
                            {day.expenses > 0 && `-${formatINR(day.expenses)}`}
                            {day.expenses > 0 && day.income > 0 && " · "}
                            {day.income > 0 && `+${formatINR(day.income)}`}
                          </span>
                        </div>
                        <div className="px-1">
                          {day.transactions.map((t: Transaction) => (
                            <ActivityRow key={t.id} transaction={t} balanceAfter={balanceById.get(t.id)} showBalance={detailed} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter transactions">
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | "all")} className={selectClass}>
              <option value="all">All types</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">Account</label>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={selectClass}>
              <option value="all">All accounts/cards</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={selectClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={selectClass} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => setFiltersOpen(false)} className="flex-1">
              Show results
            </Button>
            {hasFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                <X size={13} /> Clear
              </Button>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
