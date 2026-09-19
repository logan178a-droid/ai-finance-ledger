"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How does AI transaction entry work?",
    answer:
      "Type or speak a sentence like \"Spent 500 at Reliance for groceries using HDFC card.\" The AI reads it and figures out the amount, merchant, category, account/card, and date, then shows you a confirmation card before anything is saved — nothing is recorded until you confirm. If it's missing something (like which account you paid from), it asks you a quick, specific question instead of showing a form.",
  },
  {
    question: "What's the difference between AI and manual entry?",
    answer:
      "Both end up in exactly the same place — the same database, the same ledger math, the same transaction history. AI entry (text or voice) is faster for everyday logging and can also answer questions about your spending. Manual entry (the \"Enter manually\" form) is a straightforward field-by-field form for when you'd rather not phrase a sentence, or when you're double-checking every field.",
  },
  {
    question: "Can I ask questions instead of logging a transaction?",
    answer:
      "Yes — the same AI box handles both. Ask things like \"How much did I spend on groceries this month?\" or \"What do I owe on my credit cards?\" and you'll get an answer computed from your real transaction history, not a guess. The app automatically figures out whether you're logging something or asking something.",
  },
  {
    question: "Can I fix a mistake after saving a transaction?",
    answer:
      "Yes. Open any transaction from the Transactions page and use the edit icon to correct the amount, merchant, category, date, or payment method. Every change is recorded in an audit trail. You can also delete a transaction entirely; deleting one leg of a transfer automatically removes its paired leg too, so your balances never end up inconsistent.",
  },
  {
    question: "How are my account and credit card balances calculated?",
    answer:
      "Balances are never stored as a single editable number — they're always recalculated from your opening balance plus every transaction on that account or card. This means editing or deleting a past transaction automatically and correctly updates every balance, statement, and net worth figure that depends on it.",
  },
  {
    question: "Why do I only enter a name for credit cards, not real card numbers?",
    answer:
      "This app doesn't collect real card numbers, limits, or statement dates — just a name you choose so you can track spending against it. A generic limit and billing cycle are used behind the scenes purely so the outstanding-balance math has something to work with.",
  },
  {
    question: "How is my data secured?",
    answer:
      "Every request is scoped to your signed-in account — no page or API route trusts a client-supplied user ID. Passwords are hashed, never stored in plain text. The AI service only ever proposes data for you to confirm; it never has direct write access to the database, and it can only answer questions using real queries against your own data, never invented numbers.",
  },
  {
    question: "What language does the AI support?",
    answer: "English, for both typed and spoken input right now. The assistant always responds in English as well.",
  },
];

export function FaqTab() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Card className="p-2 sm:p-3">
      <ul>
        {FAQS.map((item, i) => {
          const open = openIndex === i;
          return (
            <li key={item.question} className="border-b border-border last:border-0">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-3 py-3.5 text-left"
              >
                <span className="text-sm font-medium">{item.question}</span>
                <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
              </button>
              {open && <p className="px-3 pb-4 text-sm text-muted leading-relaxed">{item.answer}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
