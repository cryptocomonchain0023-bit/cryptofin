"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Copy, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { AssetIcon } from "@/components/dashboard/AssetIcon";
import {
  CancelTransactionModal,
  type AdminTransactionItem,
} from "@/components/admin/CancelTransactionModal";

const formatNetwork = (currency: string) => {
  if (!currency) return { token: "Unknown", network: "Unknown" };
  const token = currency.split("_")[0];
  let network = "Unknown";
  if (currency === "USDT" || currency === "USDC" || currency.includes("ERC20"))
    network = "Ethereum (ERC20)";
  else if (currency.includes("_TRX") || currency.includes("TRC20") || currency === "TRX")
    network = "Tron (TRC20)";
  else if (currency.includes("_BNB") || currency.includes("BEP20") || currency === "BNB")
    network = "BNB Smart Chain (BEP20)";
  else if (currency.includes("_SOL") || currency.includes("SOLANA") || currency === "SOL")
    network = "Solana";
  else if (
    currency.includes("_MATIC") ||
    currency.includes("POLYGON") ||
    currency === "MATIC" ||
    currency === "POL"
  )
    network = "Polygon";
  else if (currency.includes("_AVAX") || currency.includes("AVALANCHE") || currency === "AVAX")
    network = "Avalanche";
  else if (currency === "BTC") network = "Bitcoin";
  else if (currency === "ETH") network = "Ethereum";

  return { token, network };
};

const getAvatarInitials = (profile: AdminTransactionItem["profiles"]) => {
  if (profile?.first_name && profile?.last_name)
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  if (profile?.full_name) return profile.full_name.substring(0, 2).toUpperCase();
  if (profile?.email) return profile.email.substring(0, 2).toUpperCase();
  return "U";
};

const getDisplayName = (profile: AdminTransactionItem["profiles"]) => {
  if (profile?.first_name || profile?.last_name)
    return `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
  if (profile?.full_name) return profile.full_name;
  return "Unknown User";
};

export default function AdminDepositsPage() {
  const [transfers, setTransfers] = useState<AdminTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<AdminTransactionItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchTransfers = async () => {
    try {
      const res = await fetch("/api/admin/transactions?type=deposit", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AdminTransactionItem[] = await res.json();
      setTransfers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleUpdateStatus = async (
    txId: string,
    newStatus: string,
    userId: string,
    amount: number | string,
    currency: string
  ) => {
    if (!confirm(`Are you sure you want to ${newStatus} this deposit?`)) return;

    try {
      const res = await fetch("/api/admin/transactions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId, newStatus, userId, amount, currency, type: "deposit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Deposit ${newStatus} successfully.`);
      fetchTransfers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Error updating status: ${msg}`);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.id);
    try {
      const res = await fetch("/api/admin/transactions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: cancelTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel deposit");

      setTransfers((prev) => prev.filter((item) => item.id !== cancelTarget.id));
      toast.success(
        data.balanceAdjusted
          ? "Deposit cancelled, wiped from history, and wallet balance adjusted."
          : "Deposit cleared from transaction history."
      );
      setCancelTarget(null);
      fetchTransfers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cancelling deposit";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied");
  };

  if (loading)
    return <div className="p-8 text-center text-gray-500 font-medium">Loading deposits...</div>;

  const cancelTargetMeta = cancelTarget
    ? formatNetwork(cancelTarget.currency)
    : { token: "", network: "" };

  return (
    <div className="w-full animate-in fade-in duration-300 pb-12">
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="bg-[#1f2937] text-white px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold tracking-wider text-[15px] uppercase flex items-center gap-2">
            Manage Deposits
          </h3>
          <span className="bg-blue-500/20 text-blue-100 text-xs px-3 py-1 rounded-full border border-blue-500/30 font-medium">
            {transfers.filter((t) => t.status === "pending" || t.status === "processing").length}{" "}
            Pending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-4 border-r border-gray-100">Date & Time</th>
                <th className="px-5 py-4 border-r border-gray-100">User</th>
                <th className="px-5 py-4 border-r border-gray-100">Amount</th>
                <th className="px-5 py-4 border-r border-gray-100">Asset / Network</th>
                <th className="px-5 py-4 border-r border-gray-100">Destination</th>
                <th className="px-5 py-4 border-r border-gray-100">Status</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 text-sm">
                    No deposits found.
                  </td>
                </tr>
              ) : (
                transfers.map((tx) => {
                  const { token, network } = formatNetwork(tx.currency);
                  const isPending = tx.status === "pending" || tx.status === "processing";
                  const isSuccess = tx.status === "completed";

                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-100 hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="flex flex-col">
                          <span className="text-[13px] text-gray-900 font-medium">
                            {new Date(tx.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[11px] text-gray-500 font-medium mt-0.5">
                            {new Date(tx.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <Link
                          href={`/admin/members/${tx.user_id}`}
                          className="flex items-center gap-3 w-max"
                        >
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {tx.profiles?.avatar_url ? (
                              <img
                                src={tx.profiles.avatar_url}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              getAvatarInitials(tx.profiles)
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {getDisplayName(tx.profiles)}
                            </span>
                            <span className="text-gray-500 text-[12px] font-medium group-hover:text-blue-500 mt-0.5">
                              {tx.profiles?.email || "No email"}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-[15px] font-bold align-middle text-gray-900">
                        $
                        {Math.abs(Number(tx.amount)).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                            <AssetIcon symbol={token} size="sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-gray-900">{token}</span>
                            <span className="text-[11px] font-medium text-gray-500 mt-0.5">
                              {network}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle max-w-[200px]">
                        {tx.to_address ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-600 font-mono truncate bg-gray-100 px-2 py-1 rounded border border-gray-200">
                              {tx.to_address.length > 20
                                ? `${tx.to_address.slice(0, 8)}...${tx.to_address.slice(-6)}`
                                : tx.to_address}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleCopy(tx.to_address!)}
                                className="text-gray-400 hover:text-blue-600 p-1 bg-gray-50 rounded border border-gray-200 transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[13px] text-gray-400 italic">Internal</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                            isSuccess
                              ? "bg-green-50 border-green-200 text-green-700"
                              : isPending
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 size={13} className="text-green-600" />
                          ) : isPending ? (
                            <Clock size={13} className="text-amber-600" />
                          ) : (
                            <XCircle size={13} className="text-red-600" />
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wide">
                            {tx.status || "pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          {isPending && (
                            <>
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    tx.id,
                                    "completed",
                                    tx.user_id,
                                    tx.amount,
                                    tx.currency
                                  )
                                }
                                className="bg-[#10b981] text-white px-3.5 py-1.5 rounded text-xs font-bold hover:bg-[#059669] transition-all shadow-sm active:scale-95 whitespace-nowrap"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    tx.id,
                                    "rejected",
                                    tx.user_id,
                                    tx.amount,
                                    tx.currency
                                  )
                                }
                                className="bg-red-500 text-white px-3.5 py-1.5 rounded text-xs font-bold hover:bg-red-600 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setCancelTarget(tx)}
                            title="Cancel & wipe deposit from history and wallet balance"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                              isPending
                                ? "bg-white text-gray-600 border-gray-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300"
                                : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600"
                            }`}
                          >
                            <Trash2 size={13} />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CancelTransactionModal
        transaction={cancelTarget}
        kind="deposit"
        token={cancelTargetMeta.token}
        network={cancelTargetMeta.network}
        displayName={cancelTarget ? getDisplayName(cancelTarget.profiles) : ""}
        isSubmitting={cancellingId !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
