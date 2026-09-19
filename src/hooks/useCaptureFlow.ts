"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/StoreContext";
import type { Account, CreditCard, NewAccountInfo, ParsedTransaction, Transaction } from "@/lib/types";
import { buildTransactionFromParsed } from "@/lib/ai/buildTransaction";
import { useVoiceRecorder, type VoiceRecorderError } from "@/hooks/useVoiceRecorder";
import { formatINR } from "@/lib/utils";

export type CaptureStage = "idle" | "input" | "recording" | "thinking" | "confirmation" | "saving" | "success" | "error";

/** Distinguishes error causes so the UI can show a specific message + specific recovery action for each, never one generic error. */
export type CaptureErrorKind =
  | "route" // text-path classification/parse failure
  | "save"
  | "voice-permission"
  | "voice-no-mic"
  | "voice-no-speech"
  | "voice-transcription"
  | "voice-not-configured"
  | null;

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface CaptureState {
  stage: CaptureStage;
  text: string;
  parsed: ParsedTransaction | null;
  errorMessage: string | null;
  errorKind: CaptureErrorKind;
  transcript: string | null;
  origin: "text" | "voice" | "share" | null;
  lastSavedId: string | null;
  duplicateWarning: boolean;
  newAccountNote: string | null;
  messages: ConversationMessage[];
}

/** The shape every branch of the merged intent pipeline (`/api/ai/assistant`, `/api/ai/voice`, `/share`) returns. */
export type AssistantApiResult =
  | {
      kind: "transaction";
      parsed: ParsedTransaction;
      needsClarification: boolean;
      accounts: Account[];
      creditCards: CreditCard[];
      /** Set when a shared SMS referenced an account/card we'd never seen before and it was auto-created on the fly. */
      newAccount?: NewAccountInfo;
    }
  | { kind: "answer"; message: string }
  | { kind: "clarify"; message: string };

type Action =
  | { type: "FOCUS" }
  | { type: "SET_TEXT"; text: string }
  | { type: "RECORDING_START" }
  | { type: "RECORDING_CANCEL" }
  | { type: "THINKING" }
  | { type: "PARSED"; parsed: ParsedTransaction; duplicateWarning: boolean; transcript?: string; origin: "text" | "voice" | "share"; newAccountNote?: string | null }
  | { type: "ANSWERED"; userText: string; message: string }
  | { type: "ROUTE_FAILED"; message: string; kind?: CaptureErrorKind }
  | { type: "VOICE_FAILED"; message: string; kind: CaptureErrorKind }
  | { type: "UPDATE_DRAFT"; parsed: ParsedTransaction }
  | { type: "SAVING" }
  | { type: "SAVED"; id: string; note: string }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "RESET" };

const initialState: CaptureState = {
  stage: "idle",
  text: "",
  parsed: null,
  errorMessage: null,
  errorKind: null,
  transcript: null,
  origin: null,
  lastSavedId: null,
  duplicateWarning: false,
  newAccountNote: null,
  messages: [],
};

let msgIdCounter = 0;
const nextMsgId = () => `m${++msgIdCounter}`;

function reducer(state: CaptureState, action: Action): CaptureState {
  switch (action.type) {
    case "FOCUS":
      return state.stage === "idle" ? { ...state, stage: "input" } : state;
    case "SET_TEXT":
      // Typing during the brief post-save "success" flash means the user is
      // already moving on to the next transaction — exit that transient
      // stage immediately so the pending auto-reset (see the hook's effect)
      // can't fire later and wipe out what they're typing.
      return { ...state, text: action.text, stage: state.stage === "success" ? "input" : state.stage };
    case "RECORDING_START":
      return { ...state, stage: "recording", errorMessage: null, errorKind: null };
    case "RECORDING_CANCEL":
      return { ...state, stage: "idle" };
    case "THINKING":
      return { ...state, stage: "thinking", errorMessage: null, errorKind: null };
    case "PARSED":
      return {
        ...state,
        stage: "confirmation",
        text: "",
        parsed: action.parsed,
        duplicateWarning: action.duplicateWarning,
        transcript: action.transcript ?? null,
        origin: action.origin,
        newAccountNote: action.newAccountNote ?? null,
      };
    case "ANSWERED":
      return {
        ...state,
        stage: "idle",
        text: "",
        messages: [
          ...state.messages,
          { id: nextMsgId(), role: "user", text: action.userText },
          { id: nextMsgId(), role: "assistant", text: action.message },
        ],
      };
    case "ROUTE_FAILED":
      return { ...state, stage: "error", errorMessage: action.message, errorKind: action.kind ?? "route" };
    case "VOICE_FAILED":
      return { ...state, stage: "error", errorMessage: action.message, errorKind: action.kind };
    case "UPDATE_DRAFT":
      return { ...state, parsed: action.parsed };
    case "SAVING":
      return { ...state, stage: "saving" };
    case "SAVED":
      return {
        ...initialState,
        stage: "success",
        lastSavedId: action.id,
        messages: [...state.messages, { id: nextMsgId(), role: "assistant", text: action.note }],
      };
    case "SAVE_FAILED":
      return { ...state, stage: "error", errorMessage: action.message, errorKind: "save" };
    case "RESET":
      return { ...initialState, messages: state.messages };
    default:
      return state;
  }
}

