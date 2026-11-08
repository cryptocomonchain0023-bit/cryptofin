"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Save, Loader2, Globe, Phone, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/context/ThemeContext';
import { detectRealUserLocation } from '@/lib/geo';

export function EditProfileModal({ user, profile, onClose, onUpdate }: any) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    country: profile?.country || '',
    avatar_url: profile?.avatar_url || ''
  });

  const supabase = createClient();

  useEffect(() => {
    if (!formData.country) {
      detectRealUserLocation().then(loc => {
        if (loc.country && loc.country !== 'International') {
          setFormData(prev => prev.country ? prev : ({ ...prev, country: loc.country }));
        }
      });
    }
  }, []);

  // 1. HANDLE IMAGE UPLOAD
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update Local State
      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Image uploaded!");

    } catch (error: any) {
      toast.error("Error uploading image: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 2. SAVE PROFILE DATA
  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: formData.full_name,
          phone: formData.phone,
          country: formData.country,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Profile updated successfully");
      onUpdate();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  // THEME VARIABLES
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-[#0a0a0a]' : 'bg-white';
  const textMain = isDark ? 'text-white' : 'text-slate-900';
  const textSub = isDark ? 'text-zinc-500' : 'text-slate-500';
  const border = isDark ? 'border-white/10' : 'border-slate-200';
  const inputBg = isDark ? 'bg-zinc-900' : 'bg-slate-50';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className={`${bgMain} border ${border} w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200`}>
        
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-xl font-bold ${textMain}`}>Edit Profile</h3>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors cursor-pointer ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={20} className={textSub} />
          </button>
        </div>

        {/* AVATAR SELECTOR */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-primary/40 overflow-hidden flex items-center justify-center text-2xl font-bold">
               {formData.avatar_url ? (
                 <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <User size={32} className="text-zinc-400" />
               )}
            </div>
            
            {/* OVERLAY ON HOVER */}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>

            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <span className="text-[11px] text-zinc-500 mt-2 font-medium">Click to change picture</span>
        </div>

        {/* INPUTS */}
        <div className="space-y-4">
          <InputField 
             label="Full Name" 
             value={formData.full_name} 
             onChange={(e: any) => setFormData({...formData, full_name: e.target.value})}
             icon={User}
             placeholder="John Doe"
             isDark={isDark}
             inputBg={inputBg}
             textMain={textMain}
             border={border}
          />

          <InputField 
             label="Phone Number" 
             value={formData.phone} 
             onChange={(e: any) => setFormData({...formData, phone: e.target.value})}
             icon={Phone}
             placeholder="+1 234 567 890"
             isDark={isDark}
             inputBg={inputBg}
             textMain={textMain}
             border={border}
          />

          <InputField 
             label="Country / Region" 
             value={formData.country} 
             onChange={(e: any) => setFormData({...formData, country: e.target.value})}
             icon={Globe}
             placeholder="e.g. France, United States..."
             isDark={isDark}
             inputBg={inputBg}
             textMain={textMain}
             border={border}
          />

          <button 
            onClick={handleSave}
            disabled={loading || uploading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
          </button>
        </div>

      </div>
    </div>
  );
}

// Helper Component for cleaner JSX
function InputField({ label, value, onChange, icon: Icon, placeholder, isDark, inputBg, textMain, border }: any) {
  return (
      <div>
        <label className={`text-xs font-bold uppercase mb-2 block ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{label}</label>
        <div className={`relative flex items-center ${inputBg} border ${border} rounded-xl px-4 py-3 focus-within:border-primary transition-colors`}>
           <Icon size={18} className="text-zinc-500 mr-3 shrink-0" />
           <input 
              type="text" 
              value={value} 
              onChange={onChange} 
              placeholder={placeholder}
              className={`bg-transparent w-full outline-none text-sm font-semibold ${textMain} placeholder:text-zinc-600`}
           />
        </div>
      </div>
  );
}
