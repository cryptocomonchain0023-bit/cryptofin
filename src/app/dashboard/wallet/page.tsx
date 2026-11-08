"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Loader2, Copy, Eye, EyeOff, User, 
  ArrowDownLeft, ArrowUpRight, Search, Bell, ChevronRight 
} from 'lucide-react';
import { CRYPTO_ASSETS } from '@/lib/constants';
import { AssetIcon } from '@/components/dashboard/AssetIcon';
import { ManageAssetsModal } from '@/components/dashboard/ManageAssetsModal';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';

export default function WalletPage() {
  const supabase = createClient();
  const router = useRouter();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  
  // Safe Fallback Prices
  const [prices, setPrices] = useState<Record<string, number>>({
    BTC: 65000, ETH: 2800, USDT: 1.00, SOL: 145, TRX: 0.20, BNB: 580, MATIC: 0.50, AVAX: 25, USDC: 1
  });
  
  const [hideBalance, setHideBalance] = useState(false);
  const [dailyIncome, setDailyIncome] = useState(0);
  const [dailyExpense, setDailyExpense] = useState(0);

  const [showManageAssets, setShowManageAssets] = useState(false);
  const [visibleAssets, setVisibleAssets] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('visible_assets');
    if (stored) {
      setVisibleAssets(JSON.parse(stored));
    } else {
      setVisibleAssets(CRYPTO_ASSETS.map(a => a.id));
    }
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: w } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setWallet(w); 

    // Fetch live prices directly from CoinGecko to fix stale prices
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana,tron,binancecoin,polygon-ecosystem-token,avalanche-2&vs_currencies=usd');
      if (res.ok) {
        const data = await res.json();
        setPrices(prev => ({
          ...prev,
          ETH: data.ethereum?.usd || prev.ETH,
          BTC: data.bitcoin?.usd || prev.BTC,
          SOL: data.solana?.usd || prev.SOL,
          TRX: data.tron?.usd || prev.TRX,
          BNB: data.binancecoin?.usd || prev.BNB,
          MATIC: data['polygon-ecosystem-token']?.usd || prev.MATIC,
          AVAX: data['avalanche-2']?.usd || prev.AVAX,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch prices');
    }

    // Calculate 24h stats
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());

    if (txs) {
      let inc = 0; let exp = 0;
      txs.forEach((tx: any) => {
          if (tx.type === 'deposit') inc += Number(tx.amount);
          if (tx.type === 'withdraw' || tx.type === 'send') exp += Number(tx.amount);
      });
      setDailyIncome(inc);
      setDailyExpense(exp);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getBalanceField = (aId: string) => {
      if (aId === 'USDT' || aId === 'USDT_ERC20') return 'usdt_erc20_balance';
      if (aId === 'USDT_TRX' || aId === 'USDT_TRC20') return 'usdt_trc20_balance';
      if (aId === 'USDT_BNB' || aId === 'USDT_BEP20') return 'usdt_bep20_balance';
      if (aId === 'USDT_SOL') return 'usdt_sol_balance';
      if (aId === 'USDT_MATIC') return 'usdt_matic_balance';
      if (aId === 'USDT_AVAX') return 'usdt_avax_balance';
      if (aId === 'USDC_BNB' || aId === 'USDC_BEP20') return 'usdc_bep20_balance';
      if (aId === 'USDC_SOL') return 'usdc_solana_balance';
      if (aId === 'USDC_MATIC') return 'usdc_matic_balance';
      if (aId === 'USDC_AVAX') return 'usdc_avax_balance';
      if (aId === 'USDC' || aId === 'USDC_ERC20') return 'usdc_balance';
      if (aId === 'BTC') return 'btc_balance';
      if (aId === 'ETH') return 'balance';
      if (aId === 'BNB') return 'bnb_balance';
      if (aId === 'SOL') return 'sol_balance';
      if (aId === 'TRX') return 'trx_balance';
      if (aId === 'MATIC') return 'matic_balance';
      if (aId === 'AVAX') return 'avax_balance';
      return aId.split('_')[0].toLowerCase() + '_balance';
  };

  const getBalance = (assetId: string) => {
    if (!wallet) return 0;
    return Number(wallet[getBalanceField(assetId)] || 0);
  };

  const totalBalance = CRYPTO_ASSETS.reduce((acc, asset) => {
    const bal = getBalance(asset.id);
    const price = prices[asset.id] || 0;
    return acc + (bal * price);
  }, 0);

  const handleCopyAddr = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      toast.success("Address Copied");
    }
  };

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#050505]' : 'bg-[#F3F4F6]'}`}>
       <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  const isDark = theme === 'dark';

  return (
    <div className={`w-full max-w-6xl mx-auto p-4 md:p-8 pt-[max(env(safe-area-inset-top),1.5rem)] md:pt-12 lg:pt-16 pb-32 animate-in fade-in duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      
      {/* 1. BREADCRUMB HEADER */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6 px-1">
         <span onClick={() => router.push('/dashboard')} className={`cursor-pointer transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>DASHBOARD</span>
         <ChevronRight size={12} className="text-zinc-500" />
         <span className={isDark ? 'text-white' : 'text-slate-900'}>WALLET</span>
      </div>
      
      {/* 2. MASTER CARD */}
      <div className={`rounded-3xl p-6 md:p-10 mb-10 shadow-2xl overflow-hidden w-full max-w-4xl mx-auto lg:max-w-none ${isDark ? 'bg-[#151515] border border-white/5' : 'bg-white border border-slate-200'}`}>
        
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
           <div className="flex flex-col flex-1">
               {/* Top Section */}
               <div className="flex items-center justify-between mb-8 lg:mb-12">
                  <div className={`border px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider text-primary ${isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-emerald-50 border-emerald-100'}`}>
                     {wallet?.readable_id || '...'}
                  </div>
                  
                  <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold">
                     <span>Total Balance</span>
                     <button onClick={() => setHideBalance(!hideBalance)} className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                        {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                  </div>
               </div>

               {/* Balance */}
               <h1 className="text-5xl md:text-6xl font-semibold tracking-tight truncate max-w-full mb-6">
                  {hideBalance ? '••••••' : `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
               </h1>

               {/* Address Pill */}
               <div 
                  onClick={handleCopyAddr}
                  className={`flex items-center gap-2 w-fit px-4 py-2 rounded-full cursor-pointer transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
               >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <code className={`text-[11px] font-mono font-bold tracking-widest ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {wallet ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : 'Generating...'}
                  </code>
                  <Copy size={12} className="text-zinc-500 ml-1" />
               </div>
           </div>

           {/* Income / Expense Stats */}
           <div className={`grid grid-cols-2 gap-4 rounded-2xl p-5 w-full lg:w-96 ${isDark ? 'bg-[#1a1a1a]' : 'bg-slate-50'}`}>
              <div>
                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">INCOME</p>
                 <div className="flex items-center gap-1.5 text-primary font-bold text-lg">
                    <ArrowDownLeft size={18} /> ${dailyIncome.toFixed(2)}
                 </div>
              </div>
              <div className={`border-l pl-4 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">EXPENSE</p>
                 <div className="flex items-center gap-1.5 text-red-500 font-bold text-lg">
                    <ArrowUpRight size={18} /> ${dailyExpense.toFixed(2)}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* 3. PORTFOLIO LIST */}
      <div className="max-w-4xl mx-auto lg:max-w-none">
         <div className="flex items-center justify-between mb-4 px-3">
           <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
             PORTFOLIO
           </h3>
           <button onClick={() => setShowManageAssets(true)} className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors border ${isDark ? 'bg-white/5 text-white hover:bg-white/10 border-white/5' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'}`}>
             Manage
           </button>
         </div>

         <div className="flex flex-col">
           {CRYPTO_ASSETS.filter(a => visibleAssets.includes(a.id)).map((asset) => {
             const rawBalance = getBalance(asset.id);
             // Fix floating point errors (e.g. 1.0016999999999996 -> 1.0017)
             const safeBalance = Number(rawBalance.toFixed(6));
             const price = asset.id === 'USDT' || asset.id === 'USDC' ? 1.00 : prices[asset.id] || 0;
             const value = safeBalance * price;

             return (
               <button
                 key={asset.id}
                 onClick={() => router.push(`/dashboard/wallet/${asset.id}`)}
                 className={`w-full py-5 px-3 flex items-center justify-between transition-colors active:scale-[0.99] border-b ${isDark ? 'border-white/5 hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}
               >
                 <div className="flex items-center gap-4">
                    <div className="relative">
                       <div className="w-8 h-8"><AssetIcon symbol={asset.id.split('_')[0]} size="sm" /></div>
                       {asset.id === 'USDT' && (
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border ${isDark ? 'bg-[#151515] border-[#222]' : 'bg-white border-slate-200'}`}>
                             <img src="https://raw.githubusercontent.com/atomiclabs/cryptocurrency-icons/master/128/color/eth.png" alt="ETH" className="w-2.5 h-2.5" />
                          </div>
                       )}
                    </div>
                    
                    <div className="text-left">
                       <h3 className={`font-bold text-[13px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{asset.name}</h3>
                       <div className="text-[11px] font-semibold text-zinc-500 mt-1">
                         ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </div>
                    </div>
                 </div>
                 
                 <div className="text-right">
                    <div className={`font-bold text-[14px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                       {hideBalance ? '•••' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-500 font-mono mt-1">
                      {hideBalance ? '•••' : `${safeBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${asset.id}`}
                    </div>
                 </div>
               </button>
             );
           })}
         </div>
      </div>

      {showManageAssets && <ManageAssetsModal onClose={() => setShowManageAssets(false)} onUpdate={setVisibleAssets} />}
    </div>
  );
}

