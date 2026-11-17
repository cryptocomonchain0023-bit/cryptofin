"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Link2,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wallet,
  Copy,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  SUPPORTED_WALLET_NETWORKS,
  SUPPORTED_WALLET_PROVIDERS,
  LINK_WALLET_REASONS,
  detectNetworkFromAddress,
  validatePublicWalletAddress,
  type LinkedWalletRecord,
} from "@/lib/linked-wallets";

function shortenAddress(addr: string) {
  if (!addr || addr.length <= 18) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

export default function ConnectPage() {
  const router = useRouter();

  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<string>(SUPPORTED_WALLET_NETWORKS[0]);
  const [walletProvider, setWalletProvider] = useState<string>(SUPPORTED_WALLET_PROVIDERS[0]);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [detectingBrowserWallet, setDetectingBrowserWallet] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  const [linkedWallets, setLinkedWallets] = useState<LinkedWalletRecord[]>([]);
  const [activeWallet, setActiveWallet] = useState<LinkedWalletRecord | null>(null);
  const [step, setStep] = useState<"form" | "connecting" | "success" | "rejected">("form");

  const syncStatus = useCallback(async (allowStepOverride = true) => {
    try {
      const res = await fetch("/api/wallet/status", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const list: LinkedWalletRecord[] = Array.isArray(data.wallets) ? data.wallets : [];
        const latest: LinkedWalletRecord | null = data.wallet || list[0] || null;
        setLinkedWallets(list);
        setActiveWallet(latest);

        if (allowStepOverride) {
          if (latest?.status === "approved") setStep("success");
          else if (latest?.status === "pending") setStep("connecting");
          else if (latest?.status === "rejected") setStep("rejected");
          else setStep("form");
        }
      }
    } catch (e) {
      console.error("Wallet status check failed:", e);
    } finally {
      setIsInitialCheckDone(true);
    }
  }, []);

  useEffect(() => {
    syncStatus(true);
  }, [syncStatus]);

  // Live polling while verification is pending so admin approve/reject reflects within 4s
  useEffect(() => {
    if (step !== "connecting") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/wallet/status", { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
          const list: LinkedWalletRecord[] = Array.isArray(data.wallets) ? data.wallets : [];
          const latest: LinkedWalletRecord | null = data.wallet || list[0] || null;
          setLinkedWallets(list);
          setActiveWallet(latest);

          if (latest?.status === "approved") {
            setStep("success");
            toast.success("Your linked wallet has been verified and approved!");
          } else if (latest?.status === "rejected") {
            setStep("rejected");
            toast.error("Your wallet verification request was rejected.");
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [step]);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    const detected = detectNetworkFromAddress(val);
    if (detected) {
      setNetwork(detected);
    }
  };

  const handleDetectBrowserWallet = async () => {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      toast.error("No browser wallet detected. Paste your public wallet address manually below.");
      return;
    }

    setDetectingBrowserWallet(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        handleAddressChange(accounts[0]);
        setNetwork("Ethereum (ERC20)");
        toast.success("Public address detected from browser wallet!");
      } else {
        toast.error("No public account returned from browser wallet.");
      }
    } catch {
      toast.error("Browser wallet connection was cancelled.");
    } finally {
      setDetectingBrowserWallet(false);
    }
  };

  const handleSubmit = async () => {
    const validation = validatePublicWalletAddress(address, network);
    if (!validation.valid) {
      toast.error(validation.error || "Please enter a valid public wallet address.");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason for linking this wallet.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: validation.normalized,
          network,
          walletProvider,
          label: reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to submit wallet verification");
        return;
      }

      const list: LinkedWalletRecord[] = Array.isArray(data.wallets) ? data.wallets : [];
      const created: LinkedWalletRecord | null = data.wallet || list[0] || null;
      setLinkedWallets(list);
      setActiveWallet(created);
      setStep("connecting");
      toast.success("Public wallet address submitted for verification.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWallet = async (id: string) => {
    if (!window.confirm("Remove this linked public wallet from your account?")) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/wallet/link?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to remove linked wallet");
        return;
      }
      const nextList: LinkedWalletRecord[] = Array.isArray(data.wallets) ? data.wallets : [];
      setLinkedWallets(nextList);
      const nextLatest = nextList[0] || null;
      setActiveWallet(nextLatest);
      if (!nextLatest) {
        setStep("form");
      } else if (activeWallet?.id === id) {
        if (nextLatest.status === "approved") setStep("success");
        else if (nextLatest.status === "pending") setStep("connecting");
        else setStep("rejected");
      }
      toast.success("Linked wallet removed.");
    } catch {
      toast.error("Error removing linked wallet.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Public address copied!");
  };

  if (!isInitialCheckDone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 pb-32 animate-in fade-in duration-300">
      <div className="max-w-3xl mx-auto pt-[max(env(safe-area-inset-top),1.25rem)]">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors font-bold text-sm mb-6"
        >
          <ChevronLeft size={20} />
          Back
        </button>

        {/* STATUS VIEW: CONNECTING / APPROVED / REJECTED */}
        {step !== "form" && activeWallet ? (
          <div className="bg-[#0c1117] border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center shadow-2xl mb-8">
            <div className="w-16 h-16 bg-[#161b22] rounded-2xl flex items-center justify-center mb-5 shadow-xl border border-white/10">
              {step === "rejected" ? (
                <ShieldAlert size={28} className="text-red-500" />
              ) : step === "success" ? (
                <CheckCircle2 size={28} className="text-emerald-400" />
              ) : (
                <Link2 size={28} className="text-blue-500 animate-pulse" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-1.5 text-center">
              {step === "success"
                ? "External Wallet Verified"
                : step === "rejected"
                ? "Wallet Verification Rejected"
                : "Verifying Linked Wallet"}
            </h2>
            <p className="text-zinc-400 text-sm mb-6 text-center max-w-md">
              {step === "success"
                ? "Your public wallet address has been approved and synced with your Cryptofin account."
                : step === "rejected"
                ? "Please review the verification feedback below and resubmit your public wallet details."
                : "Your public wallet address is currently awaiting security review. Status updates automatically."}
            </p>

            {/* Submitted Public Wallet Details Card */}
            <div className="w-full max-w-xl bg-black/50 border border-white/10 rounded-2xl p-4 mb-6 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                  Linked Public Address
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  {activeWallet.network}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-zinc-900/80 rounded-xl px-3.5 py-2.5 border border-white/5">
                <span className="font-mono text-xs sm:text-sm text-zinc-200 break-all">
                  {activeWallet.address}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(activeWallet.address)}
                  className="p-1.5 text-zinc-400 hover:text-white transition shrink-0"
                  title="Copy address"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 flex-wrap gap-2">
                <span>
                  Provider: <strong className="text-zinc-200">{activeWallet.walletProvider}</strong>
                </span>
                {activeWallet.label && (
                  <span>
                    Purpose: <strong className="text-zinc-200">{activeWallet.label}</strong>
                  </span>
                )}
              </div>
            </div>

            {step === "rejected" ? (
              <>
                <div className="w-full max-w-xl rounded-2xl bg-red-500/10 border border-red-500/25 p-5 shadow-lg text-center space-y-2">
                  <p className="text-[14px] font-semibold text-red-400 leading-relaxed">
                    Verification Request Rejected. Please ensure your public wallet address matches the selected network before resubmitting.
                  </p>
                  {activeWallet.adminNote && (
                    <p className="text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20">
                      Admin Note: <strong>{activeWallet.adminNote}</strong>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddress(activeWallet.address);
                    setNetwork(activeWallet.network);
                    setWalletProvider(activeWallet.walletProvider);
                    setReason(activeWallet.label || "");
                    setStep("form");
                  }}
                  className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold transition-colors text-white shadow-lg"
                >
                  Edit &amp; Resubmit Verification
                </button>
              </>
            ) : (
              <>
                <div
                  className={`w-full max-w-xl rounded-2xl p-5 shadow-lg ${
                    step === "success"
                      ? "bg-emerald-600/90 border border-emerald-400/30"
                      : "bg-[#0062E5]"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {step === "connecting" ? (
                      <Clock size={16} className="text-white animate-pulse" />
                    ) : (
                      <CheckCircle2 size={16} className="text-white" />
                    )}
                    <span className="text-xs font-extrabold uppercase tracking-wider text-white/90">
                      {step === "connecting" ? "Pending Admin Verification" : "Verified & Active"}
                    </span>
                  </div>
                  <p className="text-[14px] font-medium text-white text-center leading-relaxed">
                    {step === "connecting"
                      ? "Please be patient while our team verifies your linked public wallet address. This page updates automatically once approved."
                      : "The connection to your external public wallet has been verified and approved. Everything is securely synced and ready."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAddress("");
                    setReason("");
                    setStep("form");
                  }}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition"
                >
                  <Plus size={14} />
                  <span>Link Another Public Wallet</span>
                </button>
              </>
            )}
          </div>
        ) : (
          /* FORM VIEW */
          <div className="bg-[#0c1117] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                  <Link2 size={24} className="text-blue-500" />
                  <span>Link External Wallet</span>
                </h1>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1">
                  Submit your public wallet address and network for verification and syncing with your account.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDetectBrowserWallet}
                disabled={detectingBrowserWallet}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-bold transition shrink-0"
              >
                {detectingBrowserWallet ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>Auto-Fill Browser Wallet</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Public Address Input */}
              <div className="space-y-2">
                <label className="text-zinc-300 font-bold text-xs uppercase tracking-wider block">
                  Public Wallet Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="e.g. 0x71C... or T... or bc1q... or Solana address"
                  spellCheck={false}
                  className="w-full bg-[#151820] border border-white/10 rounded-xl px-4 py-3.5 text-zinc-100 font-mono text-sm outline-none focus:border-blue-500/70 transition-colors"
                />
              </div>

              {/* Network + Provider Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-zinc-300 font-bold text-xs uppercase tracking-wider block">
                    Blockchain Network
                  </label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full bg-[#151820] border border-white/10 rounded-xl px-4 py-3.5 text-zinc-200 text-sm font-medium outline-none focus:border-blue-500/70 cursor-pointer"
                  >
                    {SUPPORTED_WALLET_NETWORKS.map((net) => (
                      <option key={net} value={net} className="bg-[#151820]">
                        {net}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-zinc-300 font-bold text-xs uppercase tracking-wider block">
                    Wallet Provider
                  </label>
                  <select
                    value={walletProvider}
                    onChange={(e) => setWalletProvider(e.target.value)}
                    className="w-full bg-[#151820] border border-white/10 rounded-xl px-4 py-3.5 text-zinc-200 text-sm font-medium outline-none focus:border-blue-500/70 cursor-pointer"
                  >
                    {SUPPORTED_WALLET_PROVIDERS.map((prov) => (
                      <option key={prov} value={prov} className="bg-[#151820]">
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Purpose Dropdown */}
              <div className="space-y-2">
                <label className="text-zinc-300 font-bold text-xs uppercase tracking-wider block">
                  Reason for Linking
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#151820] border border-white/10 rounded-xl px-4 py-3.5 text-zinc-200 text-sm font-medium outline-none focus:border-blue-500/70 cursor-pointer"
                >
                  <option value="" disabled className="bg-[#151820]">
                    Select the purpose for linking this wallet
                  </option>
                  {LINK_WALLET_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-[#151820]">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Notice */}
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-emerald-300">Public Address Only:</strong> Only enter your
                  public receiving wallet address. Never share your 12/24-word recovery phrase or
                  private key with anyone.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Link2 size={18} />
                    <span>Submit Public Wallet for Verification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LINKED WALLETS HISTORY LIST */}
        {linkedWallets.length > 0 && (
          <div className="bg-[#0c1117] border border-white/10 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet size={16} className="text-blue-400" />
                <span>Your Linked Public Wallets ({linkedWallets.length})</span>
              </h3>
            </div>

            <div className="space-y-3">
              {linkedWallets.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveWallet(item);
                    if (item.status === "approved") setStep("success");
                    else if (item.status === "pending") setStep("connecting");
                    else setStep("rejected");
                  }}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    activeWallet?.id === item.id && step !== "form"
                      ? "bg-white/[0.06] border-blue-500/40"
                      : "bg-black/40 border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-semibold text-zinc-100">
                        {shortenAddress(item.address)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-300">
                        {item.network}
                      </span>
                      <span className="text-[11px] text-zinc-500">{item.walletProvider}</span>
                    </div>
                    {item.adminNote && (
                      <p className="text-[11px] text-zinc-400 truncate">
                        Note: {item.adminNote}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 size={11} /> Verified
                      </span>
                    ) : item.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        <ShieldAlert size={11} /> Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Clock size={11} /> Pending
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWallet(item.id);
                      }}
                      disabled={removingId === item.id}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Remove linked wallet"
                    >
                      {removingId === item.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
