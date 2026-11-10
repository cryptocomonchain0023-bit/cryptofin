import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { computePresence, findCountryCodeByName, type UserTelemetry } from '@/lib/activity';
import {
  normalizeAccountStatus,
  parseTelemetryFromAuthUser,
  type AccountStatus,
} from '@/lib/telemetry-server';

export const dynamic = 'force-dynamic';

const SAFE_WALLET_SELECT = [
  'id',
  'user_id',
  'readable_id',
  'email',
  'status',
  'is_primary',
  'wallet_type',
  'hd_index',
  'gas_override',
  'created_at',
  'currency',
  'network',
  'address',
  'btc_address',
  'sol_address',
  'trx_address',
  'usdt_erc20_address',
  'usdt_bep20_address',
  'usdc_bep20_address',
  'usdt_trc20_address',
  'usdc_solana_address',
  'balance',
  'btc_balance',
  'bnb_balance',
  'sol_balance',
  'trx_balance',
  'matic_balance',
  'avax_balance',
  'usdt_balance',
  'usdt_erc20_balance',
  'usdt_trc20_balance',
  'usdt_bep20_balance',
  'usdt_sol_balance',
  'usdt_matic_balance',
  'usdt_avax_balance',
  'usdc_balance',
  'usdc_bep20_balance',
  'usdc_solana_balance',
  'usdc_matic_balance',
  'usdc_avax_balance',
].join(', ');