function isLikelyDuplicate(parsed: ParsedTransaction, existing: Transaction[]): boolean {
  if (!parsed.amount.value || !parsed.merchant.value) return false;
  const today = parsed.transaction_date.value ?? new Date().toISOString().slice(0, 10);
  return existing.some(
    (t) =>
      t.amount === parsed.amount.value &&
      t.merchant.toLowerCase() === parsed.merchant.value!.toLowerCase() &&
      t.transaction_date === today
  );
}

export interface UseCaptureFlowResult {
  stage: CaptureStage;
  text: string;
  parsed: ParsedTransaction | null;
  errorMessage: string | null;
  errorKind: CaptureErrorKind;
  transcript: string | null;
  duplicateWarning: boolean;
  newAccountNote: string | null;
  accounts: Account[];
  creditCards: CreditCard[];
  recordingLevel: number;
  messages: ConversationMessage[];
  focusInput: () => void;
  setText: (text: string) => void;
  submit: (overrideText?: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  updateDraft: (parsed: ParsedTransaction) => void;
  confirm: (final: ParsedTransaction) => Promise<{ transaction: Transaction; undo: () => void } | null>;
  cancel: () => void;
  retry: () => void;
  loadExternal: (result: AssistantApiResult, rawText: string) => void;
}

/**
 * Drives the SINGLE merged AI surface — one text/voice input that handles
 * both transaction logging and finance questions, per message, via one
 * shared server-side intent classifier (`classifyAndRespond`, called from
 * `/api/ai/assistant` for text and `/api/ai/voice` for voice — both funnel
 * through the exact same pipeline, only the input layer differs).
 *
 * Stage machine: idle -> input|recording -> thinking -> (confirmation ->
 * saving -> success) | (answered, folds back to idle with the Q&A appended
 * to `messages`) | error.
 *
 * Transaction persistence goes through the real backend (`POST
 * /api/transactions`, `/api/transfers`, or `/api/credit-card-payments`)
 * exactly as before the merge — nothing about the save path changed.
 */
export function useCaptureFlow(): UseCaptureFlowResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { accounts, creditCards, transactions, addTransaction, removeTransaction, addAccount, addCreditCard } = useStore();
  const router = useRouter();
  const submitToken = useRef(0);

  // The "success" stage is a brief, quiet confirmation flash (per the design
  // brief) — it must never be a dead end. Auto-return to "idle" shortly after
  // so the capture input reappears on its own, ready for the next sentence,
  // without requiring a page refresh. The persistent toast (shown by the
  // caller after `confirm()` resolves) carries the lasting "Saved" record.
  useEffect(() => {
    if (state.stage !== "success") return;
    const id = setTimeout(() => dispatch({ type: "RESET" }), 1400);
    return () => clearTimeout(id);
  }, [state.stage]);

  const focusInput = useCallback(() => dispatch({ type: "FOCUS" }), []);
  const setText = useCallback((text: string) => dispatch({ type: "SET_TEXT", text }), []);

