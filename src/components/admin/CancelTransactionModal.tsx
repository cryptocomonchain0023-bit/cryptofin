"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";

export interface AdminTransactionProfile {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface AdminTransactionItem {
  id: string;
  user_id: string;
  type: string;
  amount: number | string;
  currency: string;
  status: string;
  created_at: string;
  to_address?: string | null;
  from_address?: string | null;
  tx_hash?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  profiles?: AdminTransactionProfile | null;
}

interface CancelTransactionModalProps {
  transaction: AdminTransactionItem | null;
  kind: "deposit" | "withdrawal";
  token: string;
  network: string;
  displayName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelTransactionModal({
  transaction,
  kind,
  token,
  network,
  displayName,
  isSubmitting,
  onClose,
  onConfirm,
}: CancelTransactionModalProps) {
  useEffect(() => {
    if (!transaction) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transaction, isSubmitting, onClose]);

  if (!transaction) return null;

  const rawAmount = Number(transaction.amount || 0);
  const absAmount = Math.abs(rawAmount);
  const formattedAmount = absAmount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
  const status = String(transaction.status || "pending").toLowerCase();

  let impactTitle = "No Wallet Balance Change";
  let impactMessage = "";
  let impactTone: "deduct" | "refund" | "neutral" = "neutral";

  if (kind === "deposit") {
    if (status === "completed" || status === "approved" || status === "success") {
      impactTone = "deduct";
      impactTitle = "Balance Deduction & History Wipe";
      impactMessage = `${formattedAmount} ${token} will be deducted back from this user's wallet balance, and the deposit record will be permanently wiped.`;
    } else {
      impactTone = "neutral";
      impactTitle = "History Wipe Only";
      impactMessage = `This deposit was never credited to the wallet. Confirming will permanently remove it from transaction history.`;
    }
  } else {
    if (
      rawAmount < 0 &&
      status !== "failed" &&
      status !== "rejected" &&
      status !== "cancelled"
    ) {
      impactTone = "refund";
      impactTitle = "Balance Restore & History Wipe";
      impactMessage = `${formattedAmount} ${token} will be restored back into this user's wallet balance, and the withdrawal record will be permanently wiped.`;
    } else {
      impactTone = "neutral";
      impactTitle = "History Wipe Only";
      impactMessage = `This withdrawal's balance was already reversed or not debited. Confirming will permanently remove it from transaction history.`;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-tx-modal-title"
      >
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} />
            </div>
            <div>
              <h4
                id="cancel-tx-modal-title"
                className="text-sm font-bold text-gray-900"
              >
                Cancel &amp; Wipe {kind === "deposit" ? "Deposit" : "Withdrawal"}
              </h4>
              <p className="text-[11px] text-gray-500 font-medium">
                Clears record as if it never happened
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/60 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Are you sure you want to cancel this {kind}? This action cannot be undone.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-medium">User</span>
              <span className="text-gray-900 font-bold text-right truncate">
                {displayName}
                {transaction.profiles?.email ? ` (${transaction.profiles.email})` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-medium">Amount &amp; Asset</span>
              <span className="text-gray-900 font-bold text-right">
                {formattedAmount} {token} · {network}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-medium">Current Status</span>
              <span className="uppercase font-bold text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
                {transaction.status || "pending"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-medium">Date</span>
              <span className="text-gray-700 font-medium text-right">
                {new Date(transaction.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div
            className={`rounded-lg border p-3.5 text-xs ${
              impactTone === "deduct"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : impactTone === "refund"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <RotateCcw size={13} />
              <span>{impactTitle}</span>
            </div>
            <p className="leading-relaxed opacity-90">{impactMessage}</p>
          </div>

          <p className="text-[11px] text-gray-400 font-medium">
            Silent wipe — no email notification will be sent to the user.
          </p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-gray-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Keep Transaction
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Wiping...
              </>
            ) : (
              "Confirm Cancel & Wipe"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
