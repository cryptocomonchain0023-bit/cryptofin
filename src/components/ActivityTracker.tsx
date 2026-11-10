'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';

const HEARTBEAT_INTERVAL_MS = 25_000;

export function ActivityTracker() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const accessTokenRef = useRef<string | null>(null);
  const userEmailRef = useRef<string | null>(null);
  const restrictedHandledRef = useRef(false);

  pathnameRef.current = pathname;

  const isSkippableAdminRoute = useCallback((path: string, email: string | null) => {
    return (
      Boolean(email && email.toLowerCase() === 'admin@cryptofin.org') &&
      path.startsWith('/admin')
    );
  }, []);

  const sendTrackEvent = useCallback(
    async (
      eventType: 'pageview' | 'heartbeat' | 'leave',
      explicitPath?: string,
      useBeacon = false
    ) => {
      const targetPath = explicitPath || pathnameRef.current || '/';
      const supabase = createClient();

      if (!accessTokenRef.current) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        accessTokenRef.current = session?.access_token ?? null;
        userEmailRef.current = session?.user?.email ?? null;
      }

      if (!accessTokenRef.current) return;
      if (isSkippableAdminRoute(targetPath, userEmailRef.current)) return;

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const payload = JSON.stringify({
            path: targetPath,
            eventType,
            token: accessTokenRef.current,
          });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/activity/track', blob);
          return;
        } catch {
          // Fall through to keepalive fetch
        }
      }

      try {
        const res = await fetch('/api/activity/track', {
          method: 'POST',
          keepalive: useBeacon,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessTokenRef.current}`,
          },
          body: JSON.stringify({
            path: targetPath,
            eventType,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.restricted && !restrictedHandledRef.current) {
            restrictedHandledRef.current = true;
            await supabase.auth.signOut();
            toast.error(
              data.accountStatus === 'blocked'
                ? 'Your account has been restricted. Please contact support.'
                : 'Your account is temporarily suspended. Please contact support.'
            );
            router.push('/auth/login');
          }
        }
      } catch {
        // Silent failure: telemetry must never disrupt user UX
      }
    },
    [isSkippableAdminRoute, router]
  );

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      accessTokenRef.current = session?.access_token ?? null;
      userEmailRef.current = session?.user?.email ?? null;
      if (session?.access_token) {
        void sendTrackEvent('pageview', pathnameRef.current);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      accessTokenRef.current = session?.access_token ?? null;
      userEmailRef.current = session?.user?.email ?? null;
      if (session?.access_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        restrictedHandledRef.current = false;
        void sendTrackEvent('pageview', pathnameRef.current);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [sendTrackEvent]);

  // Track route changes immediately
  useEffect(() => {
    if (!accessTokenRef.current) return;
    if (document.visibilityState === 'hidden') return;
    void sendTrackEvent('pageview', pathname);
  }, [pathname, sendTrackEvent]);

  // Periodic active heartbeat + visibility / unload tracking
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && accessTokenRef.current) {
        void sendTrackEvent('heartbeat');
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && accessTokenRef.current) {
        void sendTrackEvent('pageview');
      }
    };

    const handlePageHide = () => {
      if (accessTokenRef.current) {
        void sendTrackEvent('leave', pathnameRef.current, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [sendTrackEvent]);

  return null;
}
