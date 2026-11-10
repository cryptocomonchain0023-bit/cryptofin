"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldAlert,
  CheckCircle2,
  Search,
  RefreshCw,
  Copy,
  Activity,
  Globe,
  Monitor,
  Smartphone,
  Clock,
  X,
  History,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Ban,
  PauseCircle,
  Users,
  Wifi,
  Network,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { CountryFlag } from "@/components/ui/CountryFlag";
import {
  formatFullTimestamp,
  formatRelativeTime,
  resolveSiteSection,
  type IpHistoryEntry,
  type PresenceState,
  type UserTelemetry,
} from "@/lib/activity";

interface IpUserRow {
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
  suspend_until: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  presence: PresenceState;
  telemetry: UserTelemetry | null;
  last_ip: string | null;
  login_ip: string | null;
  last_country: string | null;
  last_country_name: string | null;
  last_city: string | null;
  last_region: string | null;
  current_path: string | null;
  current_section: string | null;
  last_active_at: string | null;
  last_login_at: string | null;
  device: string | null;
  ip_history: IpHistoryEntry[];
}

type IpFilterTab =
  | "all"
  | "online"
  | "active15m"
  | "ip_logged"
  | "multi_ip"
  | "suspended"
  | "blocked";

type SortMode = "activity" | "last_login" | "name_asc";

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

function getDistinctIpCount(u: IpUserRow): number {
  const set = new Set<string>();
  if (u.last_ip) set.add(u.last_ip);
  if (u.login_ip) set.add(u.login_ip);
  for (const item of u.ip_history || []) {
    if (item.ip) set.add(item.ip);
  }
  return set.size;
}

function getSearchMatchField(u: IpUserRow, rawQuery: string): string | null {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return null;

  if (u.last_ip && u.last_ip.toLowerCase().includes(q)) return "Current IP";
  if (u.login_ip && u.login_ip.toLowerCase().includes(q)) return "Login IP";
  for (const h of u.ip_history || []) {
    if (h.ip.toLowerCase().includes(q)) return `IP History (${h.ip})`;
    if (h.countryName && h.countryName.toLowerCase().includes(q)) {
      return `History Country (${h.countryName})`;
    }
    if (h.city && h.city.toLowerCase().includes(q)) return `History City (${h.city})`;
  }

  if (u.last_country_name && u.last_country_name.toLowerCase().includes(q)) {
    return "Country";
  }
  if (u.last_country && u.last_country.toLowerCase() === q) {
    return "Country Code";
  }
  if (u.last_city && u.last_city.toLowerCase().includes(q)) return "City";
  if (u.last_region && u.last_region.toLowerCase().includes(q)) return "Region";
  if (u.profile_country && u.profile_country.toLowerCase().includes(q)) {
    return "Profile Country";
  }
  if (u.current_section && u.current_section.toLowerCase().includes(q)) {
    return "Site Section";
  }
  if (u.current_path && u.current_path.toLowerCase().includes(q)) {
    return "Route Path";
  }
  if (u.device && u.device.toLowerCase().includes(q)) return "Device";
  if (u.readable_id && u.readable_id.toLowerCase().includes(q)) return "Account UID";
  if (u.id.toLowerCase().includes(q)) return "User UUID";
  if (u.email && u.email.toLowerCase().includes(q)) return "Email";
  if (u.display_name.toLowerCase().includes(q)) return "Name";
  return null;
}

