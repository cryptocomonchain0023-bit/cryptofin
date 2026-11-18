"use client";

import React, { useState } from "react";
import { X, Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  LINK_WALLET_REASONS,
  validatePublicWalletAddress,
} from "@/lib/linked-wallets";

interface ConnectWalletModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectWalletModal({ onClose, onSuccess }: ConnectWalletModalProps) {
  const [reason, setReason] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please select a reason for connecting.");
      return;
    }

    const validation = validatePublicWalletAddress(address);
    if (!validation.valid) {
      toast.error(validation.error || "Please enter a valid wallet address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: validation.normalized,
          label: reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        onSuccess();
      } else {
        toast.error(data.error || "Unable to complete wallet connection.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141414] border border-white/[0.08] w-full max-w-[420px] rounded-3xl p-6 sm:p-7 relative shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-white/[0.05] rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition"
        >
          <X size={15} />
        </button>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-[#10b981]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Connection Request Completed
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Your request has been received and is currently being processed. Please check back later for confirmation.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#10b981] hover:bg-emerald-500 text-black text-sm font-semibold transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 pr-8">
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Connect Wallet
              </h2>
              <p className="text-zinc-400 text-xs mt-1">
                Select your purpose and enter your external wallet address.
              </p>
            </div>

            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Reason for Connecting
                </label>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3.5 py-3 pr-9 text-sm text-zinc-100 outline-none focus:border-[#10b981] appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-[#141414]">
                      Select a reason
                    </option>
                    {LINK_WALLET_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#141414] text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your wallet address"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3.5 py-3 text-sm font-mono placeholder:font-sans placeholder:text-zinc-600 text-zinc-100 outline-none focus:border-[#10b981]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !address.trim() || !reason}
                className="w-full bg-[#10b981] hover:bg-emerald-500 text-black font-semibold text-sm py-3.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Connect Wallet"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
