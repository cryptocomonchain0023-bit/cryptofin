"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AuthPageWrapper } from '@/components/auth/AuthPageWrapper';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) throw error;

      const isAdminAccount = formData.email.toLowerCase() === 'admin@cryptofin.org';
      const accountStatus = String(data.user?.app_metadata?.account_status || 'active').toLowerCase();

      if (!isAdminAccount && (accountStatus === 'blocked' || accountStatus === 'suspended')) {
        await supabase.auth.signOut();
        throw new Error(
          accountStatus === 'blocked'
            ? 'Your account has been restricted. Please contact support.'
            : 'Your account is currently suspended. Please contact support.'
        );
      }

      if (isAdminAccount) {
        router.push('/admin');
        return;
      }

      if (data.session?.access_token) {
        try {
          const trackPromise = fetch('/api/activity/track', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({
              path: '/dashboard',
              eventType: 'login',
            }),
          });
          await Promise.race([
            trackPromise,
            new Promise((resolve) => setTimeout(resolve, 900)),
          ]);
        } catch {
          // Non-blocking login telemetry
        }
      }

      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const titleMain = (
    <>
      Log in to your<br />
      <span className="font-serif italic text-slate-500 font-normal">account</span>
    </>
  );

  return (
    <AuthPageWrapper
      titleTop="WELCOME BACK"
      titleMain={titleMain}
      subtitle="Access your wallet, track your portfolio, trade and explore the future of finance."
      imageSrc="/login%20and%20signup%20hero%20image.png"
    >
      <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-100 relative">
        <div className="absolute top-8 right-8 text-xs font-semibold text-slate-400">
          New here? <Link href="/auth/signup" className="text-[#111111] bg-[#D4FF00] px-3 py-1.5 rounded-full ml-1 hover:bg-[#c8f200] transition-colors">Create Account</Link>
        </div>

        <h2 className="text-3xl font-black text-[#111111] mb-2 tracking-tight mt-10">Log In</h2>
        <p className="text-slate-500 font-medium text-sm mb-8">Enter your credentials to access your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              required
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-[#FBF9F1] border border-slate-200 rounded-xl px-11 py-3.5 text-sm font-semibold focus:outline-none focus:border-[#D4FF00] focus:ring-2 focus:ring-[#D4FF00]/20 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              required
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-[#FBF9F1] border border-slate-200 rounded-xl pl-11 pr-12 py-3.5 text-sm font-semibold focus:outline-none focus:border-[#D4FF00] focus:ring-2 focus:ring-[#D4FF00]/20 transition-all placeholder:text-slate-400"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex justify-end pt-1 pb-4">
            <Link href="#" className="text-xs font-bold text-[#0052FF] hover:underline">Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4FF00] hover:bg-[#c8f200] text-[#111111] font-black text-sm py-3.5 rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Log In →'}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="h-px bg-slate-100 flex-1" />
          <span className="text-xs font-semibold text-slate-400 uppercase">or</span>
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        <button 
          onClick={() => router.push('/auth/login-recovery')}
          className="w-full bg-white border border-slate-200 hover:border-[#0052FF] hover:bg-[#FBF9F1] text-[#111111] font-bold text-sm py-3.5 rounded-full transition-all active:scale-[0.98] flex items-center justify-between px-6 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#0052FF]">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[#111111]">Log in with Recovery Phrase</span>
          </div>
          <span className="text-slate-400">→</span>
        </button>

        <p className="text-center text-xs font-semibold text-slate-500 mt-8">
          Don't have an account? <Link href="/auth/signup" className="text-[#0052FF] hover:underline">Create Account</Link>
        </p>
      </div>
    </AuthPageWrapper>
  );
}


