"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Lock,
  Copy,
  ShieldCheck,
  User,
  Wallet,
  Fuel,
  KeyRound,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  X,
  Trash2,
  Loader2,
  Unlock,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import {
  DEFAULT_FALLBACK_PRICES,
  LEGACY_USDT_BALANCE_COLUMN,
  MANAGED_TOKENS,
  formatCryptoAmount,
  formatTransactionAsset,
  formatUsd,
  getTokenPriceUsd,
  truncateAddress,
} from "@/lib/admin-tokens";
import { AssetIcon } from "@/components/dashboard/AssetIcon";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { formatRelativeTime, type PresenceState, type UserTelemetry } from "@/lib/activity";
import {
  CancelTransactionModal,
  type AdminTransactionItem,
} from "@/components/admin/CancelTransactionModal";

interface KycDetail {
  id: string;
  status: string;
  country?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AdminUserDetail {
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
  has_recovery_phrase: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  account_status?: "active" | "suspended" | "blocked";
  presence?: PresenceState;
  telemetry?: UserTelemetry | null;
  country_code?: string | null;
  kyc_status: string;
  kyc: KycDetail | null;
}

interface AdminWalletDetail {
  id: string;
  user_id: string;
  readable_id: string | null;
  wallet_type: string;
  hd_index: number | null;
  gas_override: boolean;
  created_at: string | null;
  addresses: {
    evm: string | null;
    btc: string | null;
    sol: string | null;
    trx: string | null;
    usdt_erc20_override?: string | null;
    usdt_bep20_override?: string | null;
    usdc_bep20_override?: string | null;
    usdt_trc20_override?: string | null;
    usdc_solana_override?: string | null;
  };
  balances: Record<string, number>;
}

interface ProfileFormState {
  full_name: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  country: string;
}

type TxFilterTab = "all" | "deposit" | "withdrawal" | "pending" | "completed" | "failed";

function formatTimestamp(ts?: string | null): string {
  if (!ts) return "Never / N/A";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name: string, email: string | null): string {
  const cleaned = (name || "").trim();
  if (cleaned && cleaned !== "User") {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

function isWithdrawalTx(tx: AdminTransactionItem): boolean {
  const t = String(tx.type || "").toLowerCase();
  return t === "withdrawal" || t === "send" || t === "transfer" || Number(tx.amount || 0) < 0;
}

export default function ManageSingleUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [serverUser, setServerUser] = useState<AdminUserDetail | null>(null);
  const [serverWallet, setServerWallet] = useState<AdminWalletDetail | null>(null);
  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_FALLBACK_PRICES);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlockingPin, setUnlockingPin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable Form States
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    full_name: "",
    first_name: "",
    last_name: "",
    username: "",
    phone: "",
    country: "",
  });
  const [kycStatus, setKycStatus] = useState<string>("unverified");
  const [gasOverride, setGasOverride] = useState<boolean>(false);
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});

  // UI filters for Balances & Transactions
  const [balanceView, setBalanceView] = useState<"all" | "nonzero">("all");
  const [tokenSearch, setTokenSearch] = useState("");
  const [txFilter, setTxFilter] = useState<TxFilterTab>("all");
  const [txSearch, setTxSearch] = useState("");

  // Cancel & Wipe modal state
  const [cancelTarget, setCancelTarget] = useState<AdminTransactionItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const hydrateFromPayload = useCallback(
    (u: AdminUserDetail, w: AdminWalletDetail | null, txs: AdminTransactionItem[]) => {
      setServerUser(u);
      setServerWallet(w);
      setTransactions(txs);

      setProfileForm({
        full_name: u.full_name || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        username: u.username || "",
        phone: u.phone || "",
        country: u.country || "",
      });
      setKycStatus(u.kyc_status || "unverified");
      setGasOverride(Boolean(w?.gas_override));

      const nextInputs: Record<string, string> = {};
      for (const token of MANAGED_TOKENS) {
        const val = w?.balances?.[token.balanceColumn] ?? 0;
        nextInputs[token.balanceColumn] = String(val);
      }
      nextInputs[LEGACY_USDT_BALANCE_COLUMN] = String(
        w?.balances?.[LEGACY_USDT_BALANCE_COLUMN] ?? 0
      );
      setBalanceInputs(nextInputs);
    },
    []
  );

  const fetchUserDetail = useCallback(
    async (isManual = false) => {
      if (!userId) return;
      if (isManual) setRefreshing(true);
      setLoadError(null);
      try {
        const [userRes, pricesRes] = await Promise.all([
          adminFetch(`/api/admin/users/${userId}`),
          fetch("/api/prices", { cache: "no-store" }).catch(() => null),
        ]);

        if (userRes.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }

        const data = await userRes.json();
        if (!userRes.ok) {
          throw new Error(data.error || "Failed to load user details");
        }

        hydrateFromPayload(
          data.user,
          data.wallet || null,
          Array.isArray(data.transactions) ? data.transactions : []
        );

        if (pricesRes && pricesRes.ok) {
          const livePrices = await pricesRes.json();
          if (livePrices && typeof livePrices === "object") {
            setPrices({ ...DEFAULT_FALLBACK_PRICES, ...livePrices });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load user";
        setLoadError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, router, hydrateFromPayload]
  );

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  const handleCopy = (value: string | null | undefined, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  // Track which fields changed
  const diffSummary = useMemo(() => {
    if (!serverUser) {
      return {
        hasChanges: false,
        changedProfileKeys: [] as string[],
        changedKyc: false,
        changedGas: false,
        changedBalanceCols: [] as string[],
        totalChanges: 0,
      };
    }

    const changedProfileKeys: string[] = [];
    const norm = (s: string) => s.trim();
    if (norm(profileForm.full_name) !== norm(serverUser.full_name || ""))
      changedProfileKeys.push("full_name");
    if (norm(profileForm.first_name) !== norm(serverUser.first_name || ""))
      changedProfileKeys.push("first_name");
    if (norm(profileForm.last_name) !== norm(serverUser.last_name || ""))
      changedProfileKeys.push("last_name");
    if (norm(profileForm.username) !== norm(serverUser.username || ""))
      changedProfileKeys.push("username");
    if (norm(profileForm.phone) !== norm(serverUser.phone || ""))
      changedProfileKeys.push("phone");
    if (norm(profileForm.country) !== norm(serverUser.country || ""))
      changedProfileKeys.push("country");

    const changedKyc = kycStatus !== (serverUser.kyc_status || "unverified");
    const changedGas =
      Boolean(serverWallet) && gasOverride !== Boolean(serverWallet?.gas_override);

    const changedBalanceCols: string[] = [];
    if (serverWallet) {
      const allCols = [
        ...MANAGED_TOKENS.map((t) => t.balanceColumn),
        LEGACY_USDT_BALANCE_COLUMN,
      ];
      for (const col of allCols) {
        const orig = Number(serverWallet.balances[col] ?? 0);
        const raw = (balanceInputs[col] ?? "").trim();
        const curr = raw === "" ? NaN : Number(raw);
        if (raw === "" || Number.isNaN(curr) || curr !== orig) {
          changedBalanceCols.push(col);
        }
      }
    }

    const totalChanges =
      changedProfileKeys.length +
      (changedKyc ? 1 : 0) +
      (changedGas ? 1 : 0) +
      changedBalanceCols.length;

    return {
      hasChanges: totalChanges > 0,
      changedProfileKeys,
      changedKyc,
      changedGas,
      changedBalanceCols,
      totalChanges,
    };
  }, [serverUser, serverWallet, profileForm, kycStatus, gasOverride, balanceInputs]);

  const handleDiscardChanges = () => {
    if (!serverUser) return;
    hydrateFromPayload(serverUser, serverWallet, transactions);
    toast.info("Unsaved edits reverted");
  };

  const handleSaveChanges = async () => {
    if (!serverUser || !diffSummary.hasChanges) return;

    // Validate all edited balance inputs first
    const balancesToUpdate: Record<string, number> = {};
    for (const col of diffSummary.changedBalanceCols) {
      const raw = (balanceInputs[col] ?? "").trim();
      const parsed = Number(raw);
      if (raw === "" || !Number.isFinite(parsed) || parsed < 0) {
        const tokenMeta = MANAGED_TOKENS.find((t) => t.balanceColumn === col);
        toast.error(
          `Please enter a valid non-negative number for ${
            tokenMeta ? `${tokenMeta.name}` : "Legacy USDT"
          }.`
        );
        return;
      }
      balancesToUpdate[col] = parsed;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};

      if (diffSummary.changedProfileKeys.length > 0) {
        const profilePayload: Record<string, string> = {};
        for (const key of diffSummary.changedProfileKeys) {
          profilePayload[key] = profileForm[key as keyof ProfileFormState];
        }
        payload.profile = profilePayload;
      }

      if (diffSummary.changedKyc) {
        payload.kyc_status = kycStatus;
      }

      if (serverWallet && (diffSummary.changedGas || Object.keys(balancesToUpdate).length > 0)) {
        const walletPayload: Record<string, unknown> = {};
        if (diffSummary.changedGas) {
          walletPayload.gas_override = gasOverride;
        }
        if (Object.keys(balancesToUpdate).length > 0) {
          walletPayload.balances = balancesToUpdate;
        }
        payload.wallet = walletPayload;
      }

      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save changes");
      }

      toast.success("User details & wallet changes saved");
      await fetchUserDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save user changes";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockPin = async () => {
    if (!serverUser) return;
    setUnlockingPin(true);
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { unlock_pin: true },
        }),
      });
      if (res.status === 401) {
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlock PIN");
      }
      toast.success("Transaction PIN unlocked and failed attempts reset to 0");
      await fetchUserDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error unlocking PIN";
      toast.error(msg);
    } finally {
      setUnlockingPin(false);
    }
  };

  const handleConfirmCancelTx = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.id);
    try {
      const res = await adminFetch("/api/admin/transactions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: cancelTarget.id }),
      });

      if (res.status === 401) {
        setCancelTarget(null);
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel transaction");
      }

      toast.success(
        data.balanceAdjusted
          ? "Transaction cancelled, wiped from history, and wallet balance adjusted."
          : "Transaction cleared from history."
      );
      setCancelTarget(null);
      await fetchUserDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cancelling transaction";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  // Portfolio live stats across all 18 tokens (+ legacy USDT if present)
  const portfolioStats = useMemo(() => {
    let totalUsd = 0;
    let nonZeroCount = 0;

    for (const token of MANAGED_TOKENS) {
      const qty = Number(balanceInputs[token.balanceColumn] ?? 0);
      if (Number.isFinite(qty) && qty > 0) {
        nonZeroCount++;
        const price = getTokenPriceUsd(token.priceKey, prices);
        totalUsd += qty * price;
      }
    }

    const legacyUsdt = Number(balanceInputs[LEGACY_USDT_BALANCE_COLUMN] ?? 0);
    const serverLegacyUsdt = Number(
      serverWallet?.balances?.[LEGACY_USDT_BALANCE_COLUMN] ?? 0
    );
    if (Number.isFinite(legacyUsdt) && legacyUsdt > 0) {
      totalUsd += legacyUsdt * getTokenPriceUsd("USDT", prices);
    }

    return {
      totalUsd,
      nonZeroCount,
      hasLegacyUsdt: serverLegacyUsdt > 0 || legacyUsdt > 0,
    };
  }, [balanceInputs, prices, serverWallet]);

  const visibleTokens = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    return MANAGED_TOKENS.filter((token) => {
      if (balanceView === "nonzero") {
        const currentQty = Number(balanceInputs[token.balanceColumn] ?? 0);
        const origQty = Number(serverWallet?.balances?.[token.balanceColumn] ?? 0);
        if (currentQty <= 0 && origQty <= 0) return false;
      }
      if (q) {
        const match =
          token.id.toLowerCase().includes(q) ||
          token.symbol.toLowerCase().includes(q) ||
          token.name.toLowerCase().includes(q) ||
          token.network.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [balanceView, tokenSearch, balanceInputs, serverWallet]);

  const txStats = useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    let pending = 0;
    let completed = 0;
    let failed = 0;

    for (const tx of transactions) {
      if (isWithdrawalTx(tx)) withdrawals++;
      else deposits++;

      const s = String(tx.status || "pending").toLowerCase();
      if (s === "pending" || s === "processing") pending++;
      else if (s === "completed" || s === "approved" || s === "success") completed++;
      else failed++;
    }

    return { total: transactions.length, deposits, withdrawals, pending, completed, failed };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      const isWith = isWithdrawalTx(tx);
      const s = String(tx.status || "pending").toLowerCase();

      if (txFilter === "deposit" && isWith) return false;
      if (txFilter === "withdrawal" && !isWith) return false;
      if (txFilter === "pending" && s !== "pending" && s !== "processing") return false;
      if (
        txFilter === "completed" &&
        s !== "completed" &&
        s !== "approved" &&
        s !== "success"
      )
        return false;
      if (
        txFilter === "failed" &&
        s !== "failed" &&
        s !== "rejected" &&
        s !== "cancelled"
      )
        return false;

      if (q) {
        const asset = formatTransactionAsset(tx.currency);
        const haystack = [
          tx.id,
          tx.currency,
          asset.token,
          asset.network,
          tx.type,
          tx.status,
          tx.to_address,
          tx.from_address,
          tx.tx_hash,
          tx.description,
          String(tx.amount),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, txFilter, txSearch]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={30} />
        <p className="text-sm font-semibold">Loading user profile, wallet &amp; transactions...</p>
      </div>
    );
  }

  if (loadError || !serverUser) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white border border-rose-200 rounded-xl p-6 shadow-sm text-center space-y-3">
          <AlertCircle size={32} className="text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Unable to Load User</h2>
          <p className="text-sm text-rose-600 font-medium">
            {loadError || "User record not found."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/admin/members"
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition"
            >
              Back to Manage Users
            </Link>
            <button
              type="button"
              onClick={() => fetchUserDetail(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cancelMeta = cancelTarget
    ? formatTransactionAsset(cancelTarget.currency)
    : { token: "", network: "" };
  const cancelTargetWithProfile: AdminTransactionItem | null = cancelTarget
    ? {
        ...cancelTarget,
        profiles: {
          first_name: serverUser.first_name,
          last_name: serverUser.last_name,
          full_name: serverUser.full_name,
          email: serverUser.email,
          avatar_url: serverUser.avatar_url,
        },
      }
    : null;

  const addressItems = serverWallet
    ? [
        {
          label: "Ethereum / EVM Networks",
          sub: "ETH · BNB (BEP20) · MATIC · AVAX · ERC20 / BEP20 Tokens",
          value: serverWallet.addresses.evm,
        },
        {
          label: "Bitcoin Network",
          sub: "BTC",
          value: serverWallet.addresses.btc,
        },
        {
          label: "Solana Network",
          sub: "SOL · USDT (Solana) · USDC (Solana)",
          value: serverWallet.addresses.sol,
        },
        {
          label: "Tron Network",
          sub: "TRX · USDT (TRC20)",
          value: serverWallet.addresses.trx,
        },
        ...(serverWallet.addresses.usdt_erc20_override &&
        serverWallet.addresses.usdt_erc20_override !== serverWallet.addresses.evm
          ? [
              {
                label: "USDT (ERC-20) Custom Override",
                sub: "Legacy per-token address override",
                value: serverWallet.addresses.usdt_erc20_override,
              },
            ]
          : []),
        ...(serverWallet.addresses.usdt_bep20_override &&
        serverWallet.addresses.usdt_bep20_override !== serverWallet.addresses.evm
          ? [
              {
                label: "USDT (BEP-20) Custom Override",
                sub: "Legacy per-token address override",
                value: serverWallet.addresses.usdt_bep20_override,
              },
            ]
          : []),
        ...(serverWallet.addresses.usdc_bep20_override &&
        serverWallet.addresses.usdc_bep20_override !== serverWallet.addresses.evm
          ? [
              {
                label: "USDC (BEP-20) Custom Override",
                sub: "Legacy per-token address override",
                value: serverWallet.addresses.usdc_bep20_override,
              },
            ]
          : []),
        ...(serverWallet.addresses.usdt_trc20_override &&
        serverWallet.addresses.usdt_trc20_override !== serverWallet.addresses.trx
          ? [
              {
                label: "USDT (TRC-20) Custom Override",
                sub: "Legacy per-token address override",
                value: serverWallet.addresses.usdt_trc20_override,
              },
            ]
          : []),
        ...(serverWallet.addresses.usdc_solana_override &&
        serverWallet.addresses.usdc_solana_override !== serverWallet.addresses.sol
          ? [
              {
                label: "USDC (Solana) Custom Override",
                sub: "Legacy per-token address override",
                value: serverWallet.addresses.usdc_solana_override,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="w-full max-w-7xl mx-auto pb-20 text-gray-900 font-sans animate-in fade-in duration-300">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-5 py-3.5 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            href="/admin/members"
            className="w-9 h-9 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 flex items-center justify-center transition shrink-0"
            title="Back to Manage Users"
          >
            <ArrowLeft size={16} />
          </Link>

          {serverUser.avatar_url ? (
            <img
              src={serverUser.avatar_url}
              alt={serverUser.display_name}
              className="w-11 h-11 rounded-full object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {getInitials(serverUser.display_name, serverUser.email)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {serverUser.display_name}
              </h1>
              {serverWallet?.readable_id && (
                <button
                  type="button"
                  onClick={() => handleCopy(serverWallet.readable_id, "Account UID")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold transition"
                >
                  UID: {serverWallet.readable_id}
                  <Copy size={10} />
                </button>
              )}
              {kycStatus === "approved" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase">
                  <CheckCircle2 size={10} /> Verified
                </span>
              ) : kycStatus === "pending" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase">
                  <Clock size={10} /> KYC Pending
                </span>
              ) : kycStatus === "rejected" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase">
                  <XCircle size={10} /> KYC Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-bold uppercase">
                  Unverified
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span className="truncate">{serverUser.email || "No email"}</span>
              <span>·</span>
              <span>
                Est. Portfolio{" "}
                <span className="font-bold text-gray-800">
                  {formatUsd(portfolioStats.totalUsd)}
                </span>
              </span>
              {(serverUser.telemetry?.countryName ||
                serverUser.telemetry?.countryCode ||
                serverUser.country ||
                serverUser.country_code) && (
                <>
                  <span>·</span>
                  <CountryFlag
                    countryCode={
                      serverUser.telemetry?.countryCode || serverUser.country_code
                    }
                    countryName={
                      serverUser.telemetry?.countryName || serverUser.country
                    }
                    city={serverUser.telemetry?.city}
                    size="sm"
                    textClassName="text-xs font-semibold text-gray-700"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          {diffSummary.hasChanges && (
            <>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                {diffSummary.totalChanges} unsaved change
                {diffSummary.totalChanges === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition disabled:opacity-50"
              >
                Discard
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => fetchUserDetail(true)}
            disabled={refreshing || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-600" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={!diffSummary.hasChanges || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: PROTECTED SYSTEM & BLOCKCHAIN IDENTITY (READ-ONLY) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Protected System IDs &amp; On-Chain Addresses
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-amber-200">
              <Lock size={11} />
              Read-Only · Cannot Be Tampered
            </span>
          </div>

          <div className="p-5 space-y-5">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
              User UUIDs, 8-digit Account UIDs, registered login emails, wallet architecture metadata, and on-chain deposit addresses are cryptographically or relationally bound and locked here to prevent broken logins or misrouted user deposits. Private keys, PIN hashes, and recovery phrases are strictly hidden and excluded.
            </p>

            {/* Immutable System Identity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                  <span>User UUID (Primary ID)</span>
                  <Lock size={11} className="text-slate-400" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-800 truncate">
                    {serverUser.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(serverUser.id, "User UUID")}
                    className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 shrink-0"
                    title="Copy UUID"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                  <span>Registered Login Email</span>
                  <Lock size={11} className="text-slate-400" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {serverUser.email || "Not set"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        serverUser.email_confirmed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {serverUser.email_confirmed ? "Confirmed" : "Unconfirmed"}
                    </span>
                    {serverUser.email && (
                      <button
                        type="button"
                        onClick={() => handleCopy(serverUser.email, "Email")}
                        className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                  <span>Account UID &amp; Wallet Info</span>
                  <Lock size={11} className="text-slate-400" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {serverWallet?.readable_id || "Wallet Not Created"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {serverWallet && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                        {serverWallet.wallet_type}
                        {typeof serverWallet.hd_index === "number"
                          ? ` #${serverWallet.hd_index}`
                          : ""}
                      </span>
                    )}
                    {serverWallet?.readable_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(serverWallet.readable_id, "Account UID")}
                        className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Account Created
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  {formatTimestamp(serverUser.created_at)}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Last Sign-In
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  {formatTimestamp(serverUser.last_sign_in_at)}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                  <span>Secrets &amp; Custody Protection</span>
                  <Lock size={11} className="text-slate-400" />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
                  <span
                    className={`px-2 py-0.5 rounded ${
                      serverUser.has_pin
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    PIN: {serverUser.has_pin ? "Set (Protected)" : "Not Set"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      serverUser.has_recovery_phrase
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    Seed Phrase:{" "}
                    {serverUser.has_recovery_phrase ? "Encrypted / Hidden" : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Live IP, Geo Location & Session Telemetry Strip */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      serverUser.presence === "online"
                        ? "bg-emerald-500 animate-pulse"
                        : serverUser.presence === "idle"
                        ? "bg-amber-400"
                        : "bg-gray-400"
                    }`}
                  />
                  <span>Live Visitor &amp; IP Session Telemetry</span>
                </div>
                <Link
                  href="/admin/ip-config"
                  className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Open IP &amp; Security Console <ExternalLink size={11} />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Current Status &amp; Section
                  </div>
                  <div className="font-bold text-slate-900">
                    {serverUser.presence === "online"
                      ? "Online Now"
                      : serverUser.presence === "idle"
                      ? "Idle (Recent)"
                      : "Offline"}
                    {serverUser.telemetry?.lastActiveAt
                      ? ` · ${formatRelativeTime(serverUser.telemetry.lastActiveAt)}`
                      : ""}
                  </div>
                  <div className="text-[11px] text-blue-700 font-semibold mt-0.5 truncate">
                    {serverUser.telemetry?.currentSection || "No section logged yet"}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Last Known IP Address
                  </div>
                  {serverUser.telemetry?.ip || serverUser.telemetry?.loginIp ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-blue-700 truncate">
                        {serverUser.telemetry.ip || serverUser.telemetry.loginIp}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            serverUser.telemetry!.ip || serverUser.telemetry!.loginIp,
                            "IP Address"
                          )
                        }
                        className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 shrink-0"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Awaiting next login</span>
                  )}
                  {serverUser.telemetry?.device && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {serverUser.telemetry.device}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Country &amp; City
                  </div>
                  <CountryFlag
                    countryCode={
                      serverUser.telemetry?.countryCode || serverUser.country_code
                    }
                    countryName={
                      serverUser.telemetry?.countryName || serverUser.country
                    }
                    city={serverUser.telemetry?.city}
                    size="md"
                    showCode
                    fallbackLabel="Not captured yet"
                    textClassName="font-bold text-slate-800 text-xs"
                  />
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Access &amp; IP History
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        serverUser.account_status === "blocked"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : serverUser.account_status === "suspended"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {serverUser.account_status || "active"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {serverUser.telemetry?.ipHistory?.length || 0} IP event
                      {(serverUser.telemetry?.ipHistory?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Read-Only Deposit Addresses */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <KeyRound size={13} />
                On-Chain Deposit Addresses (Read-Only)
              </h3>

              {!serverWallet ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                  This user has not completed wallet initialization yet, so no deposit addresses exist.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {addressItems.map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800">{item.label}</div>
                        <div className="text-[10px] text-slate-500 font-medium mb-1">
                          {item.sub}
                        </div>
                        <div className="font-mono text-xs text-slate-700 break-all">
                          {item.value || "Not generated"}
                        </div>
                      </div>
                      {item.value && (
                        <button
                          type="button"
                          onClick={() => handleCopy(item.value, `${item.label} Address`)}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition shrink-0"
                          title="Copy address"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: EDITABLE PROFILE DETAILS & SAFE CONTROLS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editable Profile Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                  Editable Profile Information
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600">
                Safe to Edit
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, full_name: e.target.value }))
                  }
                  placeholder="e.g. Alex Morgan"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Shown on the user&apos;s Settings and Profile screens.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, first_name: e.target.value }))
                  }
                  placeholder="First name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, last_name: e.target.value }))
                  }
                  placeholder="Last name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, username: e.target.value }))
                  }
                  placeholder="Optional handle"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+1 ..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Country / Region
                </label>
                <input
                  type="text"
                  value={profileForm.country}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, country: e.target.value }))
                  }
                  placeholder="e.g. France, United States"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            </div>
          </div>

          {/* Account Controls: KYC, Gas Fees, PIN Lock */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                  KYC, Gas Fees &amp; Security Controls
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-indigo-600">
                Live Account State
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* KYC Verification */}
              <div className="p-4 rounded-xl border border-gray-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                    KYC Verification Status
                  </label>
                  <select
                    value={kycStatus}
                    onChange={(e) => setKycStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 bg-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="pending">Pending Review</option>
                    <option value="approved">Approved (Verified L1)</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {serverUser.kyc ? (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/80 text-[11px] text-gray-600">
                    <span>
                      Submitted Doc:{" "}
                      <strong className="text-gray-800">
                        {serverUser.kyc.document_type || "ID"}
                      </strong>
                      {serverUser.kyc.document_number &&
                      serverUser.kyc.document_number !== "Admin Update"
                        ? ` (#${serverUser.kyc.document_number})`
                        : ""}
                    </span>
                    {serverUser.kyc.image_url && (
                      <a
                        href={serverUser.kyc.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
                      >
                        View ID Photo <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    No KYC document uploaded by user yet.
                  </p>
                )}
              </div>

              {/* Gas Override */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <Fuel size={14} className="text-amber-700" />
                    <span>Bypass Network Gas Fees (Gas Override)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                    {serverWallet
                      ? gasOverride
                        ? "Enabled: User gets normal standard gas fees (pennies) on withdrawals."
                        : "Disabled: User is in locked 3.0 ETH gas mode on withdrawals."
                      : "Unavailable until user initializes their wallet."}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={gasOverride}
                  disabled={!serverWallet}
                  onClick={() => setGasOverride((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                    gasOverride ? "bg-emerald-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      gasOverride ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Transaction PIN Lock Reset */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  serverUser.is_pin_locked || serverUser.pin_attempts > 0
                    ? "border-rose-200 bg-rose-50"
                    : "border-gray-200 bg-slate-50/70"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    {serverUser.is_pin_locked ? (
                      <Lock size={14} className="text-rose-600" />
                    ) : (
                      <Unlock size={14} className="text-emerald-600" />
                    )}
                    <span>Transaction PIN Lock Status</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    {serverUser.is_pin_locked
                      ? `LOCKED after ${serverUser.pin_attempts} failed attempts. User cannot sign transactions until unlocked.`
                      : serverUser.pin_attempts > 0
                      ? `Unlocked (${serverUser.pin_attempts} failed PIN attempts recorded).`
                      : "Healthy · Unlocked with 0 failed PIN attempts."}
                  </p>
                </div>

                {(serverUser.is_pin_locked || serverUser.pin_attempts > 0) && (
                  <button
                    type="button"
                    onClick={handleUnlockPin}
                    disabled={unlockingPin}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm shrink-0 disabled:opacity-60"
                  >
                    {unlockingPin ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Unlock size={13} />
                    )}
                    <span>Unlock PIN</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ALL TOKEN BALANCES ACROSS ALL 18 NETWORKS */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-[#f8fafc] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Wallet size={17} className="text-emerald-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                  All Token Balances (18 Assets)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  Est. Total {formatUsd(portfolioStats.totalUsd)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Direct balance updates apply immediately to the user&apos;s wallet without creating a deposit history record. To log a deposit entry, use{" "}
                <Link href="/admin/add-funds" className="text-blue-600 hover:underline font-semibold">
                  Fund Accounts
                </Link>
                .
              </p>
            </div>

            {serverWallet && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    placeholder="Filter token or network..."
                    className="bg-white border border-gray-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 w-48"
                  />
                  {tokenSearch && (
                    <button
                      type="button"
                      onClick={() => setTokenSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setBalanceView("all")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      balanceView === "all"
                        ? "bg-slate-900 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    All (18)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceView("nonzero")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      balanceView === "nonzero"
                        ? "bg-emerald-600 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Non-Zero ({portfolioStats.nonZeroCount})
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-5">
            {!serverWallet ? (
              <div className="p-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center">
                <Wallet size={28} className="text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-800">
                  Wallet Not Initialized Yet
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  This user registered an account but has not generated or imported a multi-chain wallet yet. Balances can be edited once their wallet is created.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {portfolioStats.hasLegacyUsdt && (
                  <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-bold uppercase">
                          Legacy Sync Column
                        </span>
                        <h4 className="text-xs font-bold text-amber-950">
                          USDT (Legacy Sync Balance — `usdt_balance`)
                        </h4>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1">
                        This account holds funds on the legacy <code>usdt_balance</code> column alongside standard token columns. You can review or adjust it here.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={balanceInputs[LEGACY_USDT_BALANCE_COLUMN] ?? "0"}
                        onChange={(e) =>
                          setBalanceInputs((prev) => ({
                            ...prev,
                            [LEGACY_USDT_BALANCE_COLUMN]: e.target.value,
                          }))
                        }
                        className="w-40 border border-amber-300 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-gray-900 outline-none focus:border-blue-500"
                      />
                      <span className="text-xs font-bold text-amber-900">USDT</span>
                    </div>
                  </div>
                )}

                {visibleTokens.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-500">
                    No tokens match the current filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {visibleTokens.map((token) => {
                      const rawInput = balanceInputs[token.balanceColumn] ?? "0";
                      const numericVal = Number(rawInput);
                      const origVal = Number(
                        serverWallet.balances[token.balanceColumn] ?? 0
                      );
                      const isModified =
                        rawInput.trim() === "" ||
                        !Number.isFinite(numericVal) ||
                        numericVal !== origVal;
                      const unitPrice = getTokenPriceUsd(token.priceKey, prices);
                      const estUsd =
                        Number.isFinite(numericVal) && numericVal > 0
                          ? numericVal * unitPrice
                          : 0;

                      return (
                        <div
                          key={token.id}
                          className={`p-3.5 rounded-xl border transition ${
                            isModified
                              ? "border-blue-400 bg-blue-50/40 ring-1 ring-blue-100"
                              : Number(origVal) > 0
                              ? "border-emerald-200 bg-emerald-50/20"
                              : "border-gray-200 bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-xs">
                                <AssetIcon symbol={token.symbol} size="sm" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 truncate">
                                  {token.name}
                                </div>
                                <div className="text-[10px] font-semibold text-gray-500">
                                  {token.network}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-gray-900">
                                {formatUsd(estUsd)}
                              </div>
                              <div className="text-[10px] text-gray-400 font-medium">
                                @ {formatUsd(unitPrice)}
                              </div>
                            </div>
                          </div>

                          <div className="relative flex items-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={rawInput}
                              onChange={(e) =>
                                setBalanceInputs((prev) => ({
                                  ...prev,
                                  [token.balanceColumn]: e.target.value,
                                }))
                              }
                              className="w-full border border-gray-300 bg-white rounded-lg pl-3 pr-16 py-2 text-sm font-mono font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                            />
                            <span className="absolute right-3 text-[11px] font-bold text-gray-400 pointer-events-none">
                              {token.symbol}
                            </span>
                          </div>

                          {isModified && (
                            <div className="flex items-center justify-between mt-1.5 text-[10px]">
                              <span className="font-bold text-blue-700">
                                Was {formatCryptoAmount(origVal, 6)} {token.symbol}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setBalanceInputs((prev) => ({
                                    ...prev,
                                    [token.balanceColumn]: String(origVal),
                                  }))
                                }
                                className="inline-flex items-center gap-0.5 text-gray-600 hover:text-gray-900 font-bold"
                              >
                                <RotateCcw size={10} /> Reset
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: USER TRANSACTION HISTORY */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-[#f8fafc] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <History size={17} className="text-blue-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                  User Transaction History
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                  {txStats.total} Total
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {txStats.deposits} deposit{txStats.deposits === 1 ? "" : "s"} ·{" "}
                {txStats.withdrawals} withdrawal{txStats.withdrawals === 1 ? "" : "s"} ·{" "}
                {txStats.pending} pending
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search tx hash, address, token..."
                  className="bg-white border border-gray-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 w-56"
                />
                {txSearch && (
                  <button
                    type="button"
                    onClick={() => setTxSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: "all", label: `All (${txStats.total})` },
                    { id: "deposit", label: `Deposits (${txStats.deposits})` },
                    { id: "withdrawal", label: `Withdrawals (${txStats.withdrawals})` },
                    { id: "pending", label: `Pending (${txStats.pending})` },
                    { id: "completed", label: `Completed (${txStats.completed})` },
                    { id: "failed", label: `Failed (${txStats.failed})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTxFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap ${
                      txFilter === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-gray-500">
              {transactions.length === 0
                ? "This user has no recorded transactions yet."
                : "No transactions match your filter criteria."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Asset / Network</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Counterparty &amp; Hash</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredTransactions.map((tx) => {
                    const isWith = isWithdrawalTx(tx);
                    const absAmt = Math.abs(Number(tx.amount || 0));
                    const { token, network } = formatTransactionAsset(tx.currency);
                    const estUsd = absAmt * getTokenPriceUsd(token, prices);
                    const statusNorm = String(tx.status || "pending").toLowerCase();
                    const isSuccess =
                      statusNorm === "completed" ||
                      statusNorm === "approved" ||
                      statusNorm === "success";
                    const isPending =
                      statusNorm === "pending" || statusNorm === "processing";
                    const addressVal = isWith
                      ? tx.to_address || tx.from_address
                      : tx.from_address || tx.to_address;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">
                            {new Date(tx.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {new Date(tx.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isWith ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold uppercase">
                              <ArrowUpRight size={12} />
                              Withdrawal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase">
                              <ArrowDownLeft size={12} />
                              Deposit
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                              <AssetIcon
                                symbol={token === "USD" ? "USDT" : token}
                                size="sm"
                                className="!w-5 !h-5"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{token}</div>
                              <div className="text-[10px] text-gray-500 font-medium">
                                {network}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div
                            className={`font-bold text-sm font-mono ${
                              isWith ? "text-rose-700" : "text-emerald-700"
                            }`}
                          >
                            {isWith ? "-" : "+"}
                            {formatCryptoAmount(absAmt, 6)} {token}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            {token === "USD" ? `$${absAmt.toFixed(2)}` : `~ ${formatUsd(estUsd)}`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 min-w-[200px] max-w-[260px]">
                          <div className="space-y-1">
                            {addressVal ? (
                              <button
                                type="button"
                                onClick={() => handleCopy(addressVal, "Address")}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 border border-slate-200 font-mono text-[11px] text-slate-700"
                                title={addressVal}
                              >
                                <span className="font-sans text-[10px] font-bold text-slate-400">
                                  {isWith ? "TO" : "FROM"}
                                </span>
                                <span>{truncateAddress(addressVal, 7, 5)}</span>
                                <Copy size={10} className="text-slate-400" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">
                                Internal / Admin Entry
                              </span>
                            )}

                            {tx.tx_hash && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(tx.tx_hash, "Tx Hash")}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-blue-600"
                                  title={tx.tx_hash}
                                >
                                  <span>TX: {truncateAddress(tx.tx_hash, 6, 4)}</span>
                                  <Copy size={9} />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${
                              isSuccess
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : isPending
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-rose-50 border-rose-200 text-rose-700"
                            }`}
                          >
                            {isSuccess ? (
                              <CheckCircle2 size={11} />
                            ) : isPending ? (
                              <Clock size={11} />
                            ) : (
                              <XCircle size={11} />
                            )}
                            {tx.status || "pending"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setCancelTarget(tx)}
                            title="Cancel & wipe transaction from history and reverse wallet impact"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600 text-[11px] font-bold transition"
                          >
                            <Trash2 size={12} />
                            <span>Cancel</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Cancel & Wipe Modal */}
      <CancelTransactionModal
        transaction={cancelTargetWithProfile}
        kind={cancelTarget && isWithdrawalTx(cancelTarget) ? "withdrawal" : "deposit"}
        token={cancelMeta.token}
        network={cancelMeta.network}
        displayName={serverUser.display_name}
        isSubmitting={cancellingId !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancelTx}
      />
    </div>
  );
}
