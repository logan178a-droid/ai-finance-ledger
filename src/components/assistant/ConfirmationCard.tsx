"use client";

import { useState } from "react";
import { Check, Pencil, X, Landmark, CreditCard as CardIcon, AlertTriangle, Sparkles } from "lucide-react";
import type { Account, CreditCard, ParsedTransaction, Category, TransactionType } from "@/lib/types";
import { CATEGORY_SUBCATEGORIES } from "@/lib/types";
import { formatINR, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const CATEGORIES: Category[] = [
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Subscriptions",
  "Healthcare",
  "Other",
];

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "Credit Card Payment",
  refund: "Refund",
};

const LOW_CONFIDENCE = 0.8;

export function ConfirmationCard({
  parsed,
  accounts,
  creditCards,
  duplicateWarning = false,
  newAccountNote = null,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedTransaction;
  accounts: Account[];
  creditCards: CreditCard[];
  duplicateWarning?: boolean;
  /** Shown when a shared SMS referenced an account/card auto-created on the fly — the user always sees it happened, never silently. */
  newAccountNote?: string | null;
  onConfirm: (final: ParsedTransaction) => void;
  onCancel: () => void;
}) {
  // Re-seed local draft state whenever a *new* parse result arrives (render-phase
  // state adjustment, not an effect — avoids a redundant extra render).
  const [seededFrom, setSeededFrom] = useState(parsed);
  const [draft, setDraft] = useState<ParsedTransaction>(parsed);
  const [editingField, setEditingField] = useState<string | null>(null);
  if (parsed !== seededFrom) {
    setSeededFrom(parsed);
    setDraft(parsed);
  }

  const needsAccount =
    draft.transaction_type.value !== "transfer" &&
    !draft.account_id.value &&
    !draft.credit_card_id.value;
  const needsTransferAccounts =
    draft.transaction_type.value === "transfer" && (!draft.account_id.value || !draft.transfer_to_account_id.value);
  const needsCard = draft.transaction_type.value === "credit_card_payment" && !draft.credit_card_id.value;

  const canConfirm = !needsAccount && !needsTransferAccounts && !needsCard && !!draft.amount.value;

  function setField<K extends keyof ParsedTransaction>(key: K, value: unknown, confidence = 1) {
    setDraft((d) => {
      const prev = d[key];
      if (typeof prev === "object" && prev !== null && "confidence" in prev) {
        return { ...d, [key]: { ...prev, value, confidence } };
      }
      return d;
    });
  }

  // One missing-field follow-up question at a time.
  const followUp = getFollowUp(draft);

  return (
    <div
      className="border-t border-border pt-4 mt-1"
      onKeyDown={(e) => {
        if (e.key === "Enter" && canConfirm && !followUp) onConfirm(draft);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ai">
          <Check size={16} />
          I understood this as:
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-background text-muted" aria-label="Discard">
          <X size={14} />
        </button>
      </div>

      {newAccountNote && (
        <div className="flex items-start gap-2 rounded-xl bg-ai-soft text-ai px-3 py-2.5 text-xs mb-3">
          <Sparkles size={14} className="shrink-0 mt-0.5" />
          <span>{newAccountNote}</span>
        </div>
      )}

      {duplicateWarning && (
        <div className="flex items-start gap-2 rounded-xl bg-warning-soft text-warning px-3 py-2.5 text-xs mb-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>This looks similar to a transaction you already logged today — same amount and merchant. Confirm anyway if it&apos;s a separate charge.</span>
        </div>
      )}

      <div
        className="rounded-xl bg-background border border-border p-4 space-y-3"
        aria-label={describeAsSentence(draft, accounts, creditCards)}
      >
        <div className="flex items-baseline justify-between gap-2">
          <EditableAmount value={draft.amount.value} onChange={(v) => setField("amount", v)} />
          <span className="text-[11px] px-2 py-1 rounded-full bg-ai-soft text-ai font-medium shrink-0">
            {TYPE_LABEL[draft.transaction_type.value ?? "expense"]}
          </span>
        </div>

        <EditableRow
          label="Description"
          value={draft.description.value ?? "Unknown"}
          confidence={draft.description.confidence}
          editing={editingField === "description"}
          onEdit={() => setEditingField("description")}
          onBlur={() => setEditingField(null)}
        >
          <input
            autoFocus
            value={draft.description.value ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            onBlur={() => setEditingField(null)}
            className="text-sm bg-transparent border-b border-ai outline-none text-right"
          />
        </EditableRow>

        <EditableRow
          label="Merchant"
          value={draft.merchant.value || "—"}
          confidence={draft.merchant.value ? draft.merchant.confidence : undefined}
          editing={editingField === "merchant"}
          onEdit={() => setEditingField("merchant")}
          onBlur={() => setEditingField(null)}
        >
          <input
            autoFocus
            value={draft.merchant.value ?? ""}
            placeholder="Optional"
            onChange={(e) => setField("merchant", e.target.value || undefined)}
            onBlur={() => setEditingField(null)}
            className="text-sm bg-transparent border-b border-ai outline-none text-right"
          />
        </EditableRow>

        <EditableRow
          label="Category"
          value={draft.category.value ?? "Uncategorized"}
          confidence={draft.category.confidence}
          editing={editingField === "category"}
          onEdit={() => setEditingField("category")}
          onBlur={() => setEditingField(null)}
        >
          <select
            autoFocus
            value={draft.category.value ?? ""}
            onChange={(e) => {
              setField("category", e.target.value as Category);
              setField("subcategory", undefined);
              setEditingField(null);
            }}
            onBlur={() => setEditingField(null)}
            className="text-sm bg-transparent border-b border-ai outline-none text-right"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </EditableRow>

        {draft.category.value && (
          <EditableRow
            label="Subcategory"
            value={draft.subcategory.value || "—"}
            confidence={draft.subcategory.value ? draft.subcategory.confidence : undefined}
            editing={editingField === "subcategory"}
            onEdit={() => setEditingField("subcategory")}
            onBlur={() => setEditingField(null)}
          >
            <select
              autoFocus
              value={draft.subcategory.value ?? ""}
              onChange={(e) => {
                setField("subcategory", e.target.value || undefined);
                setEditingField(null);
              }}
              onBlur={() => setEditingField(null)}
              className="text-sm bg-transparent border-b border-ai outline-none text-right"
            >
              <option value="">—</option>
              {(CATEGORY_SUBCATEGORIES[draft.category.value] ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </EditableRow>
        )}

        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <MetaChip>{draft.transaction_date.value}</MetaChip>
          <MetaChip>{TYPE_LABEL[draft.transaction_type.value ?? "expense"]}</MetaChip>
        </div>

        {!followUp && draft.transaction_type.value === "transfer" ? (
          <>
            <AccountPicker label="From" accounts={accounts} selected={draft.account_id.value} onSelect={(id) => setField("account_id", id)} />
            <AccountPicker label="To" accounts={accounts} selected={draft.transfer_to_account_id.value} onSelect={(id) => setField("transfer_to_account_id", id)} />
          </>
        ) : !followUp && draft.transaction_type.value === "credit_card_payment" ? (
          <>
            <CardPicker label="Card being paid" cards={creditCards} selected={draft.credit_card_id.value} onSelect={(id) => setField("credit_card_id", id)} />
            <AccountPicker label="Paying from" accounts={accounts.filter((a) => a.type !== "investment")} selected={draft.account_id.value} onSelect={(id) => setField("account_id", id)} />
          </>
        ) : !followUp ? (
          <EditableRow
            label="Account"
            value={
              accounts.find((a) => a.id === draft.account_id.value)?.name ??
              creditCards.find((c) => c.id === draft.credit_card_id.value)?.name ??
              "Not set"
            }
            confidence={draft.account_id.value ? draft.account_id.confidence : draft.credit_card_id.confidence}
            editing={editingField === "account"}
            onEdit={() => setEditingField("account")}
            onBlur={() => setEditingField(null)}
          >
            <PaymentMethodPicker
              accounts={accounts}
              cards={creditCards}
              selectedAccount={draft.account_id.value}
              selectedCard={draft.credit_card_id.value}
              onSelectAccount={(id) => {
                setField("account_id", id);
                setField("credit_card_id", undefined);
                setEditingField(null);
              }}
              onSelectCard={(id) => {
                setField("credit_card_id", id);
                setField("account_id", undefined);
                setEditingField(null);
              }}
            />
          </EditableRow>
        ) : null}
      </div>

      {followUp && (
        <FollowUpQuestion
          followUp={followUp}
          accounts={accounts}
          creditCards={creditCards}
          onAnswer={(key, value) => setField(key, value, 1)}
        />
      )}

      <div className="flex gap-2 mt-4">
        <Button onClick={() => canConfirm && onConfirm(draft)} disabled={!canConfirm} size="lg" className="flex-1">
          Confirm
        </Button>
        <Button onClick={onCancel} variant="secondary" size="lg">
          Discard
        </Button>
      </div>
    </div>
  );
}

function describeAsSentence(draft: ParsedTransaction, accounts: Account[], creditCards: CreditCard[]): string {
  const amount = draft.amount.value ? formatINR(draft.amount.value) : "an unknown amount";
  const type = TYPE_LABEL[draft.transaction_type.value ?? "expense"].toLowerCase();
  const description = draft.description.value ?? "an unknown transaction";
  const via =
    accounts.find((a) => a.id === draft.account_id.value)?.name ??
    creditCards.find((c) => c.id === draft.credit_card_id.value)?.name ??
    "an unspecified account";
  return `${amount} ${type}, ${description}, on ${draft.transaction_date.value}, via ${via}, category ${draft.category.value ?? "uncategorized"}.`;
}

function EditableAmount({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        className="money text-2xl font-semibold bg-transparent border-b border-ai outline-none w-36"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="money text-2xl font-semibold text-left hover:text-ai transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40"
    >
      {value ? formatINR(value) : "Tap to set amount"}
    </button>
  );
}

function EditableRow({
  label,
  value,
  confidence,
  editing,
  onEdit,
  onBlur,
  children,
}: {
  label: string;
  value: string;
  confidence?: number;
  editing: boolean;
  onEdit: () => void;
  onBlur: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-[28px]" onBlurCapture={onBlur}>
      <span className="text-xs text-muted">{label}</span>
      {editing ? (
        children
      ) : (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-sm font-medium hover:text-ai transition-colors group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40"
        >
          {value}
          {confidence !== undefined && confidence < LOW_CONFIDENCE && confidence > 0 && <Badge variant="confidence" />}
          <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden />
        </button>
      )}
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] px-2 py-1 rounded-full border border-border text-muted">{children}</span>;
}

interface FollowUp {
  key: "account_id" | "credit_card_id" | "transfer_to_account_id" | "merchant" | "category";
  question: string;
  guess?: { id: string; label: string };
}

function getFollowUp(draft: ParsedTransaction): FollowUp | null {
  if (draft.transaction_type.value === "transfer") {
    if (!draft.account_id.value) return { key: "account_id", question: "Which account is this transfer from?" };
    if (!draft.transfer_to_account_id.value) return { key: "transfer_to_account_id", question: "Which account is it going to?" };
    return null;
  }
  if (draft.transaction_type.value === "credit_card_payment") {
    if (!draft.credit_card_id.value) return { key: "credit_card_id", question: "Which card is this paying off?" };
    if (!draft.account_id.value) return { key: "account_id", question: "Which account is paying it?" };
    return null;
  }
  if (!draft.account_id.value && !draft.credit_card_id.value) {
    return { key: "account_id", question: "Which account or card was this on?" };
  }
  return null;
}

function FollowUpQuestion({
  followUp,
  accounts,
  creditCards,
  onAnswer,
}: {
  followUp: FollowUp;
  accounts: Account[];
  creditCards: CreditCard[];
  onAnswer: (key: FollowUp["key"], value: string) => void;
}) {
  const isCardField = followUp.key === "credit_card_id";
  return (
    <div className="mt-3 rounded-xl border border-ai/30 bg-ai-soft p-3.5 animate-soft-rise">
      <p className="text-sm font-medium mb-2.5">{followUp.question}</p>
      <div className="flex flex-wrap gap-2">
        {isCardField
          ? creditCards.map((c) => (
              <PickChip key={c.id} icon={<CardIcon size={12} />} label={c.name} onClick={() => onAnswer(followUp.key, c.id)} />
            ))
          : accounts
              .filter((a) => (followUp.key === "account_id" ? a.type !== "investment" : true))
              .map((a) => <PickChip key={a.id} icon={<Landmark size={12} />} label={a.name} onClick={() => onAnswer(followUp.key, a.id)} />)}
      </div>
    </div>
  );
}

function PaymentMethodPicker({
  accounts,
  cards,
  selectedAccount,
  selectedCard,
  onSelectAccount,
  onSelectCard,
}: {
  accounts: Account[];
  cards: CreditCard[];
  selectedAccount?: string;
  selectedCard?: string;
  onSelectAccount: (id: string) => void;
  onSelectCard: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {accounts
        .filter((a) => a.type !== "investment")
        .map((a) => (
          <PickChip key={a.id} icon={<Landmark size={12} />} label={a.name} active={selectedAccount === a.id} onClick={() => onSelectAccount(a.id)} />
        ))}
      {cards.map((c) => (
        <PickChip key={c.id} icon={<CardIcon size={12} />} label={c.name} active={selectedCard === c.id} onClick={() => onSelectCard(c.id)} />
      ))}
    </div>
  );
}

function AccountPicker({ label, accounts, selected, onSelect }: { label: string; accounts: Account[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {accounts.map((a) => (
          <PickChip key={a.id} icon={<Landmark size={12} />} label={a.name} active={selected === a.id} onClick={() => onSelect(a.id)} />
        ))}
      </div>
    </div>
  );
}

function CardPicker({ label, cards, selected, onSelect }: { label: string; cards: CreditCard[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {cards.map((c) => (
          <PickChip key={c.id} icon={<CardIcon size={12} />} label={c.name} active={selected === c.id} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  );
}

function PickChip({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40",
        active ? "bg-ai text-ai-foreground border-ai" : "border-border text-muted hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
