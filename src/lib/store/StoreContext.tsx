"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";
import type { Account, CreditCard, Transaction } from "@/lib/types";

export interface State {
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
}

type Action =
  | { type: "ADD_TRANSACTION"; transaction: Transaction }
  | { type: "REMOVE_TRANSACTION"; id: string }
  | { type: "UPDATE_TRANSACTION"; id: string; patch: Partial<Transaction> }
  | { type: "ADD_ACCOUNT"; account: Account }
  | { type: "REMOVE_ACCOUNT"; id: string }
  | { type: "ADD_CREDIT_CARD"; card: CreditCard }
  | { type: "REMOVE_CREDIT_CARD"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TRANSACTION":
      return { ...state, transactions: [action.transaction, ...state.transactions] };
    case "REMOVE_TRANSACTION":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case "UPDATE_TRANSACTION":
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case "ADD_ACCOUNT":
      return state.accounts.some((a) => a.id === action.account.id) ? state : { ...state, accounts: [...state.accounts, action.account] };
    case "REMOVE_ACCOUNT":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) };
    case "ADD_CREDIT_CARD":
      return state.creditCards.some((c) => c.id === action.card.id) ? state : { ...state, creditCards: [...state.creditCards, action.card] };
    case "REMOVE_CREDIT_CARD":
      return { ...state, creditCards: state.creditCards.filter((c) => c.id !== action.id) };
    default:
      return state;
  }
}

interface StoreContextValue extends State {
  addTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  addAccount: (a: Account) => void;
  removeAccount: (id: string) => void;
  addCreditCard: (c: CreditCard) => void;
  removeCreditCard: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

/**
 * `initialData` is REQUIRED and must be real, server-fetched data for the
 * signed-in user (see `DashboardStoreScope`, nested around each page's
 * content). There is deliberately no demo/fallback seed here — a finance
 * app must never silently show fake numbers if a page forgets to provide
 * real data; `useStore()` throws instead, so that mistake fails loudly in
 * development rather than quietly showing a real user someone else's
 * (fake) balances.
 */
export function StoreProvider({ children, initialData }: { children: React.ReactNode; initialData: State }) {
  const [state, dispatch] = useReducer(reducer, initialData);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      addTransaction: (t: Transaction) => dispatch({ type: "ADD_TRANSACTION", transaction: t }),
      removeTransaction: (id: string) => dispatch({ type: "REMOVE_TRANSACTION", id }),
      updateTransaction: (id: string, patch: Partial<Transaction>) => dispatch({ type: "UPDATE_TRANSACTION", id, patch }),
      addAccount: (a: Account) => dispatch({ type: "ADD_ACCOUNT", account: a }),
      removeAccount: (id: string) => dispatch({ type: "REMOVE_ACCOUNT", id }),
      addCreditCard: (c: CreditCard) => dispatch({ type: "ADD_CREDIT_CARD", card: c }),
      removeCreditCard: (id: string) => dispatch({ type: "REMOVE_CREDIT_CARD", id }),
    }),
    [state]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
