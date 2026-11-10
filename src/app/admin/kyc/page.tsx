"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  FileCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Download, 
  Eye, 
  Trash2, 
  X, 
  Loader2, 
  Copy,
  RefreshCw,
  User,
  ShieldCheck,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import { CountryFlag } from "@/components/ui/CountryFlag";

interface KycRequest {
  id: string;
  user_id: string;
  country: string;
  document_type: string;
  document_number: string;
  image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    walletId?: string;
    avatar_url?: string;
  };
}

export default function AdminKycPage() {
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; name: string; docType: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/kyc', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRequests(data.requests);
        }
      } else {
        toast.error("Failed to load KYC applications");
      }
    } catch (err) {
      console.error("KYC fetch error:", err);
      toast.error("Error loading KYC requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAction = async (applicationId: string, userId: string, action: 'approve' | 'reject' | 'pending') => {
    const actionLabel = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'reset';
    if (!window.confirm(`Are you sure you want to ${actionLabel} this KYC application?`)) return;

    setProcessingId(applicationId);

    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, userId, action })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
        // Optimistic state update for instant UI feedback
        setRequests(prev => prev.map(req => req.id === applicationId ? { ...req, status: targetStatus } : req));
        toast.success(`KYC application ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'} successfully`);
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch (err) {
      toast.error("Error processing KYC action");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this KYC application record?")) return;

    try {
      const res = await fetch(`/api/admin/kyc?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== id));
        toast.success("Application deleted");
      } else {
        toast.error("Failed to delete application");
      }
    } catch (e) {
      toast.error("Error deleting application");
    }
  };

  // Direct single-click download via Blob (no page redirect)
  const downloadImageDirectly = async (imageUrl: string, name: string) => {
    if (!imageUrl) return;
    setIsDownloading(true);
    try {
      toast.info("Downloading document image...");
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Fetch failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `KYC_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Document downloaded successfully.");
    } catch (err) {
      console.warn("Direct download fallback:", err);
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `KYC_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text || text === 'N/A') return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Search & Filter
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = (req.profiles?.full_name || '').toLowerCase();
        const email = (req.profiles?.email || '').toLowerCase();
        const uid = (req.profiles?.walletId || '').toLowerCase();
        const docNum = (req.document_number || '').toLowerCase();
        const country = (req.country || '').toLowerCase();
        const docType = (req.document_type || '').toLowerCase();
        const userId = (req.user_id || '').toLowerCase();

        const match = 
          fullName.includes(q) || 
          email.includes(q) || 
          uid.includes(q) || 
          docNum.includes(q) || 
          country.includes(q) || 
          docType.includes(q) ||
          userId.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  return (
    <div className="w-full max-w-full font-sans pb-16">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck size={24} className="text-blue-600 shrink-0" />
            <span>KYC Verification Applications</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Review submitted government ID documents and manage verification statuses.
          </p>
        </div>

        <button
          onClick={() => fetchRequests(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-gray-300 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-600" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">Total Requests</span>
            <span className="text-xl sm:text-2xl font-black text-gray-900">{metrics.total}</span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <FileCheck size={18} />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">Awaiting Review</span>
            <span className="text-xl sm:text-2xl font-black text-amber-500">{metrics.pending}</span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold shrink-0">
            <Clock size={18} />
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">Approved</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600">{metrics.approved}</span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block truncate">Rejected</span>
            <span className="text-xl sm:text-2xl font-black text-red-500">{metrics.rejected}</span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-bold shrink-0">
            <XCircle size={18} />
          </div>
        </div>

      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Name, Email, UID, Doc #, Country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f9fafb] border border-gray-200 text-gray-900 text-xs sm:text-sm rounded-lg pl-9 pr-8 py-2 outline-none focus:border-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All', count: metrics.total },
            { id: 'pending', label: 'Pending', count: metrics.pending },
            { id: 'approved', label: 'Approved', count: metrics.approved },
            { id: 'rejected', label: 'Rejected', count: metrics.rejected }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
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
            <p className="text-xs sm:text-sm font-medium text-gray-500">Loading KYC applications...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <FileCheck size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1">No Applications Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' 
                ? "No applications match your search and filter criteria." 
                : "No users have submitted KYC verification requests yet."}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
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
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 min-w-[190px]">User</th>
                  <th className="py-3 px-3 min-w-[180px]">Document & Country</th>
                  <th className="py-3 px-3 min-w-[130px]">Proof Photo</th>
                  <th className="py-3 px-3 min-w-[110px]">Submitted</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Status</th>
                  <th className="py-3 px-3 min-w-[140px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req, index) => {
                  const username = req.profiles?.full_name || req.profiles?.email || 'User';
                  const email = req.profiles?.email || '';
                  const uid = req.profiles?.walletId || '';
                  const isProcessing = processingId === req.id;

                  // Initials for avatar
                  const initials = username
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'U';

                  return (
                    <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                      
                      {/* # and Delete */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <span className="font-mono text-[11px]">{index + 1}</span>
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="p-1 hover:text-red-600 transition"
                            title="Delete application"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                      {/* User Profile */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {req.profiles?.avatar_url ? (
                            <img 
                              src={req.profiles.avatar_url} 
                              alt={username} 
                              className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link 
                              href={`/admin/members/${req.user_id}`}
                              className="font-bold text-gray-900 hover:text-blue-600 hover:underline block truncate max-w-[160px]"
                              title={username}
                            >
                              {username}
                            </Link>
                            {email && (
                              <span className="text-[11px] text-gray-500 block truncate max-w-[160px]" title={email}>
                                {email}
                              </span>
                            )}
                            {uid && uid !== 'N/A' && (
                              <button 
                                onClick={() => handleCopy(uid, 'UID')}
                                className="text-[10px] text-gray-400 font-mono hover:text-blue-600 flex items-center gap-1 mt-0.5"
                                title="Click to copy UID"
                              >
                                <span>UID: {uid}</span>
                                <Copy size={10} className="opacity-60" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Document Details & Country */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold text-[11px] capitalize">
                              {req.document_type || 'ID Card'}
                            </span>
                            {req.country && req.country !== 'N/A' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-700 font-semibold bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded">
                                <CountryFlag countryName={req.country} size="xs" textClassName="text-[11px] font-semibold text-gray-700" />
                              </span>
                            )}
                          </div>
                          {req.document_number && req.document_number !== 'N/A' && (
                            <button
                              onClick={() => handleCopy(req.document_number, 'ID Number')}
                              className="font-mono text-[11px] text-gray-600 hover:text-blue-600 flex items-center gap-1 transition"
                              title="Click to copy ID Number"
                            >
                              <span>#{req.document_number}</span>
                              <Copy size={10} className="opacity-50" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Document Proof / Photo */}
                      <td className="py-3 px-3">
                        {req.image_url ? (
                          <div className="flex items-center gap-2">
                            <div 
                              onClick={() => setImageModal({ url: req.image_url, name: username, docType: req.document_type || 'ID' })}
                              className="w-12 h-9 rounded-md bg-gray-100 border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-500 transition relative group shrink-0 shadow-xs"
                            >
                              <img src={req.image_url} alt="Proof" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                <Eye size={13} className="text-white" />
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => setImageModal({ url: req.image_url, name: username, docType: req.document_type || 'ID' })}
                                className="text-[11px] font-bold text-blue-600 hover:underline text-left"
                              >
                                View
                              </button>
                              <button
                                onClick={() => downloadImageDirectly(req.image_url, username)}
                                disabled={isDownloading}
                                className="text-[10px] text-gray-500 hover:text-blue-600 flex items-center gap-1 transition"
                                title="Download image directly"
                              >
                                <Download size={10} />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No image</span>
                        )}
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3 px-3 text-gray-500 text-xs font-medium whitespace-nowrap">
                        {req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : req.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <XCircle size={11} /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 font-bold text-xs">
                          {isProcessing ? (
                            <Loader2 size={15} className="animate-spin text-blue-600 mx-auto" />
                          ) : req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleAction(req.id, req.user_id, 'approve')}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleAction(req.id, req.user_id, 'reject')}
                                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition text-xs font-bold shadow-xs"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {req.status !== 'approved' && (
                                <button
                                  onClick={() => handleAction(req.id, req.user_id, 'approve')}
                                  className="px-2 py-1 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition text-[11px] font-bold"
                                >
                                  Approve
                                </button>
                              )}
                              {req.status !== 'rejected' && (
                                <button
                                  onClick={() => handleAction(req.id, req.user_id, 'reject')}
                                  className="px-2 py-1 rounded border border-red-600 text-red-700 hover:bg-red-50 transition text-[11px] font-bold"
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                onClick={() => handleAction(req.id, req.user_id, 'pending')}
                                className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition text-[11px] font-bold"
                                title="Reset to Pending status"
                              >
                                Reset
                              </button>
                            </div>
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

      {/* Document Image Modal Preview */}
      {imageModal && (
        <div 
          onClick={() => setImageModal(null)}
          className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 max-w-3xl w-full max-h-[90vh] flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600" />
                  <span>Document Verification Preview</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {imageModal.name} &bull; <span className="capitalize">{imageModal.docType}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* 1-Click Blob Download */}
                <button
                  onClick={() => downloadImageDirectly(imageModal.url, imageModal.name)}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-60 shadow-xs"
                >
                  {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>{isDownloading ? "Downloading..." : "Download"}</span>
                </button>

                <button
                  onClick={() => setImageModal(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 overflow-auto bg-[#0f172a] rounded-xl flex items-center justify-center p-3 min-h-[360px]">
              <img 
                src={imageModal.url} 
                alt="KYC Document Preview" 
                className="max-w-full max-h-[64vh] object-contain rounded shadow" 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
