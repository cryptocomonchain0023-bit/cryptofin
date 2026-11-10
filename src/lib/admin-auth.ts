import { createServerClient } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function verifyAdminRequest(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseAdmin = createClient(supabaseUrl, serviceKey || anonKey);

  let user: User | null = null;
  let lastError: string | undefined;

  // 1. Prefer Bearer token sent from the active admin browser session
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!error && data?.user) {
      user = data.user;
    } else if (error) {
      lastError = error.message;
    }
  }

  // 2. Fallback to SSR cookies (supports chunked cookies via getAll + refreshSession)
  if (!user) {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, anonKey || serviceKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe no-op in contexts where cookie mutation is disallowed
          }
        },
      },
    });

    const { data: cookieData, error: cookieErr } = await supabaseAuth.auth.getUser();
    if (!cookieErr && cookieData?.user) {
      user = cookieData.user;
    } else {
      if (cookieErr) lastError = cookieErr.message;
      const { data: refreshedData, error: refreshErr } =
        await supabaseAuth.auth.refreshSession();
      if (!refreshErr && refreshedData?.user) {
        user = refreshedData.user;
      } else if (refreshErr && !lastError) {
        lastError = refreshErr.message;
      }
    }
  }

  if (!user) {
    return {
      user: null,
      isAdmin: false,
      supabaseAdmin,
      authError: lastError || 'No active admin session found',
    };
  }

  const isPrimaryAdminEmail = user.email?.toLowerCase() === 'admin@cryptofin.org';
  const hasAdminAppRole = user.app_metadata?.role === 'admin';

  let hasProfileAdminFlag = false;
  if (!isPrimaryAdminEmail && !hasAdminAppRole) {
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const profileRecord = callerProfile as Record<string, unknown> | null;
    hasProfileAdminFlag =
      profileRecord?.is_admin === true || profileRecord?.account_type === 'admin';
  }

  const isAdmin = isPrimaryAdminEmail || hasAdminAppRole || hasProfileAdminFlag;

  return {
    user,
    isAdmin,
    supabaseAdmin,
    authError: isAdmin ? undefined : 'Forbidden: Admin privileges required',
  };
}