  /** Shared handling of the {transaction|answer|clarify} response, regardless of whether it came from typed text or a voice transcript. */
  const handleResult = useCallback(
    (data: AssistantApiResult, userText: string, origin: "text" | "voice" | "share", transcript?: string) => {
      if (data.kind === "transaction") {
        if (!data.parsed.amount.value && data.parsed.missing_fields.includes("amount") && !data.needsClarification) {
          dispatch({
            type: "ROUTE_FAILED",
            message: "I couldn't find an amount in that. Try including a number, like ₹500.",
          });
          return;
        }

        let newAccountNote: string | null = null;
        if (data.newAccount) {
          // The server already created the real DB row (see `resolveTransactionText`)
          // — mirror it into the client store so the confirmation card's
          // account/card pickers show it immediately, without a page refresh.
          if (data.newAccount.kind === "card") {
            const card = data.creditCards.find((c) => c.id === data.newAccount!.id);
            if (card) addCreditCard(card);
          } else {
            const account = data.accounts.find((a) => a.id === data.newAccount!.id);
            if (account) addAccount(account);
          }
          newAccountNote = `New: ${data.newAccount.name} — added to your accounts`;
        }

        dispatch({
          type: "PARSED",
          parsed: data.parsed,
          duplicateWarning: isLikelyDuplicate(data.parsed, transactions),
          transcript,
          origin,
          newAccountNote,
        });
        return;
      }
      // "answer" and "clarify" are both conversational replies — the only
      // difference is clarify's message asks something back rather than
      // stating a fact. Both fold into the same message log, with the input
      // immediately available again (never a dead end).
      dispatch({ type: "ANSWERED", userText: transcript ?? userText, message: data.message });
    },
    [transactions, addAccount, addCreditCard]
  );

