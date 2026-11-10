"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Search,
  X,
  Copy,
  RefreshCw,
  Wallet,
  ShieldCheck,
  Clock,
  XCircle,
  Fuel,
  Lock,
  UserPlus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import {
  DEFAULT_FALLBACK_PRICES,
  extractWalletHoldings,
  formatCryptoAmount,
  formatUsd,
  truncateAddress,
} from "@/lib/admin-tokens";
import { AssetIcon } from "@/components/dashboard/AssetIcon";

interface AdminUserWallet {
  id: string;
  user_id: string;
  readable_id?: string | null;
  wallet_type?: string | null;
  hd_index?: number | null;
  gas_override?: boolean | null;
  created_at?: string | null;
  address?: string | null;
  btc_address?: string | null;
  sol_address?: string | null;
  trx_address?: string | null;
  usdt_erc20_address?: string | null;
  usdt_bep20_address?: string | null;
  usdc_bep20_address?: string | null;
  usdt_trc20_address?: string | null;
  usdc_solana_address?: string | null;
  [key: string]: unknown;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  account_type: string;
  pin_attempts: number;
  is_pin_locked: boolean;
  has_pin: boolean;
  created_at: string;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  kyc_status: string;
  tx_count: number;
  tx_refs?: string[];
  wallet: AdminUserWallet | null;
}

interface MatchInfo {
  field: string;
  matchedAddressKey?: "evm" | "btc" | "sol" | "trx";
  matchedValue?: string;
}

type FilterTab =
  | "all"
  | "funded"
  | "kyc_approved"
  | "kyc_pending"
  | "gas_override"
  | "pin_locked";

type SortMode = "newest" | "balance_desc" | "tx_desc" | "name_asc";

