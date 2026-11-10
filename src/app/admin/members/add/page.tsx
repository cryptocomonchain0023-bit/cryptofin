"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-client";
import { ArrowLeft, Save, Wallet, Shield, User, Landmark, Building2, Smartphone, AlertTriangle } from "lucide-react";

export default function AddMemberPage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { setProfile({}); setLoading(false); }, []); /*
    const fetchData = async () => {
      if (!params.id) return;
      
      try {
        const res = await fetch(`/api/admin/users`, { cache: 'no-store' });
        const data = await res.json();
        
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to fetch user');
        } else if (data.profile) {
          setProfile(data.profile);
        } else {
          setErrorMsg('Profile data is missing');
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Network error');
      }
      setLoading(false);
    };
    fetchData();
  */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Personal Info
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          country: profile.country,
          address: profile.address,
          dob: profile.dob,
          
          // Account Info
          status: profile.status,
          account_type: profile.account_type,
          currency: profile.currency,
          account_number: profile.account_number,
          kyc_status: profile.kyc_status,
          
          // Fiat Balances
          wallet_balance: profile.wallet_balance,
          savings_balance: profile.savings_balance,
          
          // Crypto Balances
          usdt_erc20_balance: profile.usdt_erc20_balance,
          usdt_trc20_balance: profile.usdt_trc20_balance,
          usdt_bep20_balance: profile.usdt_bep20_balance,
          usdc_bep20_balance: profile.usdc_bep20_balance,
          usdc_solana_balance: profile.usdc_solana_balance,
          
          // Crypto Addresses
          usdt_erc20_address: profile.usdt_erc20_address,
          usdt_trc20_address: profile.usdt_trc20_address,
          usdt_bep20_address: profile.usdt_bep20_address,
          usdc_bep20_address: profile.usdc_bep20_address,
          usdc_solana_address: profile.usdc_solana_address,
          
          // Credentials & Security
          soft_token: profile.soft_token,
          generated_user_id: profile.generated_user_id,
          generated_pin: profile.generated_pin,
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      
      alert("User created successfully!");
    } catch (err: any) {
      alert("Error creating user: " + err.message);
    }
    setSaving(false);
  };

  const handleChange = (field: string, value: any) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="p-8 text-[#333333]">Loading...</div>;
  if (errorMsg) return <div className="p-8 text-red-500 font-bold break-all">API ERROR: {errorMsg}</div>;
  

  return (
    <div className="w-full bg-[#f8f9fa] min-h-[calc(100vh-55px)] pb-20 font-sans">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin/members" className="text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-lg font-bold text-gray-800">Add New User</h2>
        </div>
        <div className="flex items-center gap-3">
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#2196F3] text-white px-5 py-2 rounded font-bold hover:bg-[#1976D2] transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded shadow-sm">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-yellow-800">Administrator Warning</h3>
              <p className="text-xs text-yellow-700 mt-1">
                You have full edit access to this user's profile. Please exercise extreme caution when modifying sensitive details such as Balances, Account Numbers, or Security Tokens. These changes instantly affect the user's dashboard.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Personal Details */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 border-b pb-3">
              <User className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-[15px] font-bold text-gray-800 uppercase tracking-wide">Personal Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">First Name</label>
                <input type="text" value={profile.first_name || ''} onChange={(e) => handleChange('first_name', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Last Name</label>
                <input type="text" value={profile.last_name || ''} onChange={(e) => handleChange('last_name', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Email Address</label>
                <input type="email" value={profile.email || ''} onChange={(e) => handleChange('email', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Phone Number</label>
                <input type="text" value={profile.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Date of Birth</label>
                <input type="date" value={profile.dob || ''} onChange={(e) => handleChange('dob', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Country</label>
                <input type="text" value={profile.country || ''} onChange={(e) => handleChange('country', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[#333] text-[13px] font-bold mb-1">Address</label>
                <input type="text" value={profile.address || ''} onChange={(e) => handleChange('address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" />
              </div>
            </div>
          </div>

          {/* Section 2: Account & Status */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 border-b pb-3">
              <Landmark className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-[15px] font-bold text-gray-800 uppercase tracking-wide">Account Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Account Number</label>
                <input type="text" value={profile.account_number || ''} onChange={(e) => handleChange('account_number', e.target.value)} className="w-full border border-red-200 bg-red-50 rounded px-3 py-2 outline-none font-mono focus:border-red-400" />
                <p className="text-[10px] text-red-600 mt-1 font-semibold">CAUTION: Modifying changes user's bank account ID</p>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Account Type</label>
                <select value={profile.account_type || ''} onChange={(e) => handleChange('account_type', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]">
                  <option value="">Select Type</option>
                  <option value="Checking">Checking Account</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Business">Business Account</option>
                  <option value="Offshore">Offshore Account</option>
                </select>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Currency</label>
                <input type="text" value={profile.currency || 'USD'} onChange={(e) => handleChange('currency', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]" placeholder="e.g. USD, EUR, GBP" />
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Login Status</label>
                <select value={profile.status || 'Active'} onChange={(e) => handleChange('status', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]">
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">KYC Status</label>
                <select value={profile.kyc_status || 'pending'} onChange={(e) => handleChange('kyc_status', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#2196F3]">
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Fiat Balances */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 border-b pb-3">
              <Building2 className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-[15px] font-bold text-gray-800 uppercase tracking-wide">Fiat Balances</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Available Balance ({profile.currency || 'USD'})</label>
                <input type="number" step="0.01" value={profile.wallet_balance || 0} onChange={(e) => handleChange('wallet_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono focus:border-orange-400" />
                <p className="text-[10px] text-orange-600 mt-1 font-semibold">CAUTION: Changes user's total available fiat</p>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Savings Balance ({profile.currency || 'USD'})</label>
                <input type="number" step="0.01" value={profile.savings_balance || 0} onChange={(e) => handleChange('savings_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono focus:border-orange-400" />
                <p className="text-[10px] text-orange-600 mt-1 font-semibold">CAUTION: Changes user's total savings</p>
              </div>
            </div>
          </div>

          {/* Section 4: Crypto Settings */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 border-b pb-3">
              <Wallet className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-[15px] font-bold text-gray-800 uppercase tracking-wide">Crypto Wallet Configuration (Stablecoins)</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8">
              
              {/* USDT ERC20 */}
              <div className="space-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-sm text-gray-700">Tether (USDT - ERC20)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Balance</label>
                    <input type="number" step="0.01" value={profile.usdt_erc20_balance || 0} onChange={(e) => handleChange('usdt_erc20_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono text-sm focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Deposit Wallet Address</label>
                    <input type="text" value={profile.usdt_erc20_address || ''} onChange={(e) => handleChange('usdt_erc20_address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none font-mono text-xs focus:border-[#2196F3]" placeholder="Default: 0xE6bbb7D8A..." />
                  </div>
                </div>
              </div>

              {/* USDT TRC20 */}
              <div className="space-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-sm text-gray-700">Tether (USDT - TRC20)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Balance</label>
                    <input type="number" step="0.01" value={profile.usdt_trc20_balance || 0} onChange={(e) => handleChange('usdt_trc20_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono text-sm focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Deposit Wallet Address</label>
                    <input type="text" value={profile.usdt_trc20_address || ''} onChange={(e) => handleChange('usdt_trc20_address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none font-mono text-xs focus:border-[#2196F3]" placeholder="Default: TFdVrsUjZgy..." />
                  </div>
                </div>
              </div>

              {/* USDT BEP20 */}
              <div className="space-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-sm text-gray-700">Tether (USDT - BEP20)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Balance</label>
                    <input type="number" step="0.01" value={profile.usdt_bep20_balance || 0} onChange={(e) => handleChange('usdt_bep20_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono text-sm focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Deposit Wallet Address</label>
                    <input type="text" value={profile.usdt_bep20_address || ''} onChange={(e) => handleChange('usdt_bep20_address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none font-mono text-xs focus:border-[#2196F3]" placeholder="Default: 0xE6bbb7D8A..." />
                  </div>
                </div>
              </div>

              {/* USDC BEP20 */}
              <div className="space-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-sm text-gray-700">USDC (BEP20)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Balance</label>
                    <input type="number" step="0.01" value={profile.usdc_bep20_balance || 0} onChange={(e) => handleChange('usdc_bep20_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono text-sm focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Deposit Wallet Address</label>
                    <input type="text" value={profile.usdc_bep20_address || ''} onChange={(e) => handleChange('usdc_bep20_address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none font-mono text-xs focus:border-[#2196F3]" placeholder="Default: 0xE6bbb7D8A..." />
                  </div>
                </div>
              </div>

              {/* USDC Solana */}
              <div className="space-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-sm text-gray-700">USDC (Solana)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Balance</label>
                    <input type="number" step="0.01" value={profile.usdc_solana_balance || 0} onChange={(e) => handleChange('usdc_solana_balance', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono text-sm focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[#555] text-xs font-bold mb-1">Deposit Wallet Address</label>
                    <input type="text" value={profile.usdc_solana_address || ''} onChange={(e) => handleChange('usdc_solana_address', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 outline-none font-mono text-xs focus:border-[#2196F3]" placeholder="Default: 465xjijipUG..." />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 5: Credentials & Security */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center gap-2 mb-6 border-b pb-3">
              <Shield className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-[15px] font-bold text-gray-800 uppercase tracking-wide">Credentials & Security</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Generated User ID</label>
                <input type="text" value={profile.generated_user_id || ''} onChange={(e) => handleChange('generated_user_id', e.target.value)} className="w-full border border-red-200 bg-red-50 rounded px-3 py-2 outline-none focus:border-red-400" />
                <p className="text-[10px] text-red-600 mt-1 font-semibold">CAUTION: Modifying changes login ID</p>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1">Generated PIN / Password</label>
                <input type="text" value={profile.generated_pin || ''} onChange={(e) => handleChange('generated_pin', e.target.value)} className="w-full border border-red-200 bg-red-50 rounded px-3 py-2 outline-none focus:border-red-400" />
                <p className="text-[10px] text-red-600 mt-1 font-semibold">CAUTION: Modifying resets password</p>
              </div>
              <div>
                <label className="block text-[#333] text-[13px] font-bold mb-1 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-gray-500" /> Soft Token (OTP)
                </label>
                <input type="text" value={profile.soft_token || ''} onChange={(e) => handleChange('soft_token', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded px-3 py-2 outline-none font-mono focus:border-orange-400" placeholder="6-digit token code" />
                <p className="text-[10px] text-orange-600 mt-1 font-semibold">Current linked OTP token</p>
              </div>
            </div>
          </div>
          
        </form>
      </div>
    </div>
  );
}

