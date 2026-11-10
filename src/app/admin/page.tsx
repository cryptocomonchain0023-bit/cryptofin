"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Box,
  X,
  Activity,
  Globe,
  RefreshCw,
  ArrowRight,
  Copy,
  Monitor,
  Smartphone,
  ShieldCheck,
  Wallet,
  History,
  TrendingUp,
  KeyRound,
  LifeBuoy,
  Compass,
  Clock,
  ExternalLink,
  Wifi,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-client";
import { CountryFlag } from "@/components/ui/CountryFlag";
import {
  formatFullTimestamp,
  formatRelativeTime,
  resolveSiteSection,
  type PresenceState,
  type SectionCategory,
  type UserTelemetry,
} from "@/lib/activity";

const supabase = createClient();

interface DashboardUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string;
  avatar_url: string | null;
  readable_id: string | null;
  profile_country: string | null;
  profile_country_code: string | null;
  is_admin: boolean;
  status: "active" | "suspended" | "blocked";
  created_at: string | null;
  last_sign_in_at: string | null;
  presence: PresenceState;
  telemetry: UserTelemetry | null;
  last_ip: string | null;
  login_ip: string | null;
  last_country: string | null;
  last_country_name: string | null;
  last_city: string | null;
  current_path: string | null;
  current_section: string | null;
  last_active_at: string | null;
  last_login_at: string | null;
  device: string | null;
}

