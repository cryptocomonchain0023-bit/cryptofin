"use client";

import React, { useState } from "react";
import { X, Loader2, Link2 } from "lucide-react";
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

  const handleLink = async () => {
    if (!reason) {
      toast.error("Please select a reason for connecting.");
      return;
    }

    const validation = validatePublicWalletAddress(address);
    if (!validation.valid) {
      toast.error(validation.error || "Enter a valid public wallet address");
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
        toast.success("Wallet address submitted for verification!");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Failed to connect wallet");
      }
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#050505]/95 backdrop-blur-2xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950/90 backdrop-blur-xl border border-white/10 w-full max-w-[420px] rounded-[28px] p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-all z-50"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className="mb-6 mt-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 size={18} className="text-blue-500" />
            Connect Wallet
          </h2>
          <p className="text-zinc-500 text-xs mt-1">
            Select your reason and enter your public wallet address.
          </p>
        </div>

        <div className="space-y-4">
          {/* 1. Reason */}
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1.5">
              Reason for Connecting
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#151515] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-zinc-200 outline-none focus:border-primary/60 cursor-pointer"
            >
              <option value="" disabled className="bg-[#151515]">
                Select a reason
              </option>
              {LINK_WALLET_REASONS.map((r) => (
                <option key={r} value={r} className="bg-[#151515]">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Wallet Address */}
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1.5">
              Wallet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste or enter your public wallet address"
              spellCheck={false}
              className="w-full bg-[#151515] border border-white/10 rounded-xl px-3.5 py-3 text-xs font-mono text-zinc-200 outline-none focus:border-primary/60"
            />
          </div>

          <button
            type="button"
            onClick={handleLink}
            disabled={loading || !address.trim() || !reason}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              "Securely Connect Wallet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
