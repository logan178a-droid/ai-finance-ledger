"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/StoreContext";
import { getAccountBalance, getCreditCardStatus, getRecentTransactions } from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { format, parseISO } from "date-fns";
import { Landmark, Wallet, TrendingUp, CreditCard as CardIcon, Plus, Trash2 } from "lucide-react";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { AddAccountDrawer } from "./AddAccountDrawer";
import { AddCreditCardDrawer } from "./AddCreditCardDrawer";

type DeleteTarget = { kind: "account" | "card"; id: string; name: string } | null;

export function AccountsView() {
  const { accounts, creditCards, transactions, removeAccount, removeCreditCard } = useStore();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const banks = accounts.filter((a) => a.type === "bank");
  const cash = accounts.filter((a) => a.type === "cash");
  const investments = accounts.filter((a) => a.type === "investment");
  const isEmpty = accounts.length === 0 && creditCards.length === 0;

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
      if (deleteTarget.kind === "account") removeAccount(deleteTarget.id);
      else removeCreditCard(deleteTarget.id);
      showToast({ message: `${deleteTarget.name} removed.` });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Couldn't delete that. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted mt-1">All balances are computed live from your transaction history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAddAccountOpen(true)}>
            <Plus size={14} /> Add account
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAddCardOpen(true)}>
            <Plus size={14} /> Add credit card
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium mb-1">No accounts yet</p>
          <p className="text-sm text-muted mb-4">
            Add your first bank account, cash wallet, or credit card to start tracking real transactions.
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => setAddAccountOpen(true)}>
              <Plus size={14} /> Add account
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAddCardOpen(true)}>
              <Plus size={14} /> Add credit card
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {banks.length > 0 && (
            <Group title="Bank Accounts" icon={<Landmark size={16} />}>
              {banks.map((a) => (
                <AccountCard key={a.id} account={a} transactions={transactions} onDelete={() => setDeleteTarget({ kind: "account", id: a.id, name: a.name })} />
              ))}
            </Group>
          )}

          {creditCards.length > 0 && (
            <Group title="Credit Cards" icon={<CardIcon size={16} />}>
              {creditCards.map((c) => (
                <CreditCardMiniCard key={c.id} card={c} transactions={transactions} onDelete={() => setDeleteTarget({ kind: "card", id: c.id, name: c.name })} />
              ))}
            </Group>
          )}

          {cash.length > 0 && (
            <Group title="Cash" icon={<Wallet size={16} />}>
              {cash.map((a) => (
                <AccountCard key={a.id} account={a} transactions={transactions} onDelete={() => setDeleteTarget({ kind: "account", id: a.id, name: a.name })} />
              ))}
            </Group>
          )}

          {investments.length > 0 && (
            <Group title="Investments" icon={<TrendingUp size={16} />}>
              {investments.map((a) => (
                <AccountCard key={a.id} account={a} transactions={transactions} onDelete={() => setDeleteTarget({ kind: "account", id: a.id, name: a.name })} />
              ))}
            </Group>
          )}
        </>
      )}

      <AddAccountDrawer open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      <AddCreditCardDrawer open={addCardOpen} onClose={() => setAddCardOpen(false)} />

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        title={`Remove ${deleteTarget?.name ?? ""}?`}
        description="This can't be undone. If it still has transactions on it, you'll need to delete or edit those first."
      >
        {deleteError && <p className="text-xs text-danger mb-3">{deleteError}</p>}
        <div className="flex gap-2">
          <Button variant="destructive" onClick={confirmDelete} loading={deleting} className="flex-1">
            Remove
          </Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted">
        {icon}
        {title}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function AccountCard({
  account,
  transactions,
  onDelete,
}: {
  account: Account;
  transactions: ReturnType<typeof useStore>["transactions"];
  onDelete: () => void;
}) {
  const balance = getAccountBalance(account, transactions);
  const recent = getRecentTransactions(
    transactions.filter((t) => t.account_id === account.id || t.transfer_to_account_id === account.id),
    3
  );

  return (
    <Card className="p-5 group relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        aria-label={`Remove ${account.name}`}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-negative-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
      <div className="flex items-start justify-between mb-4 pr-8">
        <div>
          <div className="text-sm font-medium">{account.name}</div>
          <div className="text-xs text-muted">{account.bank} {account.accountNumberMasked ?? ""}</div>
        </div>
        <div className="text-lg font-semibold">{formatINR(balance)}</div>
      </div>
      {recent.length > 0 && (
        <ul className="space-y-1.5 border-t border-border pt-3">
          {recent.map((t: Transaction) => (
            <li key={t.id} className="flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <CategoryIcon category={t.category} size={12} />
                {t.description}
              </span>
              <span>{format(parseISO(t.transaction_date), "d MMM")}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CreditCardMiniCard({
  card,
  transactions,
  onDelete,
}: {
  card: CreditCard;
  transactions: ReturnType<typeof useStore>["transactions"];
  onDelete: () => void;
}) {
  const status = getCreditCardStatus(card, transactions);
  return (
    <Card className="p-5 hover:border-accent/40 transition-colors group relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Remove ${card.name}`}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-negative-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-10"
      >
        <Trash2 size={14} />
      </button>
      <Link href={`/credit-cards/${card.id}`} className="block">
        <div className="flex items-start justify-between mb-3 pr-8">
          <div>
            <div className="text-sm font-medium">{card.name}</div>
            <div className="text-xs text-muted">{card.bank}</div>
          </div>
          <div className="text-lg font-semibold text-danger">{formatINR(status.currentOutstanding)}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Available: {formatINR(status.availableCredit)}</span>
          <span>Due {format(parseISO(status.dueDate), "d MMM")}</span>
        </div>
      </Link>
    </Card>
  );
}
