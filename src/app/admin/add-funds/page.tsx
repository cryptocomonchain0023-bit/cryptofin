"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  ChevronDown,
  Copy,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { DEFAULT_FALLBACK_PRICES, truncateAddress } from "@/lib/admin-tokens";

interface WalletRecord {
  readable_id?: string | null;
  address?: string | null;
  btc_address?: string | null;
  sol_address?: string | null;
  trx_address?: string | null;
  usdt_erc20_address?: string | null;
  usdt_trc20_address?: string | null;
  usdt_bep20_address?: string | null;
  usdc_bep20_address?: string | null;
  usdc_solana_address?: string | null;
  wallet_balance?: number | null;
  balance?: number | null;
  btc_balance?: number | null;
  bnb_balance?: number | null;
  sol_balance?: number | null;
  trx_balance?: number | null;
  matic_balance?: number | null;
  avax_balance?: number | null;
  usdt_balance?: number | null;
  usdt_erc20_balance?: number | null;
  usdt_trc20_balance?: number | null;
  usdt_bep20_balance?: number | null;
  usdt_sol_balance?: number | null;
  usdt_matic_balance?: number | null;
  usdt_avax_balance?: number | null;
  usdc_balance?: number | null;
  usdc_erc20_balance?: number | null;
  usdc_bep20_balance?: number | null;
  usdc_solana_balance?: number | null;
  usdc_matic_balance?: number | null;
  usdc_avax_balance?: number | null;
  [key: string]: unknown;
}

interface AdminUserOption {
  id: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  phone?: string | null;
  tx_refs?: string[];
  wallet_addresses?: string[];
  wallet?: WalletRecord | null;
  [key: string]: unknown;
}

interface MatchResult {
  field: string;
  matchedValue?: string;
  score: number; // higher is stronger match
}

const ASSET_OPTIONS = [
  { id: "btc", label: "Bitcoin (BTC)", symbol: "BTC", priceKey: "BTC", chain: "btc" },
  { id: "eth", label: "Ethereum (ETH)", symbol: "ETH", priceKey: "ETH", chain: "evm" },
  { id: "usdt_erc20", label: "USDT (ERC20)", symbol: "USDT", priceKey: "USDT", chain: "evm" },
  { id: "usdt_trc20", label: "USDT (TRC20)", symbol: "USDT", priceKey: "USDT", chain: "trx" },
  { id: "usdt_bep20", label: "USDT (BEP20)", symbol: "USDT", priceKey: "USDT", chain: "evm" },
  { id: "usdt_sol", label: "USDT (Solana)", symbol: "USDT", priceKey: "USDT", chain: "sol" },
  { id: "usdt_matic", label: "USDT (Polygon)", symbol: "USDT", priceKey: "USDT", chain: "evm" },
  { id: "usdt_avax", label: "USDT (Avalanche)", symbol: "USDT", priceKey: "USDT", chain: "evm" },
  { id: "usdc_erc20", label: "USDC (ERC20)", symbol: "USDC", priceKey: "USDC", chain: "evm" },
  { id: "usdc_solana", label: "USDC (Solana)", symbol: "USDC", priceKey: "USDC", chain: "sol" },
  { id: "usdc_bep20", label: "USDC (BEP20)", symbol: "USDC", priceKey: "USDC", chain: "evm" },
  { id: "usdc_matic", label: "USDC (Polygon)", symbol: "USDC", priceKey: "USDC", chain: "evm" },
  { id: "usdc_avax", label: "USDC (Avalanche)", symbol: "USDC", priceKey: "USDC", chain: "evm" },
  { id: "bnb", label: "BNB (BEP20)", symbol: "BNB", priceKey: "BNB", chain: "evm" },
  { id: "sol", label: "Solana (SOL)", symbol: "SOL", priceKey: "SOL", chain: "sol" },
  { id: "trx", label: "Tron (TRX)", symbol: "TRX", priceKey: "TRX", chain: "trx" },
  { id: "matic", label: "Polygon (MATIC)", symbol: "MATIC", priceKey: "MATIC", chain: "evm" },
  { id: "avax", label: "Avalanche (AVAX)", symbol: "AVAX", priceKey: "AVAX", chain: "evm" },
] as const;

