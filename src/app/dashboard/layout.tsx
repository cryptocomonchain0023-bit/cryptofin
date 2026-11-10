"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { MobileNav } from '@/components/dashboard/MobileNav';
import { TopNav } from '@/components/dashboard/TopNav';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import { LockScreen } from '@/components/security/LockScreen'; // ✅ IMPORT THIS
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { SecurityProvider, useSecurity } from '@/context/SecurityContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SecurityProvider>
         <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </SecurityProvider>
    </ThemeProvider>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  // ✅ LISTEN TO SECURITY STATE
  const { isLocked, isLoading: isSecurityLoading } = useSecurity(); 
  const supabase = createClient();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // Use getUser() instead of getSession() for better security (validates token with server)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const accountStatus = String(user.app_metadata?.account_status || 'active').toLowerCase();
      if (
        user.email?.toLowerCase() !== 'admin@cryptofin.org' &&
        (accountStatus === 'blocked' || accountStatus === 'suspended')
      ) {
        await supabase.auth.signOut();
        router.push('/auth/login');
        return;
      }
      
      setLoading(false);
    };
    checkUser();
  }, [router]);

  // BLOCKING LOADER
  if (loading) {
    return <GlobalLoader />;
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-[#121212] text-white' 
        : 'bg-[#F3F4F6] text-slate-900'
    }`}>
      
      {isLocked && <LockScreen />}

      <main className="min-h-screen animate-in fade-in duration-500 flex flex-col">
        <div className="w-full flex justify-center flex-1">
           <div className="w-full max-w-5xl relative flex flex-col pb-[72px]">
              <TopNav />
              <div className="flex-1 flex flex-col h-full">
                 {children}
              </div>
              <MobileNav />
           </div>
        </div>
      </main>
      
    </div>
  );
}