  const submit = useCallback(
    async (overrideText?: string) => {
      const value = (overrideText ?? state.text).trim();
      if (!value) return;
      const token = ++submitToken.current;
      dispatch({ type: "THINKING" });
      try {
        const res = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        });
        if (token !== submitToken.current) return;
        if (!res.ok) {
          dispatch({ type: "ROUTE_FAILED", message: "Something went wrong understanding that. You can try again or enter it manually." });
          return;
        }
        const data = (await res.json()) as AssistantApiResult;
        handleResult(data, value, "text");
      } catch {
        if (token !== submitToken.current) return;
        dispatch({ type: "ROUTE_FAILED", message: "Something went wrong understanding that. You can try again or enter it manually." });
      }
    },
    [state.text, handleResult]
  );

  const voiceRecorder = useVoiceRecorder();

  const startRecording = useCallback(async () => {
    const result = await voiceRecorder.start();
    if (!result.ok) {
      const messages: Record<VoiceRecorderError, string> = {
        "permission-denied": "Microphone access is blocked. Enable it in your browser's site settings, or type your transaction instead.",
        "no-mic": "No microphone was found on this device. Try typing instead.",
        unknown: "Couldn't access the microphone. Try typing instead.",
      };
      const kindMap: Record<VoiceRecorderError, CaptureErrorKind> = {
        "permission-denied": "voice-permission",
        "no-mic": "voice-no-mic",
        unknown: "voice-no-mic",
      };
      dispatch({ type: "VOICE_FAILED", message: messages[result.error], kind: kindMap[result.error] });
      return;
    }
    dispatch({ type: "RECORDING_START" });
  }, [voiceRecorder]);

  const cancelRecording = useCallback(() => {
    voiceRecorder.cancel();
    dispatch({ type: "RECORDING_CANCEL" });
  }, [voiceRecorder]);

  const stopRecording = useCallback(async () => {
    const blob = await voiceRecorder.stop();
    if (!blob || blob.size === 0) {
      dispatch({ type: "VOICE_FAILED", message: "Didn't catch that — try again.", kind: "voice-no-speech" });
      return;
    }
    const token = ++submitToken.current;
    dispatch({ type: "THINKING" });
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/ai/voice", { method: "POST", body: form });
      if (token !== submitToken.current) return;

      if (res.status === 503) {
        dispatch({ type: "VOICE_FAILED", message: "Voice capture isn't set up yet. Try typing instead.", kind: "voice-not-configured" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        dispatch({ type: "VOICE_FAILED", message: body.message ?? "Couldn't process that recording.", kind: "voice-transcription" });
        return;
      }

      const data = (await res.json()) as AssistantApiResult & { transcript: string };
      if (!data.transcript) {
        dispatch({ type: "VOICE_FAILED", message: "Didn't catch that — try again.", kind: "voice-no-speech" });
        return;
      }
      handleResult(data, data.transcript, "voice", data.transcript);
    } catch {
      if (token !== submitToken.current) return;
      dispatch({ type: "VOICE_FAILED", message: "Couldn't process that recording. Check your connection and try again.", kind: "voice-transcription" });
    }
  }, [voiceRecorder, handleResult]);

  const updateDraft = useCallback((parsed: ParsedTransaction) => dispatch({ type: "UPDATE_DRAFT", parsed }), []);

  const confirm = useCallback(
    async (final: ParsedTransaction) => {
      dispatch({ type: "SAVING" });
      try {
        const type = final.transaction_type.value ?? "expense";
        const transactionDate = final.transaction_date.value ?? new Date().toISOString().slice(0, 10);
        // Voice/text/share-originated saves are tagged distinctly so the
        // transaction's audit trail (source) is accurate, even though all
        // three flow through this identical confirm/save path.
        const source = state.origin === "voice" ? "ai_voice" : state.origin === "share" ? "ai_share" : "ai_text";

        let res: Response;
        if (type === "transfer") {
          res = await fetch("/api/transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: final.amount.value,
              transactionDate,
              fromAccountId: final.account_id.value,
              toAccountId: final.transfer_to_account_id.value,
              source,
            }),
          });
        } else if (type === "credit_card_payment") {
          res = await fetch("/api/credit-card-payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: final.amount.value,
              transactionDate,
              fromAccountId: final.account_id.value,
              creditCardId: final.credit_card_id.value,
              source,
            }),
          });
        } else {
          res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactionType: type,
              amount: final.amount.value,
              transactionDate,
              merchant: final.merchant.value ?? null,
              categoryName: final.category.value ?? null,
              accountId: final.account_id.value ?? null,
              creditCardId: final.credit_card_id.value ?? null,
              source,
              aiConfidence: final.overall_confidence,
            }),
          });
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          dispatch({ type: "SAVE_FAILED", message: body.error ?? "Couldn't save that transaction. Please try again." });
          return null;
        }

        // Optimistic local bump (the nested, real-data StoreProvider on the
        // Dashboard) + a server refresh so every tier reflects real DB state.
        const localTx = buildTransactionFromParsed(final);
        addTransaction(localTx);
        router.refresh();

        const verb = type === "income" ? "Logged income of" : type === "transfer" ? "Logged a transfer of" : "Logged an expense of";
        dispatch({ type: "SAVED", id: localTx.id, note: `${verb} ${formatINR(localTx.amount)} — ${localTx.merchant}` });
        const undo = () => {
          removeTransaction(localTx.id);
          fetch(`/api/transactions/${localTx.id}`, { method: "DELETE" }).catch(() => {});
          router.refresh();
        };
        return { transaction: localTx, undo };
      } catch {
        dispatch({ type: "SAVE_FAILED", message: "Couldn't save that transaction. Please try again." });
        return null;
      }
    },
    [addTransaction, removeTransaction, router, state.origin]
  );

  const cancel = useCallback(() => dispatch({ type: "RESET" }), []);
  const retry = useCallback(() => dispatch({ type: "RESET" }), []);

  /**
   * Injects an already-classified result from an external source (the
   * `/share` route already called the same `classifyAndRespond` pipeline
   * server-side, since a POST share-target request has to land on a real
   * page, not a client-side fetch) — reuses the exact same handling as
   * typed/spoken submissions, so the confirmation card, missing-info
   * follow-up, and error states are all identical, not a separate code path.
   */
  const loadExternal = useCallback(
    (result: AssistantApiResult, rawText: string) => {
      handleResult(result, rawText, "share");
    },
    [handleResult]
  );

  return {
    stage: state.stage,
    text: state.text,
    parsed: state.parsed,
    errorMessage: state.errorMessage,
    errorKind: state.errorKind,
    transcript: state.transcript,
    duplicateWarning: state.duplicateWarning,
    newAccountNote: state.newAccountNote,
    accounts,
    creditCards,
    recordingLevel: voiceRecorder.level,
    messages: state.messages,
    focusInput,
    setText,
    submit,
    startRecording,
    stopRecording,
    cancelRecording,
    updateDraft,
    confirm,
    cancel,
    retry,
    loadExternal,
  };
}
