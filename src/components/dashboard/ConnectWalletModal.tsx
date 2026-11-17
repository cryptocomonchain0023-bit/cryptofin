"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Loader2, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  SUPPORTED_WALLET_NETWORKS,
  SUPPORTED_WALLET_PROVIDERS,
  detectNetworkFromAddress,
  validatePublicWalletAddress,
} from "@/lib/linked-wallets";

interface ConnectWalletModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectWalletModal({ onClose, onSuccess }: ConnectWalletModalProps) {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<string>(SUPPORTED_WALLET_NETWORKS[0]);
  const [walletProvider, setWalletProvider] = useState<string>(SUPPORTED_WALLET_PROVIDERS[0]);
  const [loading, setLoading] = useState(false);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    const detected = detectNetworkFromAddress(val);
    if (detected) setNetwork(detected);
  };

  const handleAutoFill = async () => {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      toast.error("No browser wallet found. Enter your public address manually.");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts?.[0]) {
        handleAddressChange(accounts[0]);
        setNetwork("Ethereum (ERC20)");
        toast.success("Public address detected!");
      }
    } catch {
      toast.error("Wallet detection cancelled.");
    }
  };

  const handleLink = async () => {
    const validation = validatePublicWalletAddress(address, network);
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
          network,
          walletProvider,
          label: "Verify External Wallet Ownership",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Public wallet address submitted for verification!");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Failed to link wallet");
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
        className="bg-zinc-950/90 backdrop-blur-xl border border-white/10 w-full max-w-[440px] rounded-[28px] p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-all z-50"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className="mb-5 mt-1 relative z-10">
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Link2 size={20} className="text-primary" />
            Link Public Wallet
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            Submit your public address and network for verification.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          <button
            type="button"
            onClick={handleAutoFill}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Sparkles size={14} />
            Auto-Fill from Browser Wallet
          </button>

          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">
              Public Wallet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="0x..., T..., bc1..., or Solana address"
              spellCheck={false}
              className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-3 text-xs font-mono text-zinc-200 outline-none focus:border-primary/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">
                Network
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-primary/60"
              >
                {SUPPORTED_WALLET_NETWORKS.map((net) => (
                  <option key={net} value={net} className="bg-zinc-950">
                    {net}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">
                Provider
              </label>
              <select
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-primary/60"
              >
                {SUPPORTED_WALLET_PROVIDERS.map((prov) => (
                  <option key={prov} value={prov} className="bg-zinc-950">
                    {prov}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl">
            <ShieldCheck size={15} className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-zinc-300">
              <strong className="text-emerald-300">Public Address Only.</strong> Cryptofin will
              never ask for your seed phrase or private key.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLink}
            disabled={loading || !address.trim()}
            className="w-full bg-primary text-black font-extrabold py-3.5 rounded-xl hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Link2 size={16} />
                Submit for Verification
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