export default function IPConfigPage() {
  const router = useRouter();
  const [users, setUsers] = useState<IpUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<IpFilterTab>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("activity");
  const [currentPage, setCurrentPage] = useState(1);
  const [historyModalUser, setHistoryModalUser] = useState<IpUserRow | null>(null);

  const itemsPerPage = 25;

  // Read optional ?country= param if linked from Dashboard flag pills
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const countryParam = params.get("country");
      if (countryParam && countryParam.trim()) {
        setSelectedCountry(countryParam.trim().toUpperCase());
      }
    }
  }, []);

  const fetchUsers = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const res = await adminFetch("/api/admin/dashboard");
        if (res.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch visitor & IP telemetry");
        }

        if (Array.isArray(data.users)) {
          const nonAdminUsers = (data.users as IpUserRow[]).filter(
            (u) => !u.is_admin
          );
          setUsers(nonAdminUsers);
          setLastSyncedAt(new Date());

          setHistoryModalUser((prev) => {
            if (!prev) return null;
            return nonAdminUsers.find((u) => u.id === prev.id) || prev;
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load IP data";
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchUsers(false);
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchUsers]);

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const countryCode = u.last_country || u.profile_country_code || null;
      const countryName = u.last_country_name || u.profile_country || null;
      const isGeoVerified = Boolean(u.last_country || u.last_country_name);
      const distinctIps = getDistinctIpCount(u);
      const matchField = getSearchMatchField(u, search);
      const sectionInfo = u.current_path
        ? resolveSiteSection(u.current_path)
        : null;
      const sectionLabel = u.current_section || sectionInfo?.label || null;

      return {
        ...u,
        resolvedCountryCode: countryCode,
        resolvedCountryName: countryName,
        isGeoVerified,
        distinctIps,
        matchField,
        sectionLabel,
      };
    });
  }, [users, search]);

  const metrics = useMemo(() => {
    let onlineCount = 0;
    let active15mCount = 0;
    let ipLoggedCount = 0;
    let multiIpCount = 0;
    let suspendedCount = 0;
    let blockedCount = 0;
    const countryMap = new Map<
      string,
      {
        key: string;
        code: string | null;
        name: string;
        total: number;
        online: number;
        ipVerifiedCount: number;
      }
    >();

    for (const u of enrichedUsers) {
      if (u.presence === "online") onlineCount++;
      if (u.presence === "online" || u.presence === "idle") active15mCount++;
      if (u.last_ip) ipLoggedCount++;
      if (u.distinctIps > 1) multiIpCount++;
      if (u.status === "suspended") suspendedCount++;
      if (u.status === "blocked") blockedCount++;

      if (u.resolvedCountryName || u.resolvedCountryCode) {
        const key = (u.resolvedCountryCode || u.resolvedCountryName || "").toUpperCase();
        const existing = countryMap.get(key) || {
          key,
          code: u.resolvedCountryCode,
          name: u.resolvedCountryName || u.resolvedCountryCode || key,
          total: 0,
          online: 0,
          ipVerifiedCount: 0,
        };
        existing.total += 1;
        if (u.presence === "online") existing.online += 1;
        if (u.isGeoVerified) existing.ipVerifiedCount += 1;
        if (!existing.code && u.resolvedCountryCode) existing.code = u.resolvedCountryCode;
        countryMap.set(key, existing);
      }
    }

    const countries = Array.from(countryMap.values()).sort(
      (a, b) =>
        b.online - a.online ||
        b.ipVerifiedCount - a.ipVerifiedCount ||
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );

    return {
      total: enrichedUsers.length,
      onlineCount,
      active15mCount,
      ipLoggedCount,
      multiIpCount,
      suspendedCount,
      blockedCount,
      countriesCount: countries.length,
      countries,
    };
  }, [enrichedUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim();
    const list = enrichedUsers.filter((u) => {
      if (activeTab === "online" && u.presence !== "online") return false;
      if (
        activeTab === "active15m" &&
        u.presence !== "online" &&
        u.presence !== "idle"
      )
        return false;
      if (activeTab === "ip_logged" && !u.last_ip) return false;
      if (activeTab === "multi_ip" && u.distinctIps <= 1) return false;
      if (activeTab === "suspended" && u.status !== "suspended") return false;
      if (activeTab === "blocked" && u.status !== "blocked") return false;

      if (selectedCountry !== "all") {
        const uKey = (u.resolvedCountryCode || u.resolvedCountryName || "").toUpperCase();
        if (
          uKey !== selectedCountry &&
          (u.resolvedCountryName || "").toUpperCase() !== selectedCountry
        ) {
          return false;
        }
      }

      if (q && !u.matchField) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === "name_asc") {
        return a.display_name.localeCompare(b.display_name);
      }
      if (sortMode === "last_login") {
        const lA = new Date(a.last_login_at || a.last_sign_in_at || 0).getTime();
        const lB = new Date(b.last_login_at || b.last_sign_in_at || 0).getTime();
        return lB - lA;
      }

      // Default: Online -> Idle -> Most recent active / login -> Has IP -> Joined
      const pWeight = (p: PresenceState) =>
        p === "online" ? 3 : p === "idle" ? 2 : 1;
      const pwDiff = pWeight(b.presence) - pWeight(a.presence);
      if (pwDiff !== 0) return pwDiff;

      const tA = Math.max(
        new Date(a.last_active_at || 0).getTime(),
        new Date(a.last_sign_in_at || 0).getTime()
      );
      const tB = Math.max(
        new Date(b.last_active_at || 0).getTime(),
        new Date(b.last_sign_in_at || 0).getTime()
      );
      if (tB !== tA) return tB - tA;

      return Number(Boolean(b.last_ip)) - Number(Boolean(a.last_ip));
    });

    return list;
  }, [enrichedUsers, activeTab, selectedCountry, search, sortMode]);

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

  const handleStatusChange = async (
    userRow: IpUserRow,
    newStatus: "active" | "suspended" | "blocked"
  ) => {
    const prevStatus = userRow.status;
    if (prevStatus === newStatus) return;

    setUpdatingStatusId(userRow.id);
    setUsers((prev) =>
      prev.map((u) => (u.id === userRow.id ? { ...u, status: newStatus } : u))
    );

    try {
      const res = await adminFetch("/api/admin/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userRow.id, status: newStatus }),
      });

      if (res.status === 401) {
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update account status");
      }

      toast.success(
        `${userRow.display_name} marked as ${
          newStatus === "blocked"
            ? "Blocked"
            : newStatus === "suspended"
            ? "Suspended"
            : "Active"
        }`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
      // Roll back optimistic state on error
      setUsers((prev) =>
        prev.map((u) => (u.id === userRow.id ? { ...u, status: prevStatus } : u))
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="w-full max-w-full font-sans text-gray-900 pb-20 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <ShieldAlert size={24} className="text-blue-600 shrink-0" />
            <span>IP Configuration, Live Presence &amp; Geo Security</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Search users by any IP address (current, login, or historical), country, active site section, UID, email, or name. Monitor live traffic and manage access controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {lastSyncedAt && (
            <span className="text-[11px] font-medium text-gray-400">
              Updated{" "}
              {lastSyncedAt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition shadow-xs ${
              autoRefresh
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-gray-300 text-gray-600"
            }`}
          >
            <Wifi size={13} className={autoRefresh ? "text-emerald-600" : "text-gray-400"} />
            <span>{autoRefresh ? "Live Sync 15s" : "Sync Paused"}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-xs disabled:opacity-60"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin text-blue-600" : ""}
            />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/members"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs"
          >
            <Users size={14} />
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab((prev) => (prev === "online" ? "all" : "online"));
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "online"
              ? "border-emerald-400 ring-1 ring-emerald-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Online Right Now
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {metrics.onlineCount}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              {metrics.active15mCount} active within 15m
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab((prev) => (prev === "ip_logged" ? "all" : "ip_logged"));
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "ip_logged"
              ? "border-blue-400 ring-1 ring-blue-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              IPs Captured
            </span>
            <span className="text-2xl font-black text-blue-600">
              {metrics.ipLoggedCount}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Of {metrics.total} total accounts
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Network size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedCountry("all");
            setActiveTab("all");
            setCurrentPage(1);
          }}
          className="text-left bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm flex items-center justify-between transition"
        >
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Countries Detected
            </span>
            <span className="text-2xl font-black text-indigo-600">
              {metrics.countriesCount}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              {metrics.multiIpCount} multi-IP user{metrics.multiIpCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Globe size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab((prev) =>
              prev === "blocked" ? "suspended" : prev === "suspended" ? "all" : "blocked"
            );
            setCurrentPage(1);
          }}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            activeTab === "blocked" || activeTab === "suspended"
              ? "border-rose-400 ring-1 ring-rose-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Restricted Accounts
            </span>
            <span className="text-2xl font-black text-rose-600">
              {metrics.blockedCount + metrics.suspendedCount}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              {metrics.blockedCount} blocked · {metrics.suspendedCount} suspended
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Ban size={19} />
          </div>
        </button>
      </div>

      {/* Interactive Country Flag Distribution Bar */}
      {metrics.countries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Globe size={13} className="text-blue-600" />
              Filter by Country Flag ({metrics.countries.length} countries)
            </span>
            {selectedCountry !== "all" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry("all");
                  setCurrentPage(1);
                }}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Show All Countries
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCountry("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                selectedCountry === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              All ({metrics.total})
            </button>

            {metrics.countries.map((c) => {
              const isSelected = selectedCountry === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(isSelected ? "all" : c.key);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  {c.online > 0 && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? "bg-emerald-300" : "bg-emerald-500 animate-pulse"
                      }`}
                      title={`${c.online} online now`}
                    />
                  )}
                  <CountryFlag
                    countryCode={c.code}
                    countryName={c.name}
                    size="sm"
                    textClassName={isSelected ? "text-white font-bold" : "text-gray-800 font-semibold"}
                  />
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filters Card */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-5 space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by IP (current or history), country, city, active site section, UID, email, or name..."
              className="w-full bg-[#f9fafb] border border-gray-200 text-gray-900 text-sm rounded-lg pl-10 pr-9 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
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
              <option value="activity">Live &amp; Most Recent</option>
              <option value="last_login">Last Sign-In Time</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: "All Users", count: metrics.total },
                { id: "online", label: "Online Now", count: metrics.onlineCount },
                { id: "active15m", label: "Active (15m)", count: metrics.active15mCount },
                { id: "ip_logged", label: "IP Captured", count: metrics.ipLoggedCount },
                { id: "multi_ip", label: "Multi-IP", count: metrics.multiIpCount },
                { id: "suspended", label: "Suspended", count: metrics.suspendedCount },
                { id: "blocked", label: "Blocked", count: metrics.blockedCount },
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

      {/* Main IP & Security Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={28} />
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Loading live sessions, geo flags, and IP records...
            </p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <ShieldAlert size={22} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
              No Matching IP or Visitor Records
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Try adjusting your search query, country flag filter, or status tab.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCountry("all");
                setActiveTab("all");
                setCurrentPage(1);
              }}
              className="mt-3 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Live Presence &amp; Section</th>
                    <th className="py-3.5 px-4">IP Address &amp; History</th>
                    <th className="py-3.5 px-4">Country Flag &amp; City</th>
                    <th className="py-3.5 px-4">Last Login &amp; Activity</th>
                    <th className="py-3.5 px-4">Access Status</th>
                    <th className="py-3.5 px-4 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {paginatedUsers.map((u) => {
                    const lastSeenTs = u.last_active_at || u.last_sign_in_at;
                    const isUpdating = updatingStatusId === u.id;

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/90 transition-colors align-top"
                      >
                        {/* User */}
                        <td className="py-3.5 px-4 min-w-[215px]">
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
                                className="font-bold text-[13px] text-gray-900 hover:text-blue-600 transition block truncate max-w-[180px]"
                              >
                                {u.display_name}
                              </Link>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className="text-[11px] text-gray-500 truncate max-w-[165px]"
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
                              <div className="flex items-center gap-1.5 mt-1">
                                {u.readable_id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopy(u.readable_id!, "Account UID")
                                    }
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 border border-slate-200 font-mono text-[10px] font-bold text-slate-700"
                                  >
                                    UID {u.readable_id}
                                  </button>
                                )}
                                {u.matchField && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                    Match: {u.matchField}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Live Presence & Site Section */}
                        <td className="py-3.5 px-4 min-w-[195px]">
                          <div className="space-y-1.5">
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
                            </div>

                            {u.sectionLabel ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                                  {u.sectionLabel}
                                </span>
                                {u.current_path && (
                                  <div className="font-mono text-[10px] text-gray-400 truncate max-w-[185px] mt-0.5">
                                    {u.current_path}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic block">
                                No active section yet
                              </span>
                            )}

                            {u.device && (
                              <div className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                                {isMobileDevice(u.device) ? (
                                  <Smartphone size={11} className="text-gray-400" />
                                ) : (
                                  <Monitor size={11} className="text-gray-400" />
                                )}
                                <span>{u.device}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* IP Address & IP History */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          {u.last_ip ? (
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopy(u.last_ip!, "IP Address")}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/70 hover:bg-blue-100 border border-blue-200 font-mono text-xs font-bold text-blue-700 transition"
                                title="Click to copy current IP"
                              >
                                <span>{u.last_ip}</span>
                                <Copy size={11} className="opacity-70" />
                              </button>

                              {u.login_ip && u.login_ip !== u.last_ip && (
                                <div className="text-[10px] font-mono text-gray-500">
                                  Login IP: {u.login_ip}
                                </div>
                              )}

                              {u.ip_history.length > 0 && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setHistoryModalUser(u)}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                  >
                                    <History size={11} />
                                    <span>
                                      IP History ({u.ip_history.length} event
                                      {u.ip_history.length === 1 ? "" : "s"} ·{" "}
                                      {u.distinctIps} unique)
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-semibold">
                                Awaiting next session
                              </span>
                              <div className="text-[10px] text-gray-400">
                                Captured automatically on next login or page view
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Country Flag & City */}
                        <td className="py-3.5 px-4 min-w-[180px]">
                          {u.resolvedCountryName || u.resolvedCountryCode ? (
                            <div className="space-y-1">
                              <CountryFlag
                                countryCode={u.resolvedCountryCode}
                                countryName={u.resolvedCountryName}
                                city={u.isGeoVerified ? u.last_city : null}
                                size="md"
                                showCode
                                textClassName="font-bold text-gray-800 text-xs"
                              />
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                                    u.isGeoVerified
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-100 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {u.isGeoVerified ? "Live IP Geo" : "Profile Region"}
                                </span>
                                {u.isGeoVerified && u.last_region && (
                                  <span className="text-[10px] text-gray-400">
                                    {u.last_region}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <CountryFlag
                              fallbackLabel="Not yet captured"
                              size="sm"
                              textClassName="text-[11px] text-gray-400"
                            />
                          )}
                        </td>

                        {/* Last Login & Activity */}
                        <td className="py-3.5 px-4 min-w-[165px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-semibold text-gray-800">
                              <Clock size={12} className="text-gray-400 shrink-0" />
                              <span>
                                {lastSeenTs
                                  ? formatRelativeTime(lastSeenTs)
                                  : "Never active"}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {u.last_sign_in_at
                                ? `Last Login: ${formatFullTimestamp(u.last_sign_in_at)}`
                                : "Never signed in"}
                            </div>
                          </div>
                        </td>

                        {/* Account Status Pill */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.status === "blocked" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                              <Ban size={11} /> Blocked
                            </span>
                          ) : u.status === "suspended" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                              <PauseCircle size={11} /> Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                              <CheckCircle2 size={11} /> Active
                            </span>
                          )}
                        </td>

                        {/* Controls */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <div className="relative inline-flex items-center">
                              {isUpdating && (
                                <Loader2
                                  size={12}
                                  className="animate-spin text-blue-600 mr-1.5"
                                />
                              )}
                              <select
                                disabled={isUpdating}
                                value={u.status || "active"}
                                onChange={(e) =>
                                  handleStatusChange(
                                    u,
                                    e.target.value as
                                      | "active"
                                      | "suspended"
                                      | "blocked"
                                  )
                                }
                                className="text-xs font-bold border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none bg-white text-gray-800 hover:border-blue-400 focus:border-blue-500 cursor-pointer disabled:opacity-60"
                              >
                                <option value="active">Active</option>
                                <option value="suspended">Suspend</option>
                                <option value="blocked">Block (Ban)</option>
                              </select>
                            </div>

                            <Link
                              href={`/admin/members/${u.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-bold transition"
                              title="Open Manage User details"
                            >
                              <span>User</span>
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-[#f8fafc] border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-gray-500 font-semibold">
                Showing {(safePage - 1) * itemsPerPage + 1}–
                {Math.min(safePage * itemsPerPage, filteredUsers.length)} of{" "}
                {filteredUsers.length} record{filteredUsers.length === 1 ? "" : "s"}
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

      {/* IP History Timeline Modal */}
      {historyModalUser && (
        <div
          onClick={() => setHistoryModalUser(null)}
          className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <History size={16} className="text-blue-400" />
                  <span>IP &amp; Geo Timeline — {historyModalUser.display_name}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {historyModalUser.email}
                  {historyModalUser.readable_id
                    ? ` · UID ${historyModalUser.readable_id}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalUser(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 bg-slate-50/60">
              {historyModalUser.ip_history.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">
                  No historical IP events recorded yet.
                </p>
              ) : (
                historyModalUser.ip_history.map((entry, idx) => (
                  <div
                    key={`${entry.ip}-${entry.seenAt}-${idx}`}
                    className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopy(entry.ip, "IP Address")}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 font-mono text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                        >
                          <span>{entry.ip}</span>
                          <Copy size={11} />
                        </button>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase">
                          {entry.event}
                        </span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="pt-0.5">
                        <CountryFlag
                          countryCode={entry.countryCode}
                          countryName={entry.countryName}
                          city={entry.city}
                          size="md"
                          showCode
                          fallbackLabel="Location resolving"
                          textClassName="text-xs font-semibold text-gray-800"
                        />
                      </div>
                    </div>

                    <div className="text-right text-[11px]">
                      <div className="font-bold text-gray-800">
                        {formatRelativeTime(entry.seenAt)}
                      </div>
                      <div className="text-gray-500">
                        {formatFullTimestamp(entry.seenAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