export async function GET(request: Request) {
  try {
    const { user, isAdmin, supabaseAdmin, authError } =
      await verifyAdminRequest(request);

    if (!user) {
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
      { data: profiles, error: profilesError },
      { data: wallets, error: walletsError },
      { data: kycRows, error: kycError },
      { data: txRows, error: txError },
      authUsersRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select(
          'id, email, full_name, first_name, last_name, username, avatar_url, phone, country, account_type, pin_attempts, is_pin_locked, pin_hash, transaction_pin, created_at, updated_at'
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('wallets').select(SAFE_WALLET_SELECT),
      supabaseAdmin
        .from('kyc_applications')
        .select('user_id, status, document_type, country, created_at, updated_at'),
      supabaseAdmin
        .from('transactions')
        .select('user_id, to_address, from_address, tx_hash'),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => null),
    ]);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }
    if (walletsError) {
      return NextResponse.json({ error: walletsError.message }, { status: 500 });
    }
    if (kycError) {
      console.warn('KYC fetch warning in GET /api/admin/users:', kycError.message);
    }
    if (txError) {
      console.warn('Tx summary fetch warning in GET /api/admin/users:', txError.message);
    }

    const walletMap = new Map<string, Record<string, any>>();
    for (const w of (wallets as unknown as Record<string, any>[]) || []) {
      if (w?.user_id && (!walletMap.has(w.user_id) || w.is_primary)) {
        walletMap.set(w.user_id, w);
      }
    }

    const kycMap = new Map<string, { status: string; document_type?: string; updated_at?: string }>();
    for (const k of kycRows || []) {
      if (k?.user_id) {
        kycMap.set(k.user_id, {
          status: k.status || 'pending',
          document_type: k.document_type || undefined,
          updated_at: k.updated_at || undefined,
        });
      }
    }

    const txCountMap = new Map<string, number>();
    const txRefsMap = new Map<string, Set<string>>();
    for (const tx of txRows || []) {
      if (!tx?.user_id) continue;
      txCountMap.set(tx.user_id, (txCountMap.get(tx.user_id) || 0) + 1);
      if (!txRefsMap.has(tx.user_id)) {
        txRefsMap.set(tx.user_id, new Set<string>());
      }
      const refSet = txRefsMap.get(tx.user_id)!;
      for (const candidate of [tx.tx_hash, tx.to_address, tx.from_address]) {
        if (typeof candidate === 'string' && candidate.trim()) {
          refSet.add(candidate.trim());
        }
      }
    }

    const authMetaMap = new Map<
      string,
      {
        email_confirmed: boolean;
        last_sign_in_at: string | null;
        account_status: AccountStatus;
        telemetry: UserTelemetry | null;
        presence: 'online' | 'idle' | 'offline';
      }
    >();
    const authUsers = authUsersRes?.data?.users || [];
    const nowMs = Date.now();
    for (const au of authUsers) {
      const telemetry = parseTelemetryFromAuthUser(au);
      authMetaMap.set(au.id, {
        email_confirmed: Boolean(au.email_confirmed_at),
        last_sign_in_at: au.last_sign_in_at || null,
        account_status: normalizeAccountStatus(au),
        telemetry,
        presence: computePresence(telemetry, nowMs),
      });
    }

    const users = (profiles || []).map((p) => {
      const wallet = walletMap.get(p.id) || null;
      const kyc = kycMap.get(p.id);
      const authMeta = authMetaMap.get(p.id);
      const ownAddresses = new Set(
        wallet
          ? [
              wallet.address,
              wallet.btc_address,
              wallet.sol_address,
              wallet.trx_address,
              wallet.usdt_erc20_address,
              wallet.usdt_bep20_address,
              wallet.usdc_bep20_address,
              wallet.usdt_trc20_address,
              wallet.usdc_solana_address,
            ]
              .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
              .map((v) => v.trim().toLowerCase())
          : []
      );

      const rawTxRefs = txRefsMap.get(p.id);
      const tx_refs = rawTxRefs
        ? Array.from(rawTxRefs).filter((ref) => !ownAddresses.has(ref.toLowerCase()))
        : [];

      const displayName =
        (p.full_name || '').trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        (p.username || '').trim() ||
        (p.email ? p.email.split('@')[0] : 'User');

      return {
        id: p.id,
        email: p.email || null,
        full_name: p.full_name || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || null,
        display_name: displayName,
        avatar_url: p.avatar_url || null,
        phone: p.phone || null,
        country: p.country || null,
        account_type: p.account_type || 'user',
        pin_attempts: Number(p.pin_attempts || 0),
        is_pin_locked: Boolean(p.is_pin_locked),
        has_pin: Boolean(p.pin_hash || p.transaction_pin),
        created_at: p.created_at,
        updated_at: p.updated_at || null,
        email_confirmed: authMeta ? authMeta.email_confirmed : true,
        last_sign_in_at: authMeta?.last_sign_in_at || null,
        account_status: authMeta?.account_status || 'active',
        presence: authMeta?.presence || 'offline',
        telemetry: authMeta?.telemetry || null,
        country_code:
          authMeta?.telemetry?.countryCode ||
          (p.country ? findCountryCodeByName(p.country) : null),
        kyc_status: kyc?.status || 'unverified',
        tx_count: txCountMap.get(p.id) || 0,
        tx_refs,
        wallet,
      };
    });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, isAdmin, supabaseAdmin, authError } =
      await verifyAdminRequest(request);

    if (!user) {
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

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password =
      typeof body?.generated_pin === 'string' && body.generated_pin
        ? body.generated_pin
        : typeof body?.password === 'string'
        ? body.password
        : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const first_name =
      typeof body?.first_name === 'string' && body.first_name.trim()
        ? body.first_name.trim()
        : null;
    const last_name =
      typeof body?.last_name === 'string' && body.last_name.trim()
        ? body.last_name.trim()
        : null;
    const full_name =
      (typeof body?.full_name === 'string' && body.full_name.trim()) ||
      [first_name, last_name].filter(Boolean).join(' ').trim() ||
      null;
    const phone =
      typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const country =
      typeof body?.country === 'string' && body.country.trim()
        ? body.country.trim()
        : null;

    const { data: authData, error: authCreateError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: first_name || '',
          last_name: last_name || '',
          full_name: full_name || '',
          phone: phone || '',
        },
      });

    if (authCreateError || !authData?.user) {
      return NextResponse.json(
        { error: authCreateError?.message || 'Failed to create auth user' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    await new Promise((resolve) => setTimeout(resolve, 400));

    const safeProfilePayload = {
      email,
      first_name,
      last_name,
      full_name,
      phone,
      country,
      updated_at: new Date().toISOString(),
    };

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update(safeProfilePayload)
        .eq('id', userId);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('profiles')
        .insert([{ id: userId, ...safeProfilePayload }]);
      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
