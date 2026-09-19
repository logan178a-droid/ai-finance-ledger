"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank Account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
] as const;

export function AddAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]["value"]>("bank");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType("bank");
    setName("");
    setInstitution("");
    setOpeningBalance("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this account a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          institution: institution.trim() || null,
          openingBalance: openingBalance ? Number(openingBalance) : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that account.");
        return;
      }
      showToast({ message: `${name.trim()} added.` });
      reset();
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't add that account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add account">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Account type</label>
          <div className="flex gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setType(t.value)}
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

        <Input
          label="Account name"
          placeholder={type === "bank" ? "e.g. HDFC Savings" : type === "cash" ? "e.g. Cash Wallet" : "e.g. Mutual Funds"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {type !== "cash" && (
          <Input
            label="Institution (optional)"
            placeholder={type === "bank" ? "e.g. HDFC Bank" : "e.g. Zerodha"}
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        )}

        <Input
          label="Opening balance"
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          helperText="Your account's balance today — future transactions adjust it from here."
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" loading={submitting} className="w-full">
          Add account
        </Button>
      </form>
    </Drawer>
  );
}
