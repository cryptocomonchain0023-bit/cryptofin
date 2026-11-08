"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  User, Moon, Sun, Shield, Lock, Smartphone, 
  LogOut, ChevronRight, CreditCard, HelpCircle, 
  FileText, Mail, Bell, Globe, CheckCircle 
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';
import { detectRealUserLocation } from '@/lib/geo';
import { EditProfileModal } from '@/components/profile/EditProfileModal';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [detectedCountry, setDetectedCountry] = useState<string>('');
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);

        // 1. Fetch Wallet
        const { data: w } = await supabase
          .from('wallets')
          .select('readable_id')
          .eq('user_id', user.id)
          .single();
        
        setWallet(w);

        // 2. Fetch Profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        // 3. Fetch KYC Status from kyc_applications
        const { data: kyc } = await supabase
          .from('kyc_applications')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        let currentCountry = prof?.country?.trim();

        // 4. If profile.country is empty, auto-detect real location
        if (!currentCountry) {
          const loc = await detectRealUserLocation();
          if (loc.country && loc.country !== 'International') {
            currentCountry = loc.country;
            setDetectedCountry(loc.country);
            // Save real detected country to Supabase so it persists
            await supabase.from('profiles').update({ country: loc.country }).eq('id', user.id);
          }
        } else {
          setDetectedCountry(currentCountry);
        }

        if (prof) {
          prof.kyc_status = kyc?.status || 'unverified';
          prof.country = currentCountry || prof.country;
          setProfile(prof);
        } else {
          setProfile({ kyc_status: kyc?.status || 'unverified', country: currentCountry });
        }
      }
    } catch (err) {
      console.error('Error fetching settings user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    toast.success("Logged out successfully");
  };

  const isDark = theme === 'dark';

  // --- REUSABLE ROW COMPONENT (THEME AWARE) ---
  const SettingRow = ({ icon: Icon, label, subLabel, action, isDestructive = false }: any) => (
    <button 
      onClick={action}
      className={`w-full flex items-center justify-between p-4 transition-colors 
        ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}
        ${isDestructive ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-900')}
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center 
          ${isDestructive 
            ? 'bg-red-500/10' 
            : (isDark ? 'bg-zinc-800' : 'bg-slate-100')}
        `}>
          <Icon size={20} className={isDestructive ? 'text-red-500' : (isDark ? 'text-zinc-400' : 'text-slate-500')} />
        </div>
        <div className="text-left">
          <div className="font-medium text-sm">{label}</div>
          {subLabel && <div className="text-xs text-zinc-500">{subLabel}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
         {typeof action === 'function' && <ChevronRight size={16} className="text-zinc-400" />}
      </div>
    </button>
  );

  return (
    <div className="pb-32 animate-in fade-in duration-500 p-4 md:p-8 pt-[max(env(safe-area-inset-top),1.5rem)] md:pt-[max(env(safe-area-inset-top),2rem)]">
      
      {showEdit && (
        <EditProfileModal 
          user={user} 
          profile={profile} 
          onClose={() => setShowEdit(false)} 
          onUpdate={fetchUserData} 
        />
      )}

      <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h1>
      
      {/* 1. PROFILE CARD */}
      <div 
        onClick={() => router.push(profile?.kyc_status === 'approved' ? '/dashboard/profile' : '/dashboard/settings/kyc')}
        className={`relative border rounded-3xl p-6 flex items-center gap-4 mb-8 shadow-xl overflow-hidden cursor-pointer group transition-all
          ${isDark 
            ? 'bg-gradient-to-br from-zinc-900 to-black border-white/10 hover:border-white/20' 
            : 'bg-white border-slate-200 hover:border-primary/30'
          }
        `}
      >
        {isDark && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />}
        
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary/20 shrink-0 overflow-hidden">
           {profile?.avatar_url ? (
             <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
           ) : (
             user?.email?.[0].toUpperCase() || "U"
           )}
        </div>
        
        <div className="min-w-0">
           <h2 className={`font-bold text-lg truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
             {profile?.full_name || user?.email?.split('@')[0] || "User"}
           </h2>
           <div className="flex flex-wrap items-center gap-2 mt-1">
             <span className={`text-xs font-mono px-2 py-0.5 rounded border 
               ${isDark ? 'bg-white/10 text-zinc-400 border-white/5' : 'bg-slate-100 text-slate-500 border-slate-200'}
             `}>
               {wallet?.readable_id || "LOADING..."}
             </span>
             
             {profile?.kyc_status === 'approved' ? (
               <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-emerald-600 px-2 py-0.5 rounded border border-primary/20 font-bold uppercase">
                 <CheckCircle size={10} /> Verified L1
               </span>
             ) : profile?.kyc_status === 'pending' ? (
               <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
                 Pending KYC
               </span>
             ) : (
               <span className="flex items-center gap-1 text-[10px] bg-zinc-500/10 text-zinc-400 px-2 py-0.5 rounded border border-white/10 font-bold uppercase">
                 Unverified
               </span>
             )}
           </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Account Section */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 px-2">Account</h3>
          <div className={`border rounded-2xl overflow-hidden divide-y ${isDark ? 'bg-[#0a0a0a] border-white/10 divide-white/5' : 'bg-white border-slate-200 divide-slate-100'}`}>
             <SettingRow 
               icon={User} 
               label="Profile Details" 
               subLabel="Name, Phone, Country"
               action={() => setShowEdit(true)} 
             />
             <SettingRow 
               icon={CreditCard} 
               label="Identity Verification (KYC)" 
               subLabel={profile?.kyc_status === 'approved' ? "Tier 1 Verified" : "Verification required"}
               action={() => router.push('/dashboard/settings/kyc')} 
             />
             <SettingRow 
               icon={Globe} 
               label="Language & Region" 
               subLabel={`${profile?.country || detectedCountry || "Auto-detecting"} • English (US)`}
               action={() => setShowEdit(true)} 
             />
          </div>
        </div>

        {/* Security Section */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 px-2">Security</h3>
          <div className={`border rounded-2xl overflow-hidden divide-y ${isDark ? 'bg-[#0a0a0a] border-white/10 divide-white/5' : 'bg-white border-slate-200 divide-slate-100'}`}>
             <SettingRow 
               icon={Lock} 
               label="Change Transaction PIN" 
               subLabel="Required for all withdrawals"
               action={() => {}} 
             />
             <SettingRow 
               icon={Shield} 
               label="Two-Factor Authentication" 
               subLabel="Recommended for safety"
               action={() => toast.info("Coming soon in v2")} 
             />
             <SettingRow 
               icon={Smartphone} 
               label="Device Management" 
               subLabel="Manage active sessions"
               action={() => {}} 
             />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 px-2">Preferences</h3>
          <div className={`border rounded-2xl overflow-hidden divide-y ${isDark ? 'bg-[#0a0a0a] border-white/10 divide-white/5' : 'bg-white border-slate-200 divide-slate-100'}`}>
             <div className={`w-full flex items-center justify-between p-4 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                     {theme === 'dark' ? <Moon size={20} className="text-purple-400" /> : <Sun size={20} className="text-orange-400" />}
                  </div>
                  <div>
                    <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Appearance</div>
                    <div className="text-xs text-zinc-500">Switch betwen Dark & Light mode</div>
                  </div>
                </div>
                <button 
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-zinc-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
             </div>
             <SettingRow 
               icon={Bell} 
               label="Notifications" 
               subLabel="Push alerts, Email updates"
               action={() => {}} 
             />
          </div>
        </div>

        {/* Support */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 px-2">Support</h3>
          <div className={`border rounded-2xl overflow-hidden divide-y ${isDark ? 'bg-[#0a0a0a] border-white/10 divide-white/5' : 'bg-white border-slate-200 divide-slate-100'}`}>
             <SettingRow 
               icon={HelpCircle} 
               label="Help Center" 
               action={() => window.open('https://support.google.com', '_blank')} 
             />
             <SettingRow 
               icon={Mail} 
               label="Contact Support" 
               subLabel="Average response: 2 hrs"
               action={() => window.location.href = 'mailto:support@cryptofin.com'} 
             />
             <SettingRow 
               icon={FileText} 
               label="Legal" 
               subLabel="Terms of Service & Privacy"
               action={() => {}} 
             />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4">
           <button 
             onClick={handleLogout}
             className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95"
           >
             <LogOut size={18} /> Sign Out
           </button>
           
           <div className="mt-8 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cryptofin v1.2.0</p>
              <p className="text-[10px] text-zinc-500 mt-1">Secured by Supabase & Ethereum</p>
           </div>
        </div>

      </div>
    </div>
  );
}