function normalizeSearchQuery(raw: string): string {
  let q = raw.trim().replace(/^["']+|["']+$/g, "");
  if (!q) return "";

  // Strip explorer URLs (e.g. https://etherscan.io/address/0x..., https://tronscan.org/#/address/T...)
  const urlMatch = q.match(
    /(?:^https?:\/\/[^/]+\/(?:#\/)?(?:address|account|tx|token)\/)([^/?#\s]+)/i
  );
  if (urlMatch?.[1]) {
    q = urlMatch[1];
  }

  // Strip QR/payment URI schemes (e.g. ethereum:0x...@1?value=..., bitcoin:bc1...?amount=...)
  q = q.replace(
    /^(?:ethereum|bitcoin|solana|tron|bsc|bnb|polygon|avalanche):/i,
    ""
  );
  q = q.split(/[?@]/)[0].trim();

  return q.toLowerCase();
}

function matchesCandidateValue(candidate: string, q: string): number {
  const lower = candidate.trim().toLowerCase();
  if (!lower || !q) return 0;
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 85;
  if (lower.includes(q)) return 70;

  // Support matching truncated addresses like "0x48dd9cfE...2FC347" or "bc1qemnc…ep7qht"
  const trunc = q.split(/\.\.\.|…/).map((s) => s.trim()).filter(Boolean);
  if (
    trunc.length === 2 &&
    trunc[0].length >= 3 &&
    trunc[1].length >= 3 &&
    lower.startsWith(trunc[0]) &&
    lower.endsWith(trunc[1])
  ) {
    return 95;
  }

  return 0;
}

function formatName(u: AdminUserOption | null | undefined): string {
  if (!u) return "User";
  if (typeof u.display_name === "string" && u.display_name.trim()) {
    return u.display_name.trim();
  }
  if (typeof u.full_name === "string" && u.full_name.trim()) {
    return u.full_name.trim();
  }
  if (u.first_name || u.last_name) {
    const joined = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    if (joined) return joined;
  }
  if (typeof u.username === "string" && u.username.trim()) {
    return u.username.trim();
  }
  if (typeof u.email === "string" && u.email.includes("@")) {
    return u.email.split("@")[0];
  }
  return "User";
}

function findUserMatch(u: AdminUserOption, rawQuery: string): MatchResult | null {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) return null;

  const w: Record<string, unknown> = (u.wallet || u || {}) as Record<string, unknown>;

  const addressFields: Array<{ key: string; label: string }> = [
    { key: "address", label: "EVM Address" },
    { key: "btc_address", label: "BTC Address" },
    { key: "sol_address", label: "SOL Address" },
    { key: "trx_address", label: "TRX Address" },
    { key: "usdt_erc20_address", label: "USDT ERC20 Address" },
    { key: "usdt_trc20_address", label: "USDT TRC20 Address" },
    { key: "usdt_bep20_address", label: "USDT BEP20 Address" },
    { key: "usdc_bep20_address", label: "USDC BEP20 Address" },
    { key: "usdc_solana_address", label: "USDC SOL Address" },
  ];

  let best: MatchResult | null = null;

  for (const { key, label } of addressFields) {
    const val = w[key];
    if (typeof val === "string" && val.trim()) {
      const score = matchesCandidateValue(val, q);
      if (score > 0 && (!best || score > best.score)) {
        best = { field: label, matchedValue: val.trim(), score };
      }
    }
  }

  // Secondary/extra wallet addresses returned from /api/admin/users
  if (Array.isArray(u.wallet_addresses)) {
    for (const addr of u.wallet_addresses) {
      if (typeof addr === "string" && addr.trim()) {
        const score = matchesCandidateValue(addr, q);
        if (score > 0 && (!best || score > best.score)) {
          best = { field: "Wallet Address", matchedValue: addr.trim(), score };
        }
      }
    }
  }

  if (best) return best;

  const uid = typeof w.readable_id === "string" ? w.readable_id : "";
  if (uid) {
    const score = matchesCandidateValue(uid, q);
    if (score > 0) return { field: "Account ID", matchedValue: uid, score };
  }

  if (u.id) {
    const score = matchesCandidateValue(u.id, q);
    if (score > 0) return { field: "User UUID", matchedValue: u.id, score: score - 5 };
  }

  if (typeof u.email === "string" && u.email.trim()) {
    const score = matchesCandidateValue(u.email, q);
    if (score > 0) return { field: "Email", matchedValue: u.email.trim(), score: score - 5 };
  }

  const nameCandidates = [
    formatName(u),
    u.full_name,
    u.first_name,
    u.last_name,
    u.username,
    u.phone,
  ];
  for (const cand of nameCandidates) {
    if (typeof cand === "string" && cand.trim()) {
      const score = matchesCandidateValue(cand, q);
      if (score > 0) {
        return { field: "Name / Contact", score: score - 10 };
      }
    }
  }

  if (Array.isArray(u.tx_refs)) {
    for (const ref of u.tx_refs) {
      if (typeof ref === "string" && ref.trim()) {
        const score = matchesCandidateValue(ref, q);
        if (score > 0) {
          return {
            field: "Tx Address / Hash",
            matchedValue: ref.trim(),
            score: score - 8,
          };
        }
      }
    }
  }

  return null;
}

export default function AdminAddFundsPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [walletType, setWalletType] = useState("btc");

  const [amount, setAmount] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [inputMode, setInputMode] = useState<"crypto" | "usd">("crypto");

  const [fromName, setFromName] = useState("");
  const [fromBank, setFromBank] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [date, setDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [pricesBySymbol, setPricesBySymbol] = useState<Record<string, number>>(
    DEFAULT_FALLBACK_PRICES
  );

  const fetchUsers = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshingUsers(true);
      setLoadError(null);
      try {
        const res = await adminFetch("/api/admin/users");
        if (res.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load user directory");
        }
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to fetch users";
        setLoadError(msg);
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
        setRefreshingUsers(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);

    // Optional URL prefill (?userId=... or ?q=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const qUserId = params.get("userId");
      const qSearch = params.get("q");
      if (qUserId) setSelectedUser(qUserId);
      if (qSearch) {
        setUserSearch(qSearch);
        setShowUserModal(true);
      }
    } catch {
      // ignore URL parsing errors
    }

    fetchUsers();

    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object") {
            setPricesBySymbol({ ...DEFAULT_FALLBACK_PRICES, ...data });
          }
        }
      } catch (error) {
        console.error("Failed to fetch prices:", error);
      }
    };
    fetchPrices();
  }, [fetchUsers]);

  // Auto-focus modal search box when modal opens
  useEffect(() => {
    if (showUserModal) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [showUserModal]);

  const activeAsset = useMemo(
    () => ASSET_OPTIONS.find((a) => a.id === walletType) || ASSET_OPTIONS[0],
    [walletType]
  );

  const activeRate = useMemo(
    () => pricesBySymbol[activeAsset.priceKey] || 0,
    [pricesBySymbol, activeAsset]
  );

  // Calculate equivalent amounts
  useEffect(() => {
    if (!activeRate) return;
    if (inputMode === "crypto") {
      if (!amount) setAmountUsd("");
      else {
        const num = parseFloat(amount);
        setAmountUsd(isNaN(num) ? "" : (num * activeRate).toFixed(2));
      }
    } else {
      if (!amountUsd) setAmount("");
      else {
        const num = parseFloat(amountUsd);
        setAmount(isNaN(num) ? "" : (num / activeRate).toFixed(6));
      }
    }
  }, [amount, amountUsd, inputMode, activeRate]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please select a user and enter a valid positive amount.");
      return;
    }

    setSubmitting(true);

    let finalDate = date;
    const todayString = new Date().toISOString().split("T")[0];
    if (customTime) {
      finalDate = new Date(`${date}T${customTime}:00`).toISOString();
    } else if (date === todayString) {
      finalDate = new Date().toISOString();
    } else {
      const now = new Date();
      const hr = now.getHours().toString().padStart(2, "0");
      const mn = now.getMinutes().toString().padStart(2, "0");
      finalDate = `${date}T${hr}:${mn}:00.000Z`;
    }

    try {
      const res = await adminFetch("/api/admin/add-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedUser,
          walletType,
          amount,
          fromName,
          fromBank,
          fromAddress,
          txHash,
          date: finalDate,
          sendEmail,
        }),
      });

      if (res.status === 401) {
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        setSubmitting(false);
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to add funds.");
      } else {
        toast.success(
          sendEmail
            ? "Funds successfully added and email notification sent!"
            : "Funds successfully added!"
        );
        setAmount("");
        setAmountUsd("");
        setFromName("");
        setFromBank("");
        setFromAddress("");
        setTxHash("");
        setSelectedUser("");
        await fetchUsers();
      }
    } catch {
      toast.error("An unexpected error occurred.");
    }

    setSubmitting(false);
  };

  const getBalanceDisplay = (u: AdminUserOption, type: string) => {
    const w = (u?.wallet || u || {}) as Record<string, unknown>;
    if (type === "main") return `$${Number(w.wallet_balance || 0).toLocaleString()}`;
    if (type === "usdt_erc20") return `${Number(w.usdt_erc20_balance || 0)} USDT`;
    if (type === "usdt_trc20") return `${Number(w.usdt_trc20_balance || 0)} USDT`;
    if (type === "usdt_bep20") return `${Number(w.usdt_bep20_balance || 0)} USDT`;
    if (type === "usdt_sol") return `${Number(w.usdt_sol_balance || 0)} USDT`;
    if (type === "usdt_matic") return `${Number(w.usdt_matic_balance || 0)} USDT`;
    if (type === "usdt_avax") return `${Number(w.usdt_avax_balance || 0)} USDT`;
    if (type === "usdc_erc20") return `${Number(w.usdc_balance || 0)} USDC`;
    if (type === "usdc_solana") return `${Number(w.usdc_solana_balance || 0)} USDC`;
    if (type === "usdc_bep20") return `${Number(w.usdc_bep20_balance || 0)} USDC`;
    if (type === "usdc_matic") return `${Number(w.usdc_matic_balance || 0)} USDC`;
    if (type === "usdc_avax") return `${Number(w.usdc_avax_balance || 0)} USDC`;
    if (type === "btc") return `${Number(w.btc_balance || 0)} BTC`;
    if (type === "eth") return `${Number(w.balance || 0)} ETH`;
    if (type === "bnb") return `${Number(w.bnb_balance || 0)} BNB`;
    if (type === "sol") return `${Number(w.sol_balance || 0)} SOL`;
    if (type === "trx") return `${Number(w.trx_balance || 0)} TRX`;
    if (type === "matic") return `${Number(w.matic_balance || 0)} MATIC`;
    if (type === "avax") return `${Number(w.avax_balance || 0)} AVAX`;
    return "0";
  };

  const getAddressForAsset = (u: AdminUserOption | null, chain: string): string | null => {
    if (!u?.wallet) return null;
    if (chain === "btc") return u.wallet.btc_address || null;
    if (chain === "sol") return u.wallet.sol_address || null;
    if (chain === "trx") return u.wallet.trx_address || null;
    return u.wallet.address || null;
  };

  const selectedUserObj = useMemo(
    () => users.find((u) => u.id === selectedUser) || null,
    [users, selectedUser]
  );

  const selectedAssetAddress = useMemo(
    () => getAddressForAsset(selectedUserObj, activeAsset.chain),
    [selectedUserObj, activeAsset.chain]
  );

  const modalUsers = useMemo(() => {
    const cleanedQuery = normalizeSearchQuery(userSearch);
    if (!cleanedQuery) {
      return users.map((user) => ({ user, match: null as MatchResult | null }));
    }

    const matched: Array<{ user: AdminUserOption; match: MatchResult }> = [];
    for (const user of users) {
      const m = findUserMatch(user, userSearch);
      if (m) matched.push({ user, match: m });
    }
    matched.sort((a, b) => b.match.score - a.match.score);
    return matched;
  }, [users, userSearch]);

  const handleCopy = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-500 font-semibold">Loading user accounts...</div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-300 max-w-3xl">
      {loadError && (
        <div className="mb-4 p-4 rounded-sm border border-red-200 bg-red-50 flex items-center justify-between gap-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchUsers(true)}
            className="px-3 py-1 rounded bg-white border border-red-200 text-xs font-bold hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white border border-[#4EA7F8] rounded-sm shadow-sm overflow-hidden mb-8 relative">
        <div className="px-6 py-5 border-b border-[#EAEAEA] flex justify-between items-center">
          <h3 className="font-bold text-gray-600 text-[15px] uppercase tracking-wider">
            Add Funds
          </h3>
          <Link
            href="/admin/deposits"
            className="text-[#3498db] text-xs font-bold hover:underline"
          >
            Go to Manage Deposits
          </Link>
        </div>

        <form onSubmit={handleAddFunds} className="p-4 md:p-8 space-y-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Crypto Asset: <span className="text-red-500">*</span>
              </label>
              <select
                value={walletType}
                onChange={(e) => setWalletType(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-sm bg-gray-50 outline-none focus:border-[#3498db] text-base text-gray-700"
              >
                {ASSET_OPTIONS.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-700">
                User: <span className="text-red-500">*</span>
              </label>
              {selectedUserObj && (
                <div className="flex items-center gap-3 text-xs">
                  <Link
                    href={`/admin/members/${selectedUserObj.id}`}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                  >
                    <span>Inspect User</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelectedUser("")}
                    className="text-gray-500 hover:text-red-600 font-semibold"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="w-full border border-gray-300 p-3 rounded-sm bg-gray-50 text-left text-base text-gray-700 cursor-pointer flex justify-between items-center hover:border-[#3498db] transition-colors"
            >
              {selectedUserObj ? (
                <div className="min-w-0 pr-3">
                  <div className="font-bold text-gray-900 text-sm truncate">
                    {formatName(selectedUserObj)}{" "}
                    <span className="font-normal text-gray-500">
                      ({selectedUserObj.email || "No email"})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                      UID: {selectedUserObj.wallet?.readable_id || selectedUserObj.id.slice(0, 8)}
                    </span>
                    {selectedAssetAddress && (
                      <span className="text-blue-700 break-all">
                        {activeAsset.chain.toUpperCase()}: {selectedAssetAddress}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-gray-500 flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  Select a user (search by wallet address, email, name, or UID)...
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </button>

            {selectedAssetAddress && (
              <div className="mt-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-blue-50/70 border border-blue-100 text-xs">
                <span className="text-blue-800 font-medium truncate">
                  Target {activeAsset.chain.toUpperCase()} Address:{" "}
                  <span className="font-mono font-bold">{selectedAssetAddress}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      selectedAssetAddress,
                      `${activeAsset.chain.toUpperCase()} Address`
                    )
                  }
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
            )}
          </div>

          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Sending Wallet Address:{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="The crypto address the funds were sent from"
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Transaction ID / Blockchain ID:{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="TxHash"
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-mono"
              />
            </div>
          </>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-bold text-gray-700">
                Amount / Quantity: <span className="text-red-500">*</span>
              </label>
              <div className="flex bg-gray-100 rounded-sm p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setInputMode("crypto")}
                  className={`text-xs px-3 py-1 font-bold rounded-sm ${
                    inputMode === "crypto"
                      ? "bg-white shadow-sm text-[#3498db]"
                      : "text-gray-500"
                  }`}
                >
                  CRYPTO
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("usd")}
                  className={`text-xs px-3 py-1 font-bold rounded-sm ${
                    inputMode === "usd"
                      ? "bg-white shadow-sm text-[#3498db]"
                      : "text-gray-500"
                  }`}
                >
                  USD
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                {inputMode === "usd" && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                    $
                  </div>
                )}
                <input
                  type="number"
                  step="any"
                  value={inputMode === "crypto" ? amount : amountUsd}
                  onChange={(e) => {
                    if (inputMode === "crypto") setAmount(e.target.value);
                    else setAmountUsd(e.target.value);
                  }}
                  placeholder="0.00"
                  className={`w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-bold ${
                    inputMode === "usd" ? "pl-7" : ""
                  }`}
                  required
                />
              </div>
              <div className="text-sm font-bold text-gray-500 whitespace-nowrap">
                {"\u2248"}{" "}
                {inputMode === "crypto"
                  ? `$${amountUsd || "0.00"}`
                  : `${amount || "0"} ${activeAsset.symbol}`}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Date: <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Custom Time:{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700"
              />
            </div>
          </div>

          <div className="flex flex-col mt-4 gap-4 border-t border-gray-100 pt-6">
            <div className="bg-gray-100 px-4 py-2 inline-flex self-start rounded border border-gray-200">
              <span className="text-gray-600 text-sm font-bold">Usable Balance: </span>
              {selectedUserObj ? (
                <span className="ml-2 text-[#3498db] font-bold">
                  {getBalanceDisplay(selectedUserObj, walletType)}
                </span>
              ) : (
                <span className="ml-2 text-gray-400">Select a user</span>
              )}
            </div>

            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 text-[#3498db] border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm font-bold text-red-600 group-hover:text-red-700">
                Send Email Notification
              </span>
            </label>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#00BFA5] text-white font-bold py-2.5 px-8 rounded-sm hover:bg-[#00a38c] transition-colors disabled:bg-gray-400 shadow-sm text-sm uppercase tracking-wide"
            >
              {submitting ? "Processing..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setAmountUsd("");
                setSelectedUser("");
                setFromName("");
                setFromBank("");
                setFromAddress("");
                setTxHash("");
              }}
              className="bg-white border border-gray-300 text-gray-600 font-bold py-2.5 px-8 rounded-sm hover:bg-gray-50 transition-colors shadow-sm text-sm uppercase tracking-wide"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-[100] flex items-start pt-10 sm:items-center sm:pt-4 justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-[680px] flex flex-col max-h-[85vh] overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-white border-b-2 border-blue-500 px-5 py-3.5 shrink-0">
              <div>
                <h2 className="text-blue-600 text-sm font-bold tracking-widest uppercase">
                  Select User
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Search across EVM (0x), BTC, SOL, TRX addresses, Email, Name, Account ID, or Tx Hash
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchUsers(true)}
                  disabled={refreshingUsers}
                  className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Refresh users & addresses"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshingUsers ? "animate-spin text-blue-600" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-sm transition-colors text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-100 bg-white shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Paste or type EVM (0x...), BTC (bc1...), SOL, TRX (T...), UID, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full border border-blue-200 pl-10 pr-9 py-2.5 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-gray-800 font-mono"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserSearch("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500 font-medium">
                <span>
                  Showing <strong className="text-gray-800">{modalUsers.length}</strong> of{" "}
                  <strong className="text-gray-800">{users.length}</strong> users
                </span>
                {userSearch.trim() && (
                  <span className="text-blue-600 font-mono truncate max-w-[300px]">
                    Filter: {normalizeSearchQuery(userSearch)}
                  </span>
                )}
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50">
              {modalUsers.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-sm font-bold text-gray-700">
                    {users.length === 0
                      ? "No user records loaded."
                      : "No users match that address or search query."}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {users.length === 0
                      ? "Click refresh above or check your admin session."
                      : "Double-check for typos or clear the filter to browse all accounts."}
                  </p>
                </div>
              ) : (
                modalUsers.map(({ user: u, match }) => {
                  const isSelected = selectedUser === u.id;
                  const w = u.wallet;
                  const addrChips = [
                    { label: "EVM", val: w?.address },
                    { label: "BTC", val: w?.btc_address },
                    { label: "SOL", val: w?.sol_address },
                    { label: "TRX", val: w?.trx_address },
                  ].filter((x): x is { label: string; val: string } => Boolean(x.val));

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u.id);
                        setShowUserModal(false);
                        setUserSearch("");
                      }}
                      className={`p-3.5 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50 border-blue-400 shadow-xs"
                          : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">
                              {formatName(u)}
                            </span>
                            {w?.readable_id && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                UID: {w.readable_id}
                              </span>
                            )}
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                          <div className="text-gray-600 text-xs mt-0.5 truncate">
                            {u.email || `User ID: ${u.id}`}
                          </div>
                        </div>

                        {match && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                            Matched {match.field}
                          </span>
                        )}
                      </div>

                      {match?.matchedValue && (
                        <div className="mt-2 px-2.5 py-1 rounded bg-emerald-50/70 border border-emerald-200 font-mono text-[11px] text-emerald-900 break-all">
                          {match.matchedValue}
                        </div>
                      )}

                      {addrChips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {addrChips.map((chip) => (
                            <span
                              key={chip.label}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-[10px] text-gray-700"
                              title={chip.val}
                            >
                              <strong className="text-gray-500">{chip.label}:</strong>
                              <span>{truncateAddress(chip.val, 6, 4)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
