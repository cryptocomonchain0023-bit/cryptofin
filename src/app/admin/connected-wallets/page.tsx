"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Link2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Copy,
  Eye,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  Users,
  Wifi,
  ExternalLink,
  Wallet,
  Globe,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/activity";
import type { LinkedWalletRecord, LinkedWalletStatus } from "@/lib/linked-wallets";

interface AdminConnectedWalletRow extends LinkedWalletRecord {
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    walletUid: string | null;
    countryCode: string | null;
    countryName: string | null;
    presence: string;
  };
}

function getInitials(name: string, email: string) {
  const cleaned = (name || "").trim();
  if (cleaned && cleaned !== "User") {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }
  return (email || "U").slice(0, 2).toUpperCase();
}

function shortenAddress(addr: string) {
  if (!addr || addr.length <= 18) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function getNetworkBadgeStyle(network: string) {
  const n = network.toLowerCase();
  if (n.includes("eth")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (n.includes("bnb") || n.includes("bep")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (n.includes("tron") || n.includes("trc")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (n.includes("sol")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (n.includes("btc") || n.includes("bitcoin")) return "bg-orange-50 text-orange-800 border-orange-200";
  if (n.includes("poly") || n.includes("matic")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (n.includes("avax") || n.includes("avalanche")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getExplorerUrl(address: string, network: string): string | null {
  if (!address) return null;
  const n = network.toLowerCase();
  if (n.includes("eth")) return `https://etherscan.io/address/${address}`;
  if (n.includes("bnb") || n.includes("bep")) return `https://bscscan.com/address/${address}`;
  if (n.includes("tron") || n.includes("trc")) return `https://tronscan.org/#/address/${address}`;
  if (n.includes("sol")) return `https://solscan.io/account/${address}`;
  if (n.includes("btc") || n.includes("bitcoin")) return `https://mempool.space/address/${address}`;
  if (n.includes("poly") || n.includes("matic")) return `https://polygonscan.com/address/${address}`;
  if (n.includes("avax") || n.includes("avalanche")) return `https://snowtrace.io/address/${address}`;
  return null;
}

export default function AdminConnectedWalletsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<AdminConnectedWalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LinkedWalletStatus>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  const [selectedRow, setSelectedRow] = useState<AdminConnectedWalletRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const fetchConnections = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const res = await adminFetch("/api/admin/connected-wallets");
        if (res.status === 401) {
          toast.error("Admin session expired. Please sign in again.");
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load connected wallets");
        }
        if (Array.isArray(data.connections)) {
          setConnections(data.connections);
          setLastSyncedAt(new Date());
          setSelectedRow((prev) => {
            if (!prev) return null;
            return (
              (data.connections as AdminConnectedWalletRow[]).find((c) => c.id === prev.id) ||
              null
            );
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading connected wallets";
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchConnections(false);
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchConnections]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const openInspectModal = (row: AdminConnectedWalletRow) => {
    setSelectedRow(row);
    setReviewNote(row.adminNote || "");
  };

  const handleAction = async (
    row: AdminConnectedWalletRow,
    action: "approve" | "reject" | "pending",
    customNote?: string
  ) => {
    const label =
      action === "approve"
        ? "approve"
        : action === "reject"
        ? "reject"
        : "reset to pending";

    if (
      customNote === undefined &&
      !window.confirm(`Are you sure you want to ${label} this linked wallet?`)
    ) {
      return;
    }

    setProcessingId(row.id);

    try {
      const res = await adminFetch("/api/admin/connected-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: row.id,
          userId: row.userId,
          action,
          adminNote: customNote !== undefined ? customNote : row.adminNote,
        }),
      });

      if (res.status === 401) {
        toast.error("Admin session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update verification status");
      }

      const updated: LinkedWalletRecord = data.connection;
      setConnections((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: updated.status,
                adminNote: updated.adminNote,
                reviewedAt: updated.reviewedAt,
                reviewedBy: updated.reviewedBy,
              }
            : item
        )
      );

      setSelectedRow((prev) =>
        prev && prev.id === row.id
          ? {
              ...prev,
              status: updated.status,
              adminNote: updated.adminNote,
              reviewedAt: updated.reviewedAt,
              reviewedBy: updated.reviewedBy,
            }
          : prev
      );

      toast.success(
        action === "approve"
          ? "Linked wallet approved & synced to user dashboard"
          : action === "reject"
          ? "Linked wallet rejected & synced to user dashboard"
          : "Linked wallet reset to pending"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error processing action";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (row: AdminConnectedWalletRow) => {
    if (!window.confirm("Remove this linked wallet record permanently?")) return;

    setProcessingId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/connected-wallets?id=${encodeURIComponent(row.id)}&userId=${encodeURIComponent(row.userId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete linked wallet");
      }
      setConnections((prev) => prev.filter((item) => item.id !== row.id));
      if (selectedRow?.id === row.id) setSelectedRow(null);
      toast.success("Linked wallet record removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting record";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const metrics = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    const netMap = new Map<string, number>();

    for (const c of connections) {
      if (c.status === "pending") pending++;
      else if (c.status === "approved") approved++;
      else if (c.status === "rejected") rejected++;

      const net = c.network || "Other";
      netMap.set(net, (netMap.get(net) || 0) + 1);
    }

    const networks = Array.from(netMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      total: connections.length,
      pending,
      approved,
      rejected,
      networks,
    };
  }, [connections]);

  const filteredConnections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return connections.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (networkFilter !== "all" && c.network !== networkFilter) return false;

      if (q) {
        const hay = [
          c.address,
          c.network,
          c.walletProvider,
          c.label || "",
          c.adminNote || "",
          c.ip || "",
          c.countryName || "",
          c.user.displayName,
          c.user.email,
          c.user.walletUid || "",
          c.userId,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [connections, statusFilter, networkFilter, searchQuery]);

  return (
    <div className="w-full max-w-full font-sans text-gray-900 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Link2 size={24} className="text-blue-600 shrink-0" />
            <span>Connected Wallets &amp; Verification</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Review users&apos; linked external public wallet addresses, networks, and approve or reject verification requests in real time.
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
            onClick={() => fetchConnections(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-xs disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-600" : ""} />
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

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            statusFilter === "all"
              ? "border-blue-400 ring-1 ring-blue-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Total Linked
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-900">
              {metrics.total}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"))}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            statusFilter === "pending"
              ? "border-amber-400 ring-1 ring-amber-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Awaiting Review
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-500">
              {metrics.pending}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Clock size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === "approved" ? "all" : "approved"))}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            statusFilter === "approved"
              ? "border-emerald-400 ring-1 ring-emerald-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Verified / Approved
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600">
              {metrics.approved}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={19} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === "rejected" ? "all" : "rejected"))}
          className={`text-left bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between transition ${
            statusFilter === "rejected"
              ? "border-red-400 ring-1 ring-red-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">
              Rejected
            </span>
            <span className="text-xl sm:text-2xl font-black text-red-500">
              {metrics.rejected}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <XCircle size={19} />
          </div>
        </button>
      </div>

      {/* Network Filter Pills (shown when networks exist) */}
      {metrics.networks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Globe size={13} className="text-blue-600" />
              Filter by Network
            </span>
            {networkFilter !== "all" && (
              <button
                type="button"
                onClick={() => setNetworkFilter("all")}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Show All Networks
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNetworkFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                networkFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              All ({metrics.total})
            </button>
            {metrics.networks.map((net) => {
              const active = networkFilter === net.name;
              return (
                <button
                  key={net.name}
                  type="button"
                  onClick={() => setNetworkFilter(active ? "all" : net.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <span>{net.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {net.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Status Tabs */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by public address, user, email, UID, network, provider, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f9fafb] border border-gray-200 text-gray-900 text-xs sm:text-sm rounded-lg pl-9 pr-8 py-2 outline-none focus:border-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: "all", label: "All", count: metrics.total },
              { id: "pending", label: "Pending", count: metrics.pending },
              { id: "approved", label: "Approved", count: metrics.approved },
              { id: "rejected", label: "Rejected", count: metrics.rejected },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={28} />
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Loading connected wallets...
            </p>
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Link2 size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
              No Connected Wallets Found
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || networkFilter !== "all"
                ? "No linked wallet records match your current search or filters."
                : "When users submit a public wallet address from Connect Wallet in their dashboard, it will appear here instantly for review and verification."}
            </p>
            {(searchQuery || statusFilter !== "all" || networkFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setNetworkFilter("all");
                }}
                className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb] text-gray-600 uppercase tracking-wider border-b border-gray-200 font-bold text-[11px]">
                  <th className="py-3.5 px-3 w-12 text-center">#</th>
                  <th className="py-3.5 px-3 min-w-[200px]">User</th>
                  <th className="py-3.5 px-3 min-w-[250px]">Public Address &amp; Network</th>
                  <th className="py-3.5 px-3 min-w-[175px]">Purpose &amp; Origin</th>
                  <th className="py-3.5 px-3 min-w-[125px]">Submitted</th>
                  <th className="py-3.5 px-3 min-w-[115px] text-center">Status</th>
                  <th className="py-3.5 px-3 min-w-[185px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredConnections.map((row, idx) => {
                  const isProcessing = processingId === row.id;
                  const initials = getInitials(row.user.displayName, row.user.email);
                  const explorerUrl = getExplorerUrl(row.address, row.network);

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* # & Delete */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <span className="font-mono text-[11px]">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            disabled={isProcessing}
                            className="p-1 hover:text-red-600 transition disabled:opacity-40"
                            title="Delete linked wallet record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            {row.user.avatarUrl ? (
                              <img
                                src={row.user.avatarUrl}
                                alt={row.user.displayName}
                                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                {initials}
                              </div>
                            )}
                            {row.user.presence === "online" && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                                title="Online now"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/members/${row.userId}`}
                              className="font-bold text-gray-900 hover:text-blue-600 hover:underline block truncate max-w-[170px]"
                              title={row.user.displayName}
                            >
                              {row.user.displayName}
                            </Link>
                            {row.user.email && (
                              <span
                                className="text-[11px] text-gray-500 block truncate max-w-[170px]"
                                title={row.user.email}
                              >
                                {row.user.email}
                              </span>
                            )}
                            {row.user.walletUid && (
                              <button
                                type="button"
                                onClick={() => handleCopy(row.user.walletUid!, "Account UID")}
                                className="text-[10px] text-gray-400 font-mono hover:text-blue-600 inline-flex items-center gap-1 mt-0.5"
                              >
                                <span>UID: {row.user.walletUid}</span>
                                <Copy size={10} className="opacity-60" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Public Address & Network */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${getNetworkBadgeStyle(
                                row.network
                              )}`}
                            >
                              {row.network}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-semibold">
                              {row.walletProvider}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(row.address, "Public Address")}
                              className="font-mono text-[12px] text-gray-800 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 px-2 py-0.5 rounded inline-flex items-center gap-1.5 transition"
                              title={`Click to copy: ${row.address}`}
                            >
                              <span>{shortenAddress(row.address)}</span>
                              <Copy size={11} className="opacity-60 shrink-0" />
                            </button>
                            {explorerUrl && (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-400 hover:text-blue-600 transition"
                                title="Inspect address on block explorer"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Purpose & Origin */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <p
                            className="text-xs font-semibold text-gray-700 truncate max-w-[200px]"
                            title={row.label || "External wallet verification"}
                          >
                            {row.label || "External Wallet Link"}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(row.countryCode || row.countryName) && (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50/60 border border-blue-100 px-1.5 py-0.5 rounded">
                                <CountryFlag
                                  countryCode={row.countryCode}
                                  countryName={row.countryName}
                                  size="xs"
                                  textClassName="text-[11px] font-medium text-gray-700"
                                />
                              </span>
                            )}
                            {row.ip && (
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {row.ip}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Submitted */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="text-xs font-semibold text-gray-800">
                          {formatRelativeTime(row.submittedAt)}
                        </div>
                        <div
                          className="text-[11px] text-gray-400"
                          title={formatFullTimestamp(row.submittedAt)}
                        >
                          {new Date(row.submittedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {row.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} /> Approved
                            </span>
                          ) : row.status === "rejected" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <XCircle size={11} /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={11} /> Pending
                            </span>
                          )}
                          {row.adminNote && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-gray-500 max-w-[125px] truncate"
                              title={row.adminNote}
                            >
                              <MessageSquare size={9} className="shrink-0" />
                              {row.adminNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 font-bold text-xs">
                          <button
                            type="button"
                            onClick={() => openInspectModal(row)}
                            className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition inline-flex items-center gap-1 text-[11px] font-bold"
                            title="Inspect details & review note"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>

                          {isProcessing ? (
                            <Loader2 size={15} className="animate-spin text-blue-600 ml-1" />
                          ) : row.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAction(row, "approve")}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openInspectModal(row)}
                                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition text-xs font-bold shadow-xs"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              {row.status !== "approved" && (
                                <button
                                  type="button"
                                  onClick={() => handleAction(row, "approve")}
                                  className="px-2 py-1 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition text-[11px] font-bold"
                                >
                                  Approve
                                </button>
                              )}
                              {row.status !== "rejected" && (
                                <button
                                  type="button"
                                  onClick={() => openInspectModal(row)}
                                  className="px-2 py-1 rounded border border-red-600 text-red-700 hover:bg-red-50 transition text-[11px] font-bold"
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAction(row, "pending")}
                                className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                                title="Reset to Pending"
                              >
                                <RotateCcw size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection & Review Modal */}
      {selectedRow && (
        <div
          onClick={() => setSelectedRow(null)}
          className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-gray-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-200 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-blue-600" />
                  <span>Linked Public Wallet Verification</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Submitted {formatFullTimestamp(selectedRow.submittedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* User Banner */}
            <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                {selectedRow.user.avatarUrl ? (
                  <img
                    src={selectedRow.user.avatarUrl}
                    alt={selectedRow.user.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {getInitials(selectedRow.user.displayName, selectedRow.user.email)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 truncate">
                    {selectedRow.user.displayName}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{selectedRow.user.email}</div>
                  {selectedRow.user.walletUid && (
                    <div className="text-[11px] font-mono text-gray-400">
                      UID: {selectedRow.user.walletUid}
                    </div>
                  )}
                </div>
              </div>
              <Link
                href={`/admin/members/${selectedRow.userId}`}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:border-blue-500 text-xs font-bold text-gray-700 hover:text-blue-600 transition shrink-0"
              >
                Open Member Profile
              </Link>
            </div>

            {/* Public Address Highlight Box */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Linked Public Wallet Address
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedRow.address, "Public Address")}
                    className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  {getExplorerUrl(selectedRow.address, selectedRow.network) && (
                    <a
                      href={getExplorerUrl(selectedRow.address, selectedRow.network)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-gray-600 hover:text-blue-600 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Explorer
                    </a>
                  )}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm break-all select-all">
                {selectedRow.address}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Network
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-bold ${getNetworkBadgeStyle(
                    selectedRow.network
                  )}`}
                >
                  {selectedRow.network}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Wallet Provider
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {selectedRow.walletProvider}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Purpose / Label
                </span>
                <span className="text-xs font-semibold text-gray-800">
                  {selectedRow.label || "External Wallet Verification"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Origin IP &amp; Country
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {(selectedRow.countryCode || selectedRow.countryName) && (
                    <CountryFlag
                      countryCode={selectedRow.countryCode}
                      countryName={selectedRow.countryName}
                      size="xs"
                      textClassName="text-xs font-semibold text-gray-800"
                    />
                  )}
                  <span className="font-mono text-xs text-gray-500">
                    {selectedRow.ip || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Status & Review Metadata */}
            {selectedRow.reviewedAt && (
              <div className="mb-5 text-xs text-gray-500 bg-blue-50/50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                Last reviewed on{" "}
                <strong className="text-gray-800">
                  {formatFullTimestamp(selectedRow.reviewedAt)}
                </strong>{" "}
                by <strong className="text-gray-800">{selectedRow.reviewedBy || "Admin"}</strong>
              </div>
            )}

            {/* Admin Note Input */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                Admin Review Note{" "}
                <span className="text-gray-400 font-normal">
                  (Optional — displayed to user if rejected)
                </span>
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="e.g., Address format confirmed on Ethereum mainnet, or Reason for rejection..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Modal Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => handleAction(selectedRow, "pending", "")}
                disabled={processingId === selectedRow.id}
                className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Reset to Pending</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(selectedRow, "reject", reviewNote)}
                  disabled={processingId === selectedRow.id}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {processingId === selectedRow.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span>Reject Verification</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction(selectedRow, "approve", reviewNote)}
                  disabled={processingId === selectedRow.id}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {processingId === selectedRow.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Approve Verification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
