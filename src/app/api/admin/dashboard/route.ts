export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { computePresence, findCountryCodeByName, getCountryNameFromCode } from '@/lib/activity';
import {
  normalizeAccountStatus,
  parseTelemetryFromAuthUser,
} from '@/lib/telemetry-server';

async function listAllAuthUsers(supabaseAdmin: SupabaseClient): Promise<User[]> {
  const collected: User[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error || !data?.users?.length) break;
    collected.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return collected;
}

export async function GET(request: Request) {
  try {
    const { user: adminUser, isAdmin, supabaseAdmin, authError } =
      await verifyAdminRequest(request);

    if (!adminUser) {
      return NextResponse.json(
        { error: `Unauthorized: ${authError || 'Please sign in again.'}` },
        { status: 401 }
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }

    const [
      { data: profiles, error: userError },
      { data: wallets, error: walletError },
      { data: txs, error: txError },
      authUsers,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select(
          'id, email, full_name, first_name, last_name, username, avatar_url, phone, country, account_type, created_at, updated_at'
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('wallets').select('user_id, readable_id, is_primary'),
      supabaseAdmin.from('transactions').select('*'),
      listAllAuthUsers(supabaseAdmin).catch(() => [] as User[]),
    ]);

    if (userError) throw userError;
    if (walletError) {
      console.warn('Dashboard wallets lookup warning:', walletError.message);
    }
    if (txError) throw txError;

    const walletUidMap = new Map<string, string>();
    for (const w of wallets || []) {
      if (w?.user_id && w?.readable_id && (!walletUidMap.has(w.user_id) || w.is_primary)) {
        walletUidMap.set(w.user_id, w.readable_id);
      }
    }

    const authUserMap = new Map<string, User>();
    for (const au of authUsers) {
      authUserMap.set(au.id, au);
    }

    const nowMs = Date.now();

    const users = (profiles || []).map((p) => {
      const authUser = authUserMap.get(p.id) || null;
      const telemetry = parseTelemetryFromAuthUser(authUser);
      const presence = computePresence(telemetry, nowMs);
      const accountStatus = normalizeAccountStatus(authUser);

      const profileCountry = (p.country || '').trim() || null;
      const profileCountryCode = profileCountry
        ? findCountryCodeByName(profileCountry)
        : null;
      const profileCountryNormalized = profileCountryCode
        ? getCountryNameFromCode(profileCountryCode) || profileCountry
        : profileCountry;

      const displayName =
        (p.full_name || '').trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        (p.username || '').trim() ||
        (p.email ? p.email.split('@')[0] : 'User');

      const emailLower = (p.email || authUser?.email || '').toLowerCase();
      const isAdminAccount =
        emailLower === 'admin@cryptofin.org' ||
        authUser?.app_metadata?.role === 'admin' ||
        p.account_type === 'admin';

      return {
        id: p.id,
        email: p.email || authUser?.email || null,
        full_name: p.full_name || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || null,
        display_name: displayName,
        avatar_url: p.avatar_url || null,
        phone: p.phone || null,
        country: profileCountry,
        profile_country: profileCountryNormalized,
        profile_country_code: profileCountryCode,
        readable_id: walletUidMap.get(p.id) || null,
        account_type: p.account_type || 'user',
        is_admin: isAdminAccount,
        status: accountStatus,
        suspend_until: (authUser?.app_metadata?.suspend_until as string | null) || null,
        created_at: p.created_at || authUser?.created_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed: authUser ? Boolean(authUser.email_confirmed_at) : true,
        presence,
        telemetry,
        // Convenience top-level telemetry fields
        last_ip: telemetry?.ip || telemetry?.loginIp || null,
        login_ip: telemetry?.loginIp || telemetry?.ip || null,
        last_country: telemetry?.countryCode || null,
        last_country_name: telemetry?.countryName || null,
        last_city: telemetry?.city || null,
        last_region: telemetry?.region || null,
        current_path: telemetry?.currentPath || null,
        current_section: telemetry?.currentSection || null,
        last_active_at: telemetry?.lastActiveAt || null,
        last_login_at: telemetry?.lastLoginAt || authUser?.last_sign_in_at || null,
        last_event: telemetry?.lastEvent || null,
        device: telemetry?.device || null,
        ip_history: telemetry?.ipHistory || [],
      };
    });

    return NextResponse.json({
      users,
      txs: txs || [],
      serverTime: new Date(nowMs).toISOString(),
    });
  } catch (err: unknown) {
    console.error('Dashboard API Error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