function getMatchInfo(user: AdminUserRow, rawQuery: string): MatchInfo | null {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return null;

  const w = user.wallet;
  if (w?.address && w.address.toLowerCase().includes(q)) {
    return { field: "EVM Address", matchedAddressKey: "evm", matchedValue: w.address };
  }
  if (w?.btc_address && w.btc_address.toLowerCase().includes(q)) {
    return { field: "BTC Address", matchedAddressKey: "btc", matchedValue: w.btc_address };
  }
  if (w?.sol_address && w.sol_address.toLowerCase().includes(q)) {
    return { field: "SOL Address", matchedAddressKey: "sol", matchedValue: w.sol_address };
  }
  if (w?.trx_address && w.trx_address.toLowerCase().includes(q)) {
    return { field: "TRX Address", matchedAddressKey: "trx", matchedValue: w.trx_address };
  }

  const overrideCols = [
    w?.usdt_erc20_address,
    w?.usdt_bep20_address,
    w?.usdc_bep20_address,
    w?.usdt_trc20_address,
    w?.usdc_solana_address,
  ];
  for (const ov of overrideCols) {
    if (typeof ov === "string" && ov.toLowerCase().includes(q)) {
      return { field: "Token Address", matchedValue: ov };
    }
  }

  if (w?.readable_id && w.readable_id.toLowerCase().includes(q)) {
    return { field: "Account ID", matchedValue: w.readable_id };
  }
  if (user.id.toLowerCase().includes(q)) {
    return { field: "User UUID", matchedValue: user.id };
  }
  if (user.email && user.email.toLowerCase().includes(q)) {
    return { field: "Email", matchedValue: user.email };
  }
  const nameHaystack = [
    user.display_name,
    user.full_name,
    user.first_name,
    user.last_name,
    user.username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (nameHaystack.includes(q)) {
    return { field: "Name" };
  }
  if (user.phone && user.phone.toLowerCase().includes(q)) {
    return { field: "Phone" };
  }
  if (user.country && user.country.toLowerCase().includes(q)) {
    return { field: "Country" };
  }
  if (user.tx_refs?.length) {
    const refMatch = user.tx_refs.find((ref) => ref.toLowerCase().includes(q));
    if (refMatch) {
      return { field: "Tx Reference", matchedValue: refMatch };
    }
  }

  return null;
}

function getInitials(name: string, email: string | null) {
  const cleaned = (name || "").trim();
  if (cleaned && cleaned !== "User") {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

export default function AdminMembersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_FALLBACK_PRICES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const fetchData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setLoadError(null);
      try {
        const [usersRes, pricesRes] = await Promise.all([
          adminFetch("/api/admin/users"),
          fetch("/api/prices", { cache: "no-store" }).catch(() => null),
        ]);

        if (usersRes.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }

        const usersData = await usersRes.json();
        if (!usersRes.ok) {
          throw new Error(usersData.error || "Failed to fetch users");
        }

        setUsers(Array.isArray(usersData.users) ? usersData.users : []);

        if (pricesRes && pricesRes.ok) {
          const livePrices = await pricesRes.json();
          if (livePrices && typeof livePrices === "object") {
            setPrices({ ...DEFAULT_FALLBACK_PRICES, ...livePrices });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load users";
        setLoadError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const { holdings, totalUsd, legacyUsdtBalance } = extractWalletHoldings(
        u.wallet,
        prices
      );
      const match = getMatchInfo(u, searchQuery);
      return {
        ...u,
        holdings,
        totalUsd,
        legacyUsdtBalance,
        match,
      };
    });
  }, [users, prices, searchQuery]);

  const metrics = useMemo(() => {
    let fundedCount = 0;
    let totalPlatformUsd = 0;
    let kycApproved = 0;
    let kycPending = 0;
    let gasOverride = 0;
    let pinLocked = 0;

    for (const u of enrichedUsers) {
      if (u.holdings.length > 0 || u.totalUsd > 0) fundedCount++;
      totalPlatformUsd += u.totalUsd;
      if (u.kyc_status === "approved") kycApproved++;
      else if (u.kyc_status === "pending") kycPending++;
      if (u.wallet?.gas_override) gasOverride++;
      if (u.is_pin_locked) pinLocked++;
    }

    return {
      total: enrichedUsers.length,
      fundedCount,
      totalPlatformUsd,
      kycApproved,
      kycPending,
      gasOverride,
      pinLocked,
    };
  }, [enrichedUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim();
    const list = enrichedUsers.filter((u) => {
      if (activeTab === "funded" && u.holdings.length === 0 && u.totalUsd <= 0) {
        return false;
      }
      if (activeTab === "kyc_approved" && u.kyc_status !== "approved") {
        return false;
      }
      if (activeTab === "kyc_pending" && u.kyc_status !== "pending") {
        return false;
      }
      if (activeTab === "gas_override" && !u.wallet?.gas_override) {
        return false;
      }
      if (activeTab === "pin_locked" && !u.is_pin_locked) {
        return false;
      }

      if (q && !u.match) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === "balance_desc") {
        return b.totalUsd - a.totalUsd || b.tx_count - a.tx_count;
      }
      if (sortMode === "tx_desc") {
        return b.tx_count - a.tx_count || b.totalUsd - a.totalUsd;
      }
      if (sortMode === "name_asc") {
        return a.display_name.localeCompare(b.display_name);
      }
      return (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    });

    return list;
  }, [enrichedUsers, activeTab, searchQuery, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const handleCopy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="w-full max-w-full font-sans text-gray-900 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Users size={24} className="text-blue-600 shrink-0" />
            <span>Manage Users</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Search users by any crypto address (EVM, BTC, SOL, TRX), User UUID, Account ID, email, or name to inspect token balances, transactions, and safe settings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-600" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/members/add"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
          >
            <UserPlus size={14} />
            <span>Add User</span>
          </Link>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "all"
              ? "border-blue-400 ring-1 ring-blue-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Total Users
            </span>
            <span className="text-2xl font-black text-gray-900">{metrics.total}</span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Registered accounts
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("funded");
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "funded"
              ? "border-emerald-400 ring-1 ring-emerald-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Funded Wallets
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {metrics.fundedCount}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5 truncate">
              Est. total {formatUsd(metrics.totalPlatformUsd)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("kyc_approved");
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "kyc_approved"
              ? "border-indigo-400 ring-1 ring-indigo-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              KYC Verified
            </span>
            <span className="text-2xl font-black text-indigo-600">
              {metrics.kycApproved}
            </span>
            <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
              {metrics.kycPending} pending review
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab(metrics.pinLocked > 0 ? "pin_locked" : "gas_override");
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "gas_override" || activeTab === "pin_locked"
              ? "border-amber-400 ring-1 ring-amber-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Gas Bypass ON
            </span>
            <span className="text-2xl font-black text-amber-600">
              {metrics.gasOverride}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              {metrics.pinLocked > 0
                ? `${metrics.pinLocked} PIN locked`
                : "0 PIN locks active"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Fuel size={19} />
          </div>
        </button>
      </div>

      {/* Universal Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-5 space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Paste or type any wallet address (0x..., bc1..., SOL, T...), User UUID, Account ID, email, or name..."
              className="w-full bg-[#f9fafb] border border-gray-200 text-gray-900 text-sm rounded-lg pl-10 pr-9 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 rounded"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Sort by:
            </span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-[#f9fafb] border border-gray-200 text-gray-800 text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">Newest Joined</option>
              <option value="balance_desc">Highest Balance ($)</option>
              <option value="tx_desc">Most Transactions</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: "All Users", count: metrics.total },
                { id: "funded", label: "Has Balance", count: metrics.fundedCount },
                { id: "kyc_approved", label: "KYC Approved", count: metrics.kycApproved },
                { id: "kyc_pending", label: "KYC Pending", count: metrics.kycPending },
                { id: "gas_override", label: "Gas Bypass ON", count: metrics.gasOverride },
                { id: "pin_locked", label: "PIN Locked", count: metrics.pinLocked },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-[11px] font-semibold text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3">
          <span>Error loading users: {loadError}</span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 transition font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={28} />
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Loading users, wallet addresses, and balances...
            </p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Users size={22} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
              No Matching Users
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              {searchQuery || activeTab !== "all"
                ? "No user matches that wallet address, ID, email, or filter."
                : "No users found in the system yet."}
            </p>
            {(searchQuery || activeTab !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                  setCurrentPage(1);
                }}
                className="mt-3 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition"
              >
                Reset Search & Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">System IDs</th>
                    <th className="py-3.5 px-4">Wallet Addresses</th>
                    <th className="py-3.5 px-4">All Token Balances</th>
                    <th className="py-3.5 px-4">Status &amp; Activity</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {paginatedUsers.map((u) => {
                    const addressBadges = [
                      { key: "evm" as const, label: "EVM", addr: u.wallet?.address },
                      { key: "btc" as const, label: "BTC", addr: u.wallet?.btc_address },
                      { key: "sol" as const, label: "SOL", addr: u.wallet?.sol_address },
                      { key: "trx" as const, label: "TRX", addr: u.wallet?.trx_address },
                    ].filter((item) => Boolean(item.addr));

                    const topHoldings = u.holdings.slice(0, 3);
                    const remainingHoldings = Math.max(0, u.holdings.length - 3);

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/90 transition-colors align-top"
                      >
                        {/* User */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          <div className="flex items-start gap-3">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.display_name}
                                className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0 mt-0.5"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {getInitials(u.display_name, u.email)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/admin/members/${u.id}`}
                                className="font-bold text-[13px] text-gray-900 hover:text-blue-600 transition block truncate max-w-[190px]"
                              >
                                {u.display_name}
                              </Link>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className="text-[11px] text-gray-500 truncate max-w-[175px]"
                                  title={u.email || ""}
                                >
                                  {u.email || "No email"}
                                </span>
                                {u.email && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(u.email!, "Email")}
                                    className="text-gray-400 hover:text-blue-600 p-0.5 rounded"
                                    title="Copy email"
                                  >
                                    <Copy size={11} />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-medium">
                                {u.country && <span>{u.country}</span>}
                                {u.country && <span>•</span>}
                                <span>
                                  Joined{" "}
                                  {u.created_at
                                    ? new Date(u.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })
                                    : "N/A"}
                                </span>
                              </div>
                              {u.match && (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                  Matched: {u.match.field}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* System IDs */}
                        <td className="py-3.5 px-4 min-w-[165px]">
                          <div className="space-y-1.5">
                            {u.wallet?.readable_id ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(u.wallet!.readable_id!, "Account UID")
                                }
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 border border-slate-200 text-slate-800 font-mono text-[11px] font-bold transition"
                                title="Click to copy 8-digit Account UID"
                              >
                                <span className="text-[10px] text-slate-400 font-sans uppercase">
                                  UID
                                </span>
                                <span>{u.wallet.readable_id}</span>
                                <Copy size={10} className="text-slate-400" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold">
                                Wallet Not Initialized
                              </span>
                            )}

                            <div>
                              <button
                                type="button"
                                onClick={() => handleCopy(u.id, "User UUID")}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-blue-600 transition"
                                title={`Copy full UUID: ${u.id}`}
                              >
                                <span>{truncateAddress(u.id, 6, 4)}</span>
                                <Copy size={10} />
                              </button>
                            </div>

                            {u.phone && (
                              <div className="text-[10px] text-gray-500 truncate max-w-[140px]">
                                {u.phone}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Wallet Addresses */}
                        <td className="py-3.5 px-4 min-w-[215px]">
                          {addressBadges.length === 0 ? (
                            <span className="text-[11px] text-gray-400 italic">
                              No deposit addresses
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {addressBadges.map((item) => {
                                const isMatched =
                                  u.match?.matchedAddressKey === item.key;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() =>
                                      handleCopy(item.addr!, `${item.label} Address`)
                                    }
                                    title={`Click to copy ${item.label} address:\n${item.addr}`}
                                    className={`inline-flex items-center justify-between gap-2 px-2 py-0.5 rounded border font-mono text-[11px] transition w-full max-w-[205px] ${
                                      isMatched
                                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold ring-1 ring-emerald-200"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                                    }`}
                                  >
                                    <span className="font-sans text-[10px] font-bold text-slate-400 w-7 text-left shrink-0">
                                      {item.label}
                                    </span>
                                    <span className="truncate flex-1 text-left">
                                      {truncateAddress(item.addr, 6, 4)}
                                    </span>
                                    <Copy size={10} className="text-slate-400 shrink-0" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Token Balances & Holdings */}
                        <td className="py-3.5 px-4 min-w-[210px]">
                          <div className="font-bold text-[14px] text-gray-900">
                            {formatUsd(u.totalUsd)}
                          </div>
                          {topHoldings.length === 0 ? (
                            <span className="text-[11px] text-gray-400 mt-0.5 block">
                              Zero balance across 18 tokens
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-[240px]">
                              {topHoldings.map((h) => (
                                <span
                                  key={h.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                                    h.isLegacy
                                      ? "bg-amber-50 border-amber-200 text-amber-800"
                                      : "bg-slate-100 border-slate-200 text-slate-700"
                                  }`}
                                  title={`${h.name}: ${h.balance} (${formatUsd(h.usdValue)})`}
                                >
                                  <AssetIcon
                                    symbol={h.symbol}
                                    size="sm"
                                    className="!w-3.5 !h-3.5"
                                  />
                                  <span>
                                    {formatCryptoAmount(h.balance, 4)} {h.symbol}
                                  </span>
                                  <span className="text-[9px] text-gray-400 font-semibold">
                                    {h.networkShort}
                                  </span>
                                </span>
                              ))}
                              {remainingHoldings > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                                  +{remainingHoldings} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status & Activity */}
                        <td className="py-3.5 px-4 min-w-[165px]">
                          <div className="flex flex-col gap-1.5 items-start">
                            {u.kyc_status === "approved" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={10} /> KYC Verified
                              </span>
                            ) : u.kyc_status === "pending" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={10} /> KYC Pending
                              </span>
                            ) : u.kyc_status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle size={10} /> KYC Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                Unverified
                              </span>
                            )}

                            {u.wallet && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  u.wallet.gas_override
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                <Fuel size={10} />
                                {u.wallet.gas_override ? "Standard Gas" : "3.0 ETH Lock"}
                              </span>
                            )}

                            <div className="flex items-center gap-2 text-[11px] text-gray-500 font-semibold">
                              <span>{u.tx_count} tx</span>
                              {u.is_pin_locked && (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold">
                                  <Lock size={10} /> PIN Locked
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right align-middle whitespace-nowrap">
                          <Link
                            href={`/admin/members/${u.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition shadow-sm"
                          >
                            <span>Manage</span>
                            <ArrowUpRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-[#f8fafc] border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-gray-500 font-semibold">
                Showing {(safePage - 1) * itemsPerPage + 1}–
                {Math.min(safePage * itemsPerPage, filteredUsers.length)} of{" "}
                {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="px-2.5 py-1 font-bold text-gray-700">
                    Page {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
