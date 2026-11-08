"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface SecurityContextType {
  isLocked: boolean;
  requiresSetup: boolean;
  isLoading: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  requiresSetup: true, // Default to true for safety
  isLoading: true,     // Default to true so we wait
  unlock: async () => false,
  lock: () => {},
});

export const useSecurity = () => useContext(SecurityContext);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pinHash, setPinHash] = useState<string | null>(null);
  
  const pathname = usePathname();
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkSecurity = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_security')
          .select('pin_hash')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Security Context Error:", error);
        }

        if (!isMounted) return;

        if (!data || !data.pin_hash) {
          setRequiresSetup(true);
        } else {
          setRequiresSetup(false);
          setPinHash(data.pin_hash);
        }
      } catch (e) {
        console.error("Security check failed", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkSecurity();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const unlock = async (inputPin: string) => {
    if (!inputPin) return false;
    try {
      const res = await fetch('/api/security/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: inputPin })
      });
      const data = await res.json();
      if (data.success) {
        setIsLocked(false);
        return true;
      }
    } catch (e) {
      console.error("Unlock failed", e);
    }
    return false;
  };

  const lock = () => setIsLocked(true);

  return (
    <SecurityContext.Provider value={{ isLocked, requiresSetup, isLoading, unlock, lock }}>
      {children}
    </SecurityContext.Provider>
  );
}
