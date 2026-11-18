"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Link2, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  LINK_WALLET_REASONS,
  validatePublicWalletAddress,
  type LinkedWalletRecord,
} from "@/lib/linked-wallets";

export default function ConnectPage() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  const [activeWallet, setActiveWallet] = useState<LinkedWalletRecord | null>(null);
  const [step, setStep] = useState<"form" | "connecting" | "success" | "rejected">("form");

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/status", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const latest: LinkedWalletRecord | null = data.wallet || null;
        setActiveWallet(latest);
        if (latest?.status === "approved") setStep("success");
        else if (latest?.status === "pending") setStep("connecting");
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

  // Live polling when waiting for admin verification
  useEffect(() => {
    if (step !== "connecting") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/wallet/status", { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
          const latest: LinkedWalletRecord | null = data.wallet || null;
          setActiveWallet(latest);
          if (latest?.status === "approved") {
            setStep("success");
            clearInterval(interval);
          } else if (latest?.status === "rejected") {
            setStep("rejected");
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [step]);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason for connecting.");
      return;
    }

    const validation = validatePublicWalletAddress(address);
    if (!validation.valid) {
      toast.error(validation.error || "Please enter a valid public wallet address.");
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

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to connect wallet");
        setLoading(false);
        return;
      }

      setActiveWallet(data.wallet || null);
      setStep("connecting");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialCheckDone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (step === "connecting" || step === "success" || step === "rejected") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 flex flex-col pt-12 pb-32 items-center">
        <div className="w-full max-w-4xl">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors font-bold text-sm mb-8"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          <div className="bg-[#0c1117] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[450px]">
            <div className="w-16 h-16 bg-[#161b22] rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-white/5">
              {step === "rejected" ? (
                <ShieldAlert size={28} className="text-red-500" />
              ) : step === "success" ? (
                <CheckCircle2 size={28} className="text-emerald-400" />
              ) : (
                <Link2 size={28} className="text-blue-500" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">Connect wallet</h2>
            <p className="text-zinc-500 text-sm mb-6 text-center max-w-sm">
              Secure your assets. Link an external public wallet address to your account.
            </p>

            {activeWallet?.address && (
              <div className="mb-8 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-xs text-zinc-300 max-w-full break-all text-center">
                {activeWallet.address}
              </div>
            )}

            {step === "rejected" ? (
              <>
                <div className="w-full max-w-2xl rounded-2xl bg-red-500/10 border border-red-500/20 p-5 shadow-lg text-center space-y-2">
                  <p className="text-[15px] font-medium text-red-400 leading-relaxed">
                    Connection Request Rejected. Please review your wallet address and ensure it is accurate before attempting to connect again.
                  </p>
                  {activeWallet?.adminNote && (
                    <p className="text-xs text-red-300/90">
                      Note: <span className="font-semibold">{activeWallet.adminNote}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (activeWallet?.label) setReason(activeWallet.label);
                    if (activeWallet?.address) setAddress(activeWallet.address);
                    setStep("form");
                    setLoading(false);
                  }}
                  className="mt-8 px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-colors text-white shadow-lg"
                >
                  Attempt Reconnection
                </button>
              </>
            ) : (
              <div className="w-full rounded-2xl bg-[#0062E5] p-5 shadow-lg">
                <p className="text-[15px] font-medium text-white text-center leading-relaxed">
                  {step === "connecting"
                    ? "Please be patient while we establish a secure connection to your wallet. This may take a moment, and you'll be notified once it's complete."
                    : "The connection to your wallet has been successfully established. You are now securely connected, and everything is set up and ready. Thank you for your cooperation!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 animate-in fade-in duration-500 pb-32">
      <div className="max-w-2xl mx-auto pt-[max(env(safe-area-inset-top),1.5rem)]">
        {/* BACK BUTTON */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors font-bold text-sm mb-8"
        >
          <ChevronLeft size={20} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect Wallet</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Select your reason and enter your external public wallet address below.
          </p>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: REASON FOR CONNECTING */}
          <div className="space-y-2">
            <label className="text-zinc-300 font-bold text-sm block">
              Reason for Connecting
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#151515] border border-white/10 rounded-xl p-4 text-zinc-200 font-medium outline-none focus:border-primary/60 appearance-none cursor-pointer transition-colors"
              >
                <option value="" disabled className="bg-[#151515]">
                  Select the purpose for connecting this wallet
                </option>
                {LINK_WALLET_REASONS.map((item) => (
                  <option key={item} value={item} className="bg-[#151515]">
                    {item}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <svg
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1.5L6 6.5L11 1.5"
                    stroke="#71717A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* SECTION 2: WALLET ADDRESS INPUT */}
          <div className="space-y-2">
            <label className="text-zinc-300 font-bold text-sm block">
              Wallet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste or enter your public wallet address"
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-[#151515] border border-white/10 rounded-xl p-4 text-zinc-200 font-mono text-sm outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* EXPLANATION TEXT */}
          <div className="space-y-1.5 pt-1">
            <h4 className="text-zinc-300 font-bold text-sm">How does this work?</h4>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Enter any external public wallet address you want linked to your account. Once submitted, our team verifies your connection request and syncs the status automatically.
            </p>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl mt-4 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              "Securely Connect Wallet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