function getSectionCategoryStyle(category: SectionCategory) {
  switch (category) {
    case "wallet":
      return {
        cls: "bg-blue-50 text-blue-700 border-blue-200",
        Icon: Wallet,
      };
    case "activity":
      return {
        cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
        Icon: History,
      };
    case "security":
      return {
        cls: "bg-amber-50 text-amber-800 border-amber-200",
        Icon: ShieldCheck,
      };
    case "markets":
      return {
        cls: "bg-cyan-50 text-cyan-700 border-cyan-200",
        Icon: TrendingUp,
      };
    case "support":
      return {
        cls: "bg-violet-50 text-violet-700 border-violet-200",
        Icon: LifeBuoy,
      };
    case "auth":
      return {
        cls: "bg-slate-100 text-slate-700 border-slate-200",
        Icon: KeyRound,
      };
    default:
      return {
        cls: "bg-gray-100 text-gray-700 border-gray-200",
        Icon: Compass,
      };
  }
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

function isMobileDevice(device?: string | null) {
  if (!device) return false;
  return /iphone|ipad|android|mobile/i.test(device);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    suspendedUsers: 0,
  });

  const [allUsers, setAllUsers] = useState<DashboardUser[]>([]);
  const [txToday, setTxToday] = useState<Record<string, { d: number; w: number }>>({});
  const [txMonth, setTxMonth] = useState<Record<string, { d: number; w: number }>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [presenceTab, setPresenceTab] = useState<"active" | "recent">("active");
  const [showToast, setShowToast] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const greetedRef = useRef(false);

  // Standard display list
  const assetOrder = useMemo(
    () => [
      { id: "btc", name: "Bitcoin (BTC)" },
      { id: "eth", name: "Ethereum (ETH)" },
      { id: "usdt_erc20", name: "USDT (ERC20)" },
      { id: "usdt_trc20", name: "USDT (TRC20)" },
      { id: "usdt_bep20", name: "USDT (BEP20)" },
      { id: "usdc_solana", name: "USDC (Solana)" },
      { id: "usdc_bep20", name: "USDC (BEP20)" },
      { id: "bnb", name: "BNB (BEP20)" },
      { id: "sol", name: "Solana (SOL)" },
      { id: "trx", name: "Tron (TRX)" },
    ],
    []
  );

  const fetchDashboardData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        // Fetch Admin Profile & play voice greeting once on initial mount
        if (!greetedRef.current) {
          greetedRef.current = true;
          const {
            data: { session },
          } = await supabase.auth.getSession();
          let name = "Admin";
          if (session) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name")
              .eq("id", session.user.id)
              .single();
            if (profile?.first_name) {
              name = profile.first_name;
              setAdminName(name);
            }
          }

          try {
            const msg = new SpeechSynthesisUtterance(
              `Good morning ${name}, it's good to have you today.`
            );
            msg.rate = 0.9;
            window.speechSynthesis.speak(msg);
          } catch {
            // SpeechSynthesis blocked or unavailable
          }
        }

        const res = await adminFetch("/api/admin/dashboard");
        if (res.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch dashboard data");
        }

        if (Array.isArray(data.users)) {
          const users: DashboardUser[] = data.users;
          let active = 0;
          let blocked = 0;
          let suspended = 0;
          users.forEach((u) => {
            if (u.status === "blocked") blocked++;
            else if (u.status === "suspended") suspended++;
            else active++;
          });

          setStats({
            totalUsers: users.length,
            activeUsers: active,
            blockedUsers: blocked,
            suspendedUsers: suspended,
          });
          setAllUsers(users);
        }

        if (Array.isArray(data.txs)) {
          const now = new Date();
          const startOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).getTime();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

          const todayAgg: Record<string, { d: number; w: number }> = {};
          const monthAgg: Record<string, { d: number; w: number }> = {};
          assetOrder.forEach((a) => {
            todayAgg[a.id] = { d: 0, w: 0 };
            monthAgg[a.id] = { d: 0, w: 0 };
          });

          data.txs.forEach((tx: any) => {
            if (tx.status !== "completed" && tx.status !== "approved") return;

            const txTime = new Date(tx.created_at).getTime();
            const amt = Number(tx.amount) || 0;
            const isToday = txTime >= startOfDay;
            const isThisMonth = txTime >= startOfMonth;

            const w = (tx.currency || tx.wallet_used || "btc").toLowerCase();

            if (!todayAgg[w]) {
              todayAgg[w] = { d: 0, w: 0 };
              monthAgg[w] = { d: 0, w: 0 };
            }

            if (
              tx.type === "deposit" ||
              tx.type === "crypto_deposit" ||
              tx.type === "admin_deposit"
            ) {
              if (isToday) todayAgg[w].d += amt;
              if (isThisMonth) monthAgg[w].d += amt;
            } else if (
              tx.type === "transfer" ||
              tx.type === "crypto_transfer" ||
              tx.type === "withdrawal"
            ) {
              if (isToday) todayAgg[w].w += amt;
              if (isThisMonth) monthAgg[w].w += amt;
            }
          });

          setTxToday(todayAgg);
          setTxMonth(monthAgg);
        }

        setLastUpdatedAt(new Date());
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assetOrder, router]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDashboardData(false);
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchDashboardData]);

  const visitorSummary = useMemo(() => {
    const nonAdminUsers = allUsers.filter((u) => !u.is_admin);
    const nowMs = Date.now();
    const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;

    const onlineNow = nonAdminUsers.filter((u) => u.presence === "online");
    const idleNow = nonAdminUsers.filter((u) => u.presence === "idle");

    const liveVisitors = [...onlineNow, ...idleNow].sort((a, b) => {
      if (a.presence !== b.presence) {
        return a.presence === "online" ? -1 : 1;
      }
      return (
        new Date(b.last_active_at || 0).getTime() -
        new Date(a.last_active_at || 0).getTime()
      );
    });

    const recentLogins = [...nonAdminUsers]
      .filter((u) => Boolean(u.last_active_at || u.last_sign_in_at))
      .sort((a, b) => {
        const tsA = Math.max(
          new Date(a.last_active_at || 0).getTime(),
          new Date(a.last_sign_in_at || 0).getTime()
        );
        const tsB = Math.max(
          new Date(b.last_active_at || 0).getTime(),
          new Date(b.last_sign_in_at || 0).getTime()
        );
        return tsB - tsA;
      });

    const logins24hCount = nonAdminUsers.filter((u) => {
      const ts = Math.max(
        new Date(u.last_active_at || 0).getTime(),
        new Date(u.last_sign_in_at || 0).getTime()
      );
      return ts >= dayAgoMs;
    }).length;

    // Geo flag breakdown across active visitors, or fallback to all IP-logged users
    const geoSource = liveVisitors.length > 0
      ? liveVisitors
      : recentLogins.filter((u) => u.last_country || u.last_country_name);

    const countryMap = new Map<
      string,
      { code: string | null; name: string; count: number; onlineCount: number }
    >();

    for (const u of geoSource) {
      const code = u.last_country || null;
      const name = u.last_country_name || code || null;
      if (!name) continue;
      const key = (code || name).toUpperCase();
      const existing = countryMap.get(key) || {
        code,
        name,
        count: 0,
        onlineCount: 0,
      };
      existing.count += 1;
      if (u.presence === "online") existing.onlineCount += 1;
      countryMap.set(key, existing);
    }

    const activeCountries = Array.from(countryMap.values()).sort(
      (a, b) => b.onlineCount - a.onlineCount || b.count - a.count
    );

    const ipLoggedCount = nonAdminUsers.filter((u) => Boolean(u.last_ip)).length;

    return {
      onlineCount: onlineNow.length,
      active15mCount: liveVisitors.length,
      logins24hCount,
      ipLoggedCount,
      liveVisitors,
      recentLogins,
      activeCountries,
      isShowingLiveCountries: liveVisitors.some((u) => Boolean(u.last_country || u.last_country_name)),
    };
  }, [allUsers]);

  const handleCopy = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  const formatCryptoAmount = (amt: number, id: string) => {
    const symbol = id.split("_")[0].toUpperCase();
    if (amt === 0) return `0.000 ${symbol}`;
    return `${amt.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${symbol}`;
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-500 font-semibold">Loading dashboard data...</div>
    );
  }

  const summaryRows =
    presenceTab === "active"
      ? visitorSummary.liveVisitors.slice(0, 8)
      : visitorSummary.recentLogins.slice(0, 8);

  return (
    <div className="w-full animate-in fade-in duration-300 relative font-sans text-gray-900">
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 bg-white border border-gray-200 shadow-xl rounded-sm flex items-start gap-3 px-6 py-4 z-50 w-max max-w-full animate-in slide-in-from-top-4">
          <span className="text-yellow-500 text-2xl">👋</span>
          <div className="text-left pr-8">
            <p className="text-[15px] font-bold text-gray-700">
              Good Morning, {adminName}. It&apos;s Good
            </p>
            <p className="text-[15px] font-bold text-gray-700 text-center">
              To Have You Today.
            </p>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="flex flex-row mt-16 mb-8 bg-white border border-gray-200 shadow-sm w-full overflow-hidden">
        <div className="flex flex-1 border-r border-gray-200">
          <div className="w-32 bg-[#00AEEF] flex flex-col items-center justify-center text-white py-5 px-2">
            <Users className="w-10 h-10 mb-2 text-white fill-current" />
            <span className="font-bold text-sm tracking-wide">Users</span>
            <span className="text-xs">[Total]</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white">
            <span className="text-[26px] font-normal text-gray-700">
              {stats.totalUsers}
            </span>
          </div>
        </div>

        <div className="flex flex-1 border-r border-gray-200">
          <div className="w-32 bg-[#B8703C] flex flex-col items-center justify-center text-white py-5 px-2">
            <Users className="w-10 h-10 mb-2 text-white fill-current" />
            <span className="font-bold text-sm tracking-wide">Users</span>
            <span className="text-xs">[Active]</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white">
            <span className="text-[26px] font-normal text-gray-700">
              {stats.activeUsers}
            </span>
          </div>
        </div>

        <div className="flex flex-1 border-r border-gray-200">
          <div className="w-32 bg-[#E94B35] flex flex-col items-center justify-center text-white py-5 px-2">
            <Users className="w-10 h-10 mb-2 text-white fill-current" />
            <span className="font-bold text-sm tracking-wide">Users</span>
            <span className="text-xs">[Blocked]</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white">
            <span className="text-[26px] font-normal text-gray-700">
              {stats.blockedUsers}
            </span>
          </div>
        </div>

        <div className="flex flex-1">
          <div className="w-32 bg-[#25B89A] flex flex-col items-center justify-center text-white py-5 px-2">
            <Users className="w-10 h-10 mb-2 text-white fill-current" />
            <span className="font-bold text-sm tracking-wide">Users</span>
            <span className="text-xs">[Suspended]</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white">
            <span className="text-[26px] font-normal text-gray-700">
              {stats.suspendedUsers}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Information Panel */}
      <div className="bg-white border border-[#4EA7F8] rounded-sm shadow-sm overflow-hidden mb-8">
        <div className="bg-[#3498db] text-white px-4 py-3 flex items-center gap-2 border-b-2 border-[#1A252F]">
          <Box className="w-4 h-4" />
          <h3 className="font-bold text-[13px] uppercase tracking-wider">
            Transaction Information
          </h3>
        </div>

        {/* TODAY SECTION */}
        <div className="border-b border-gray-200">
          <div className="px-5 py-4">
            <h4 className="text-red-600 font-bold text-[13px] tracking-wide uppercase">
              Today:
            </h4>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f0f2f5] border-y border-gray-200 text-gray-500 text-[11px] font-bold tracking-wider">
                <th className="px-5 py-3 w-1/3">MEDIUM</th>
                <th className="px-5 py-3 w-1/3 text-center">DEPOSITS</th>
                <th className="px-5 py-3 w-1/3 text-center">WITHDRAWAL</th>
              </tr>
            </thead>
            <tbody>
              {assetOrder.map((asset, idx) => {
                const isEven = idx % 2 === 0;
                const deposits = txToday[asset.id]?.d || 0;
                const withdraws = txToday[asset.id]?.w || 0;
                if (
                  deposits === 0 &&
                  withdraws === 0 &&
                  !["main", "eth", "usdt_erc20"].includes(asset.id)
                )
                  return null;

                return (
                  <tr
                    key={`today-${asset.id}`}
                    className={`${
                      isEven ? "bg-white" : "bg-[#fafafa]"
                    } border-b border-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-50`}
                  >
                    <td className="px-5 py-4">{asset.name}</td>
                    <td className="px-5 py-4 text-center">
                      {formatCryptoAmount(deposits, asset.id)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {formatCryptoAmount(withdraws, asset.id)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* THIS MONTH SECTION */}
        <div>
          <div className="px-5 py-4">
            <h4 className="text-red-600 font-bold text-[13px] tracking-wide uppercase">
              This Month:
            </h4>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f0f2f5] border-y border-gray-200 text-gray-500 text-[11px] font-bold tracking-wider">
                <th className="px-5 py-3 w-1/3">MEDIUM</th>
                <th className="px-5 py-3 w-1/3 text-center">DEPOSITS</th>
                <th className="px-5 py-3 w-1/3 text-center">WITHDRAWAL</th>
              </tr>
            </thead>
            <tbody>
              {assetOrder.map((asset, idx) => {
                const isEven = idx % 2 === 0;
                const deposits = txMonth[asset.id]?.d || 0;
                const withdraws = txMonth[asset.id]?.w || 0;
                if (
                  deposits === 0 &&
                  withdraws === 0 &&
                  !["main", "eth", "usdt_erc20"].includes(asset.id)
                )
                  return null;

                return (
                  <tr
                    key={`month-${asset.id}`}
                    className={`${
                      isEven ? "bg-white" : "bg-[#fafafa]"
                    } border-b border-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-50`}
                  >
                    <td className="px-5 py-4">{asset.name}</td>
                    <td className="px-5 py-4 text-center">
                      {formatCryptoAmount(deposits, asset.id)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {formatCryptoAmount(withdraws, asset.id)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive Live Visitors, Geo Flags & Section Summary */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        {/* Command Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                  Live Site Visitors &amp; Geo Summary
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time customer sessions, current page section, IP address, and verified country flags
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {lastUpdatedAt && (
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Synced{" "}
                {lastUpdatedAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}

            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                autoRefresh
                  ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
              title="Toggle 15-second live polling"
            >
              <Activity className="w-3 h-3" />
              <span>{autoRefresh ? "Auto 15s" : "Paused"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? "animate-spin text-blue-400" : ""}`}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/admin/ip-config"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            >
              <span>Full IP Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Metrics Strip + Live Country Flags */}
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Online Right Now
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    visitorSummary.onlineCount > 0
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-gray-300"
                  }`}
                />
                <span className="text-xl font-black text-gray-900">
                  {visitorSummary.onlineCount}
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  active now
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200 hidden sm:block" />

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Active (15m)
              </div>
              <div className="text-xl font-black text-blue-600 mt-0.5">
                {visitorSummary.active15mCount}
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200 hidden sm:block" />

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Sessions (24h)
              </div>
              <div className="text-xl font-black text-gray-900 mt-0.5">
                {visitorSummary.logins24hCount}
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200 hidden sm:block" />

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                IPs Tracked
              </div>
              <div className="text-xl font-black text-indigo-600 mt-0.5">
                {visitorSummary.ipLoggedCount}
                <span className="text-xs font-semibold text-gray-400 ml-1">
                  / {Math.max(0, stats.totalUsers - 1)}
                </span>
              </div>
            </div>
          </div>

          {/* Country Flag Breakdown Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">
              {visitorSummary.isShowingLiveCountries
                ? "Active Flags:"
                : "Logged Regions:"}
            </span>
            {visitorSummary.activeCountries.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[11px] text-gray-500 font-medium">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                Waiting for active sessions
              </span>
            ) : (
              visitorSummary.activeCountries.slice(0, 6).map((c) => (
                <Link
                  key={c.name}
                  href={`/admin/ip-config?country=${encodeURIComponent(c.code || c.name)}`}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-xs font-semibold text-gray-800 transition shadow-2xs"
                  title={`Filter ${c.name} in Full IP Console`}
                >
                  <CountryFlag
                    countryCode={c.code}
                    countryName={c.name}
                    size="sm"
                    textClassName="font-semibold text-gray-800 text-[11px]"
                  />
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      c.onlineCount > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.count}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Summary View Tabs */}
        <div className="px-5 py-2.5 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPresenceTab("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                presenceTab === "active"
                  ? "bg-slate-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  visitorSummary.liveVisitors.length > 0
                    ? "bg-emerald-400"
                    : "bg-gray-400"
                }`}
              />
              <span>Active on Site ({visitorSummary.liveVisitors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setPresenceTab("recent")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                presenceTab === "recent"
                  ? "bg-slate-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Logins ({visitorSummary.recentLogins.length})</span>
            </button>
          </div>

          <span className="text-[11px] text-gray-500 font-medium">
            Showing top {Math.min(8, summaryRows.length)} summary entries
          </span>
        </div>

        {/* Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Presence &amp; Device</th>
                <th className="px-5 py-3">Current Section</th>
                <th className="px-5 py-3">Country Flag &amp; City</th>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                        <Activity className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {presenceTab === "active"
                          ? "No users are actively on the site at this exact moment"
                          : "No recent login records found"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Users appear here automatically in real time as soon as they sign in or navigate any wallet page.
                      </p>
                      {presenceTab === "active" &&
                        visitorSummary.recentLogins.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPresenceTab("recent")}
                            className="mt-3 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition"
                          >
                            View {visitorSummary.recentLogins.length} Recent Login Sessions →
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ) : (
                summaryRows.map((u) => {
                  const sectionInfo = u.current_path
                    ? resolveSiteSection(u.current_path)
                    : null;
                  const sectionLabel = u.current_section || sectionInfo?.label || null;
                  const sectionStyle = getSectionCategoryStyle(
                    sectionInfo?.category || "public"
                  );
                  const SectionIcon = sectionStyle.Icon;

                  const flagCode = u.last_country || u.profile_country_code || null;
                  const flagCountryName = u.last_country_name || u.profile_country || null;
                  const isGeoVerified = Boolean(u.last_country || u.last_country_name);
                  const lastActivityTs = u.last_active_at || u.last_sign_in_at;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      {/* User */}
                      <td className="px-5 py-3.5 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.display_name}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {getInitials(u.display_name, u.email)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/admin/members/${u.id}`}
                                className="font-bold text-[13px] text-gray-900 hover:text-blue-600 truncate max-w-[155px]"
                              >
                                {u.display_name}
                              </Link>
                              {u.readable_id && (
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {u.readable_id}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate max-w-[210px]">
                              {u.email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Presence & Device */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {u.presence === "online" ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Online Now
                              </span>
                            ) : u.presence === "idle" ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Idle
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[11px] font-bold">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                Offline
                              </span>
                            )}
                            <span
                              className="text-[11px] text-gray-500 font-semibold"
                              title={formatFullTimestamp(lastActivityTs)}
                            >
                              {formatRelativeTime(lastActivityTs)}
                            </span>
                          </div>

                          {u.device && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                              {isMobileDevice(u.device) ? (
                                <Smartphone className="w-3 h-3" />
                              ) : (
                                <Monitor className="w-3 h-3" />
                              )}
                              {u.device}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Site Section */}
                      <td className="px-5 py-3.5 min-w-[180px]">
                        {sectionLabel ? (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${sectionStyle.cls}`}
                            >
                              <SectionIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>{sectionLabel}</span>
                            </span>
                            {u.current_path && (
                              <div className="font-mono text-[10px] text-gray-400 truncate max-w-[200px]">
                                {u.current_path}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">
                            Auth login recorded · awaiting page hit
                          </span>
                        )}
                      </td>

                      {/* Country Flag & City */}
                      <td className="px-5 py-3.5 min-w-[170px]">
                        {flagCountryName || flagCode ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <CountryFlag
                                countryCode={flagCode}
                                countryName={flagCountryName}
                                city={isGeoVerified ? u.last_city : null}
                                size="md"
                                textClassName="font-bold text-gray-800 text-xs"
                              />
                            </div>
                            <span
                              className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                isGeoVerified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {isGeoVerified ? "Live IP Geo" : "Profile Region"}
                            </span>
                          </div>
                        ) : (
                          <CountryFlag
                            fallbackLabel="Not yet captured"
                            size="sm"
                            textClassName="text-[11px] text-gray-400"
                          />
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {u.last_ip ? (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(u.last_ip!, "IP Address")}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/70 hover:bg-blue-100 border border-blue-200 font-mono text-[11px] font-bold text-blue-700 transition"
                              title="Click to copy IP address"
                            >
                              <span>{u.last_ip}</span>
                              <Copy className="w-3 h-3 opacity-70" />
                            </button>
                            {u.login_ip && u.login_ip !== u.last_ip && (
                              <div className="text-[10px] text-gray-400 font-mono">
                                Login IP: {u.login_ip}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] text-gray-400 font-medium">
                              Awaiting next login
                            </span>
                            {u.last_sign_in_at && (
                              <div className="text-[10px] text-gray-400">
                                Last auth {formatRelativeTime(u.last_sign_in_at)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quick Action */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/members/${u.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:text-blue-600 text-gray-700 text-[11px] font-bold transition"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="px-5 py-3 bg-[#f8fafc] border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-500 font-medium">
            Summary view shows live active presence &amp; recent logins ({visitorSummary.ipLoggedCount} of{" "}
            {Math.max(0, stats.totalUsers - 1)} users have captured IP telemetry).
          </span>
          <Link
            href="/admin/ip-config"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold"
          >
            <span>Search all users, IPs, countries &amp; IP history →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
