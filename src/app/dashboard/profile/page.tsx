"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { 
  User, Mail, Phone, Globe, Calendar, Shield, 
  Edit2, Loader2, Camera, Copy, Check, CheckCircle 
} from 'lucide-react';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';
import { detectRealUserLocation } from '@/lib/geo';
import { CountryFlag } from '@/components/ui/CountryFlag';

export default function ProfilePage() {
  const { theme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const telemetryGeoCode = (user?.app_metadata?.telemetry?.countryCode as string | undefined) || null;
      if (telemetryGeoCode) {
        setDetectedCountryCode(telemetryGeoCode);
      }

      let finalProfile = profileData;
      if (!profileData?.country?.trim()) {
        const loc = await detectRealUserLocation();
        if (loc.country && loc.country !== 'International') {
          if (loc.countryCode) setDetectedCountryCode(loc.countryCode);
          finalProfile = { ...(profileData || {}), country: loc.country };
          // Auto-save real country to profile
          await supabase.from('profiles').update({ country: loc.country }).eq('id', user.id);
        }
      }
      setProfile(finalProfile);

      // 2. Fetch Wallet (Correct place for Readable ID)
      const { data: walletData } = await supabase
        .from('wallets')
        .select('readable_id')
        .eq('user_id', user.id)
        .single();
      setWallet(walletData);

    } catch (e) {
      console.error("Error fetching profile:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyID = () => {
    if (wallet?.readable_id) {
      navigator.clipboard.writeText(wallet.readable_id);
      setCopied(true);
      toast.success("Member ID Copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDark = theme === 'dark';

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#050505]' : 'bg-[#F3F4F6]'}`}>
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in duration-500 p-6 pt-[max(env(safe-area-inset-top),2rem)] md:pt-[max(env(safe-area-inset-top),3rem)]">
      
      {showEdit && (
        <EditProfileModal 
          user={user} 
          profile={profile} 
          onClose={() => setShowEdit(false)} 
          onUpdate={fetchData} 
        />
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Profile</h1>
           <p className="text-zinc-500 text-sm">Manage your personal identity</p>
        </div>
        <button 
          onClick={() => setShowEdit(true)}
          className="bg-primary/10 hover:bg-primary/20 text-emerald-600 border border-primary/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
        >
          <Edit2 size={16} /> Edit
        </button>
      </div>

      {/* PROFILE CARD */}
      <div className={`border rounded-2xl p-8 mb-6 relative overflow-hidden text-center shadow-xl
         ${isDark 
           ? 'bg-gradient-to-br from-zinc-900 to-[#111] border-white/10' 
           : 'bg-white border-slate-200'
         }
      `}>
         {isDark && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />}
         
         <div className="relative inline-block mb-4">
            <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold shadow-xl relative z-10 overflow-hidden group
               ${isDark 
                 ? 'bg-zinc-800 border-[#0a0a0a] text-white' 
                 : 'bg-slate-100 border-white text-slate-700'
               }
            `}>
               {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                  profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"
               )}
            </div>
            
            <button 
               onClick={() => setShowEdit(true)}
               className={`absolute bottom-0 right-0 p-2 rounded-full border-4 z-20 hover:scale-110 transition-transform cursor-pointer
                  ${isDark 
                    ? 'bg-primary text-black border-[#0a0a0a]' 
                    : 'bg-primary text-white border-white'
                  }
               `}
            >
               <Camera size={14} />
            </button>
         </div>
         
         <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {profile?.full_name || "Set Your Name"}
         </h2>

         {/* --- UPDATED ID SECTION --- */}
         <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-3">
            
            {/* CLICKABLE ID BADGE */}
            <button 
              onClick={handleCopyID}
              className={`group flex items-center gap-2 border active:scale-95 transition-all px-3 py-1.5 rounded-lg cursor-pointer
                 ${isDark 
                   ? 'bg-white/5 hover:bg-white/10 border-white/10' 
                   : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                 }
              `}
            >
               <span className={`text-sm font-mono font-bold tracking-wide ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                 {wallet?.readable_id || "LOADING..."}
               </span>
               {copied ? (
                 <Check size={14} className="text-primary" />
               ) : (
                 <Copy size={14} className="text-zinc-400 group-hover:text-primary transition-colors" />
               )}
            </button>

            <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-1 rounded uppercase tracking-wider">
               <CheckCircle size={10} /> Verified L1
            </span>
         </div>

      </div>

      {/* DETAILS GRID */}
      <div className="grid gap-4">
         
         {/* Email */}
         <DetailRow 
            icon={Mail} 
            label="Email Address" 
            value={user?.email} 
            isVerified 
            theme={theme}
            isDark={isDark}
         />

         {/* Phone */}
         <DetailRow 
            icon={Phone} 
            label="Mobile Number" 
            value={profile?.phone} 
            placeholder="Not Set"
            theme={theme}
            isDark={isDark}
         />

         {/* Country / Region */}
         <DetailRow 
            icon={Globe} 
            label="Region" 
            value={
              profile?.country ? (
                <CountryFlag
                  countryCode={detectedCountryCode}
                  countryName={profile.country}
                  size="sm"
                  textClassName={isDark ? 'text-white' : 'text-slate-900'}
                />
              ) : null
            } 
            placeholder="Auto-detecting..."
            theme={theme}
            isDark={isDark}
         />

         {/* Joined Date */}
         <DetailRow 
            icon={Calendar} 
            label="Member Since" 
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "..."} 
            theme={theme}
            isDark={isDark}
         />

      </div>

    </div>
  );
}

// Subcomponent for Details List
function DetailRow({ icon: Icon, label, value, isVerified = false, placeholder, isDark }: any) {
   return (
      <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors
         ${isDark 
           ? 'bg-[#0a0a0a] border-white/5' 
           : 'bg-white border-slate-200'
         }
      `}>
         <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center
               ${isDark ? 'bg-zinc-900 text-zinc-400' : 'bg-slate-100 text-slate-500'}
            `}>
               <Icon size={20} />
            </div>
            <div>
               <p className="text-xs text-zinc-500 font-medium">{label}</p>
               <div className={`text-sm font-semibold mt-0.5 ${!value ? 'text-zinc-500 italic' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                  {value || placeholder}
               </div>
            </div>
         </div>

         {isVerified && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full">
               <Shield size={10} /> Verified
            </span>
         )}
      </div>
   );
}
