"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from 'sonner';
import { adminFetch } from "@/lib/admin-client";

export default function AdminAddFundsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  
  // Wallet selection
  const [walletType, setWalletType] = useState("main"); // 'main', 'btc', 'eth', 'usdt'
  
  // Form fields
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
  const [submitting, setSubmitting] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setDate(today);

    const fetchUsers = async () => {
      try {
        const res = await adminFetch('/api/admin/users');
        const data = await res.json();
        if (data.users) setUsers(data.users);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
      setLoading(false);
    };
    fetchUsers();
    
    const fetchPrices = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin,solana,tron,binancecoin,matic-network,avalanche-2&vs_currencies=usd');
        const data = await res.json();
        setPrices({
          btc: data.bitcoin?.usd || 0,
          eth: data.ethereum?.usd || 0,
          usdt_erc20: data.tether?.usd || 1,
          usdt_trc20: data.tether?.usd || 1,
          usdt_bep20: data.tether?.usd || 1,
          usdc_solana: data['usd-coin']?.usd || 1,
          usdc_bep20: data['usd-coin']?.usd || 1,
          sol: data.solana?.usd || 0,
          trx: data.tron?.usd || 0,
          bnb: data.binancecoin?.usd || 0,
          matic: data['matic-network']?.usd || 0,
          avax: data['avalanche-2']?.usd || 0,
          main: 1, // USD is 1
        });
      } catch (error) {
        console.error("Failed to fetch prices:", error);
      }
    };
    fetchPrices();
  }, []);
  
  // Calculate equivalent amounts
  useEffect(() => {
    const rate = prices[walletType] || 0;
    if (!rate) return;
    
    if (inputMode === 'crypto') {
        if (!amount) setAmountUsd("");
        else setAmountUsd((parseFloat(amount) * rate).toFixed(2));
    } else {
        if (!amountUsd) setAmount("");
        else setAmount((parseFloat(amountUsd) / rate).toFixed(6));
    }
  }, [amount, amountUsd, inputMode, walletType, prices]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || isNaN(Number(amount))) {
      toast.error("Please select a user and enter a valid amount.");
      return;
    }

    setSubmitting(true);
    
    let finalDate = date;
    const todayString = new Date().toISOString().split('T')[0];
    if (customTime) {
      finalDate = new Date(`${date}T${customTime}:00`).toISOString();
    } else if (date === todayString) {
      finalDate = new Date().toISOString();
    } else {
      const now = new Date();
      const hr = now.getHours().toString().padStart(2, '0');
      const mn = now.getMinutes().toString().padStart(2, '0');
      finalDate = `${date}T${hr}:${mn}:00.000Z`;
    }
    
    try {
      const res = await fetch('/api/admin/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedUser, walletType, amount, fromName, fromBank,
          fromAddress, txHash, date: finalDate, sendEmail
        })
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to add funds.");
      } else {
        toast.success(sendEmail ? "Funds successfully added and email notification sent!" : "Funds successfully added!");
        setAmount("");
        setAmountUsd("");
        setFromName("");
        setFromBank("");
        setFromAddress("");
        setTxHash("");
        setSelectedUser("");
        
        // Refresh users
        const usersRes = await adminFetch('/api/admin/users');
        const usersData = await usersRes.json();
        if (usersData.users) setUsers(usersData.users);
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    }
    
    setSubmitting(false);
  };
  
  const getBalanceDisplay = (u: any, type: string) => {
    const w = u?.wallet || u || {};
    if (type === 'main') return `$${Number(w.wallet_balance || 0).toLocaleString()}`;
    if (type === 'usdt_erc20') return `${Number(w.usdt_erc20_balance || 0)} USDT`;
    if (type === 'usdt_trc20') return `${Number(w.usdt_trc20_balance || 0)} USDT`;
    if (type === 'usdt_bep20') return `${Number(w.usdt_bep20_balance || 0)} USDT`;
    if (type === 'usdc_solana') return `${Number(w.usdc_solana_balance || 0)} USDC`;
    if (type === 'usdc_bep20') return `${Number(w.usdc_bep20_balance || 0)} USDC`;
    if (type === 'btc') return `${Number(w.btc_balance || 0)} BTC`;
    if (type === 'eth') return `${Number(w.balance || 0)} ETH`;
    if (type === 'bnb') return `${Number(w.bnb_balance || 0)} BNB`;
    if (type === 'sol') return `${Number(w.sol_balance || 0)} SOL`;
    if (type === 'trx') return `${Number(w.trx_balance || 0)} TRX`;
    if (type === 'matic') return `${Number(w.matic_balance || 0)} MATIC`;
    if (type === 'avax') return `${Number(w.avax_balance || 0)} AVAX`;
    return '0';
  };

  const formatName = (u: any) => {
      if (u.full_name) return u.full_name;
      if (u.first_name || u.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
      return "User";
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="w-full animate-in fade-in duration-300 max-w-3xl">
      <Toaster position="top-center" richColors />
      <div className="bg-white border border-[#4EA7F8] rounded-sm shadow-sm overflow-hidden mb-8 relative">
        <div className="px-6 py-5 border-b border-[#EAEAEA] flex justify-between items-center">
          <h3 className="font-bold text-gray-600 text-[15px] uppercase tracking-wider">Add Funds</h3>
          <a href="/admin/deposits" className="text-[#3498db] text-xs font-bold hover:underline">Go to Manage Deposits</a>
        </div>
        
        <form onSubmit={handleAddFunds} className="p-4 md:p-8 space-y-6">
          <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">Crypto Asset: <span className="text-red-500">*</span></label>
                <select 
                  value={walletType}
                  onChange={e => setWalletType(e.target.value)}
                  className="w-full border border-gray-300 p-3 rounded-sm bg-gray-50 outline-none focus:border-[#3498db] text-base text-gray-700"
                >
                  <option value="btc">Bitcoin (BTC)</option>
                  <option value="eth">Ethereum (ETH)</option>
                  <option value="usdt_erc20">USDT (ERC20)</option>
                  <option value="usdt_trc20">USDT (TRC20)</option>
                  <option value="usdt_bep20">USDT (BEP20)</option>
                  <option value="usdc_solana">USDC (Solana)</option>
                  <option value="usdc_bep20">USDC (BEP20)</option>
                  <option value="bnb">BNB (BEP20)</option>
                  <option value="sol">Solana (SOL)</option>
                  <option value="trx">Tron (TRX)</option>
                  <option value="matic">Polygon (MATIC)</option>
                  <option value="avax">Avalanche (AVAX)</option>
                </select>
              </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">User: <span className="text-red-500">*</span></label>
            <div 
              onClick={() => setShowUserModal(true)}
              className="w-full border border-gray-300 p-3 rounded-sm bg-gray-50 text-base text-gray-700 cursor-pointer flex justify-between items-center hover:border-[#3498db] transition-colors"
            >
              <span>
                {selectedUser 
                  ? (() => {
                      const u = users.find(x => x.id === selectedUser);
                      return u ? `${formatName(u)} (${u.email})` : 'Select a user...';
                    })()
                  : 'Select a user...'}
              </span>
              <span className="text-gray-400 font-bold">?</span>
            </div>
          </div>

          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Sending Wallet Address: <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input 
                type="text"
                value={fromAddress}
                onChange={e => setFromAddress(e.target.value)}
                placeholder="The crypto address the funds were sent from"
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Transaction ID / Blockchain ID: <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input 
                type="text"
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                placeholder="TxHash"
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-mono"
              />
            </div>
          </>

          <div>
            <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-gray-700">Amount / Quantity: <span className="text-red-500">*</span></label>
                <div className="flex bg-gray-100 rounded-sm p-1 border border-gray-200">
                    <button 
                        type="button"
                        onClick={() => setInputMode('crypto')}
                        className={`text-xs px-3 py-1 font-bold rounded-sm ${inputMode === 'crypto' ? 'bg-white shadow-sm text-[#3498db]' : 'text-gray-500'}`}
                    >
                        CRYPTO
                    </button>
                    <button 
                        type="button"
                        onClick={() => setInputMode('usd')}
                        className={`text-xs px-3 py-1 font-bold rounded-sm ${inputMode === 'usd' ? 'bg-white shadow-sm text-[#3498db]' : 'text-gray-500'}`}
                    >
                        USD
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    {inputMode === 'usd' && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</div>
                    )}
                    <input 
                      type="number"
                      step="any"
                      value={inputMode === 'crypto' ? amount : amountUsd}
                      onChange={e => {
                          if (inputMode === 'crypto') setAmount(e.target.value);
                          else setAmountUsd(e.target.value);
                      }}
                      placeholder="0.00"
                      className={`w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700 font-bold ${inputMode === 'usd' ? 'pl-7' : ''}`}
                      required
                    />
                </div>
                <div className="text-sm font-bold text-gray-400 whitespace-nowrap">
                    ? {inputMode === 'crypto' ? `$${amountUsd || '0.00'}` : `${amount || '0'} ${walletType.split('_')[0].toUpperCase()}`}
                </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Date: <span className="text-red-500">*</span></label>
              <input 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Custom Time: <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input 
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-sm outline-none focus:border-[#3498db] text-base text-gray-700"
              />
            </div>
          </div>

          <div className="flex flex-col mt-4 gap-4 border-t border-gray-100 pt-6">
            <div className="bg-gray-100 px-4 py-2 inline-flex self-start rounded border border-gray-200">
              <span className="text-gray-600 text-sm font-bold">Usable Balance: </span>
              {selectedUser && users.find(u => u.id === selectedUser) ? (
                <span className="ml-2 text-[#3498db] font-bold">
                    {getBalanceDisplay(users.find(u => u.id === selectedUser), walletType)}
                </span>
              ) : <span className="ml-2 text-gray-400">Select a user</span>}
            </div>

            <label className="flex items-center space-x-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={sendEmail} 
                onChange={e => setSendEmail(e.target.checked)} 
                className="w-4 h-4 text-[#3498db] border-gray-300 rounded cursor-pointer" 
              />
              <span className="text-sm font-bold text-red-600 group-hover:text-red-700">Send Email Notification</span>
            </label>
          </div>

          <div className="flex space-x-3 pt-2">
            <button 
              type="submit" 
              disabled={submitting}
              className="bg-[#00BFA5] text-white font-bold py-2.5 px-8 rounded-sm hover:bg-[#00a38c] transition-colors disabled:bg-gray-400 shadow-sm text-sm uppercase tracking-wide"
            >
              {submitting ? 'Processing...' : 'Submit'}
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
        <div className="fixed top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-[600px] flex flex-col max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-white border-b-2 border-blue-500 px-4 py-3">
              <h2 className="text-blue-500 text-sm font-bold tracking-widest uppercase">Select User</h2>
              <button 
                onClick={() => setShowUserModal(false)}
                className="bg-blue-500 hover:bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-sm transition-colors text-xs font-bold"
              >
                X
              </button>
            </div>
            
            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <input 
                type="text"
                placeholder="Search by name, email, User ID, or wallet address..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full border border-blue-200 p-3 rounded outline-none focus:border-blue-500 text-base"
              />
            </div>
            
            {/* User List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {users.filter(u => {
                const search = userSearch.trim().toLowerCase();
                if (!search) return true;
                const name = formatName(u).toLowerCase();
                const email = (u.email || '').toLowerCase();
                const uid = (u.wallet?.readable_id || '').toLowerCase();
                const uuid = (u.id || '').toLowerCase();
                const w = u.wallet || u;

                const addresses = [
                  w.address, w.trx_address, w.sol_address, w.btc_address,
                  w.usdt_erc20_address, w.usdt_trc20_address, w.usdt_bep20_address,
                  w.usdc_bep20_address, w.usdc_solana_address
                ].filter(Boolean).map(a => String(a).toLowerCase());

                const matchesAddress = addresses.some(a => a.includes(search));

                return name.includes(search) || email.includes(search) || uid.includes(search) || uuid.includes(search) || matchesAddress;
              }).map(u => (
                <div 
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u.id);
                    setShowUserModal(false);
                    setUserSearch("");
                  }}
                  className={`p-3 border rounded cursor-pointer transition-colors ${selectedUser === u.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                >
                  <div className="font-bold text-gray-800 text-base">{formatName(u)}</div>
                  <div className="text-gray-500 text-sm mt-1">{u.email}</div>
                  <div className="text-gray-400 text-xs mt-1 font-mono">UID: {u.wallet?.readable_id || u.id}</div>
                </div>
              ))}
              {users.length > 0 && users.filter(u => {
                const search = userSearch.trim().toLowerCase();
                if (!search) return true;
                const name = formatName(u).toLowerCase();
                const email = (u.email || '').toLowerCase();
                const uid = (u.wallet?.readable_id || '').toLowerCase();
                const uuid = (u.id || '').toLowerCase();
                const w = u.wallet || u;

                const addresses = [
                  w.address, w.trx_address, w.sol_address, w.btc_address,
                  w.usdt_erc20_address, w.usdt_trc20_address, w.usdt_bep20_address,
                  w.usdc_bep20_address, w.usdc_solana_address
                ].filter(Boolean).map(a => String(a).toLowerCase());

                const matchesAddress = addresses.some(a => a.includes(search));

                return name.includes(search) || email.includes(search) || uid.includes(search) || uuid.includes(search) || matchesAddress;
              }).length === 0 && (
                <div className="text-center text-sm text-gray-500 py-8">No users match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
