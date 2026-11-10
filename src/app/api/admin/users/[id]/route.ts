import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { EDITABLE_WALLET_BALANCE_COLUMNS } from '@/lib/admin-tokens';

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

const PROTECTED_FIELD_KEYS = new Set([
  'id',
  'user_id',
  'email',
  'readable_id',
  'wallet_type',
  'hd_index',
  'account_type',
  'address',
  'btc_address',
  'sol_address',
  'trx_address',
  'usdt_erc20_address',
  'usdt_bep20_address',
  'usdc_bep20_address',
  'usdt_trc20_address',
  'usdc_solana_address',
  'private_key',
  'encrypted_private_key',
  'trx_private_key',
  'trx_encrypted_private_key',
  'sol_private_key',
  'sol_encrypted_private_key',
  'btc_private_key',
  'btc_encrypted_private_key',
  'seed_phrase',
  'encrypted_phrase',
  'recovery_phrase',
  'pin_hash',
  'transaction_pin',
  'generated_pin',
  'generated_user_id',
  'soft_token',
]);

const VALID_KYC_STATUSES = new Set([
  'unverified',
  'pending',
  'approved',
  'rejected',
]);

function normalizeOptionalString(val: unknown, maxLen = 160): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

function serializeWallet(walletRow: Record<string, any> | null) {
  if (!walletRow) return null;

  const balances: Record<string, number> = {};
  for (const col of EDITABLE_WALLET_BALANCE_COLUMNS) {
    balances[col] = Number(walletRow[col] ?? 0) || 0;
  }

  return {
    id: walletRow.id,
    user_id: walletRow.user_id,
    readable_id: walletRow.readable_id || null,
    wallet_type: walletRow.wallet_type || 'standalone',
    hd_index: walletRow.hd_index ?? null,
    gas_override: Boolean(walletRow.gas_override),
    created_at: walletRow.created_at || null,
    addresses: {
      evm: walletRow.address || null,
      btc: walletRow.btc_address || null,
      sol: walletRow.sol_address || null,
      trx: walletRow.trx_address || null,
      usdt_erc20_override: walletRow.usdt_erc20_address || null,
      usdt_bep20_override: walletRow.usdt_bep20_address || null,
      usdc_bep20_override: walletRow.usdc_bep20_address || null,
      usdt_trc20_override: walletRow.usdt_trc20_address || null,
      usdc_solana_override: walletRow.usdc_solana_address || null,
    },
    balances,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const [
      { data: profile, error: profileError },
      { data: walletRow, error: walletError },
      { data: kycRow, error: kycError },
      { data: txData, error: txError },
      authRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select(
          'id, email, full_name, first_name, last_name, username, avatar_url, phone, country, account_type, pin_attempts, is_pin_locked, pin_hash, transaction_pin, recovery_phrase, created_at, updated_at'
        )
        .eq('id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('wallets')
        .select(`${SAFE_WALLET_SELECT}, encrypted_phrase, seed_phrase`)
        .eq('user_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('kyc_applications')
        .select('id, status, country, document_type, document_number, image_url, created_at, updated_at')
        .eq('user_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.getUserById(id).catch(() => null),
    ]);

    if (profileError) throw profileError;
    if (walletError) throw walletError;
    if (kycError) {
      console.warn('KYC fetch warning:', kycError.message);
    }
    if (txError) {
      console.warn('Transactions fetch warning:', txError.message);
    }

    const authUser = authRes?.data?.user || null;
    if (!profile && !authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rawWallet = walletRow as Record<string, any> | null;
    const hasRecoveryPhrase = Boolean(
      profile?.recovery_phrase || rawWallet?.encrypted_phrase || rawWallet?.seed_phrase
    );

    const displayName =
      (profile?.full_name || '').trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
      (profile?.username || '').trim() ||
      (profile?.email || authUser?.email)?.split('@')[0] ||
      'User';

    const userRecord = {
      id: profile?.id || authUser!.id,
      email: profile?.email || authUser?.email || null,
      full_name: profile?.full_name || null,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      username: profile?.username || null,
      display_name: displayName,
      avatar_url: profile?.avatar_url || null,
      phone: profile?.phone || null,
      country: profile?.country || null,
      account_type: profile?.account_type || 'user',
      pin_attempts: Number(profile?.pin_attempts || 0),
      is_pin_locked: Boolean(profile?.is_pin_locked),
      has_pin: Boolean(profile?.pin_hash || profile?.transaction_pin),
      has_recovery_phrase: hasRecoveryPhrase,
      created_at: profile?.created_at || authUser?.created_at || null,
      updated_at: profile?.updated_at || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
      email_confirmed: Boolean(authUser?.email_confirmed_at),
      kyc_status: kycRow?.status || 'unverified',
      kyc: kycRow || null,
      profile_exists: Boolean(profile),
    };

    return NextResponse.json({
      user: userRecord,
      wallet: serializeWallet(rawWallet),
      transactions: txData || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    // Reject explicit attempts to mutate immutable / protected keys
    const attemptedProtected: string[] = [];
    for (const key of Object.keys(body)) {
      if (PROTECTED_FIELD_KEYS.has(key)) {
        attemptedProtected.push(key);
      }
    }
    if (body.profile && typeof body.profile === 'object') {
      for (const key of Object.keys(body.profile)) {
        if (PROTECTED_FIELD_KEYS.has(key)) {
          attemptedProtected.push(`profile.${key}`);
        }
      }
    }
    if (body.wallet && typeof body.wallet === 'object') {
      for (const key of Object.keys(body.wallet)) {
        if (PROTECTED_FIELD_KEYS.has(key) || key === 'addresses') {
          attemptedProtected.push(`wallet.${key}`);
        }
      }
    }
    if (attemptedProtected.length > 0) {
      return NextResponse.json(
        {
          error: `Modification of protected immutable fields is not permitted: ${attemptedProtected.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Ensure user exists
    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, first_name, last_name, country')
      .eq('id', id)
      .maybeSingle();

    if (currentProfileErr) throw currentProfileErr;
    if (!currentProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 1. Validate & build safe profile update
    const profileUpdate: Record<string, unknown> = {};
    const profileInput =
      body.profile && typeof body.profile === 'object' ? body.profile : {};

    if ('first_name' in profileInput) {
      profileUpdate.first_name = normalizeOptionalString(profileInput.first_name, 100);
    }
    if ('last_name' in profileInput) {
      profileUpdate.last_name = normalizeOptionalString(profileInput.last_name, 100);
    }
    if ('full_name' in profileInput) {
      profileUpdate.full_name = normalizeOptionalString(profileInput.full_name, 160);
    } else if ('first_name' in profileUpdate || 'last_name' in profileUpdate) {
      const nextFirst =
        'first_name' in profileUpdate
          ? (profileUpdate.first_name as string | null)
          : currentProfile.first_name;
      const nextLast =
        'last_name' in profileUpdate
          ? (profileUpdate.last_name as string | null)
          : currentProfile.last_name;
      const combined = [nextFirst, nextLast].filter(Boolean).join(' ').trim();
      if (combined) {
        profileUpdate.full_name = combined;
      }
    }

    if ('username' in profileInput) {
      profileUpdate.username = normalizeOptionalString(profileInput.username, 60);
    }
    if ('phone' in profileInput) {
      profileUpdate.phone = normalizeOptionalString(profileInput.phone, 40);
    }
    if ('country' in profileInput) {
      profileUpdate.country = normalizeOptionalString(profileInput.country, 100);
    }
    if (profileInput.unlock_pin === true) {
      profileUpdate.is_pin_locked = false;
      profileUpdate.pin_attempts = 0;
    }

    // 2. Validate & build safe wallet update
    const walletUpdate: Record<string, unknown> = {};
    const walletInput =
      body.wallet && typeof body.wallet === 'object' ? body.wallet : {};

    if ('gas_override' in walletInput) {
      if (typeof walletInput.gas_override !== 'boolean') {
        return NextResponse.json(
          { error: 'gas_override must be a boolean' },
          { status: 400 }
        );
      }
      walletUpdate.gas_override = walletInput.gas_override;
    }

    if (walletInput.balances && typeof walletInput.balances === 'object') {
      for (const [col, rawVal] of Object.entries(walletInput.balances)) {
        if (!EDITABLE_WALLET_BALANCE_COLUMNS.has(col)) {
          return NextResponse.json(
            { error: `Invalid or non-editable balance field: ${col}` },
            { status: 400 }
          );
        }
        if (
          rawVal === '' ||
          rawVal === null ||
          rawVal === undefined ||
          typeof rawVal === 'boolean'
        ) {
          return NextResponse.json(
            { error: `Balance for ${col} must be a valid number` },
            { status: 400 }
          );
        }
        const parsed = Number(rawVal);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e15) {
          return NextResponse.json(
            { error: `Invalid balance value for ${col}` },
            { status: 400 }
          );
        }
        walletUpdate[col] = parsed;
      }
    }

    // 3. Validate KYC status if supplied
    let kycTargetStatus: string | undefined;
    if (body.kyc_status !== undefined) {
      const normalizedKyc = String(body.kyc_status).trim().toLowerCase();
      if (!VALID_KYC_STATUSES.has(normalizedKyc)) {
        return NextResponse.json(
          { error: 'Invalid kyc_status value' },
          { status: 400 }
        );
      }
      kycTargetStatus = normalizedKyc;
    }

    // Execute profile update
    if (Object.keys(profileUpdate).length > 0) {
      profileUpdate.updated_at = new Date().toISOString();
      const { error: pErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', id);
      if (pErr) throw pErr;
    }

    // Execute wallet update if applicable
    if (Object.keys(walletUpdate).length > 0) {
      const { data: existingWallet, error: wLookupErr } = await supabaseAdmin
        .from('wallets')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();

      if (wLookupErr) throw wLookupErr;
      if (!existingWallet) {
        return NextResponse.json(
          { error: 'This user has not initialized a wallet yet' },
          { status: 400 }
        );
      }

      const { error: wErr } = await supabaseAdmin
        .from('wallets')
        .update(walletUpdate)
        .eq('user_id', id);
      if (wErr) throw wErr;
    }

    // Execute KYC status change only if it differs from current state
    if (kycTargetStatus !== undefined) {
      const { data: existingKyc, error: kycLookupErr } = await supabaseAdmin
        .from('kyc_applications')
        .select('id, status')
        .eq('user_id', id)
        .maybeSingle();

      if (kycLookupErr) {
        console.warn('KYC lookup warning in PUT user:', kycLookupErr.message);
      }

      const currentKycStatus = existingKyc?.status || 'unverified';
      if (kycTargetStatus !== currentKycStatus) {
        const nowIso = new Date().toISOString();
        if (kycTargetStatus === 'unverified') {
          if (existingKyc) {
            const { error: delErr } = await supabaseAdmin
              .from('kyc_applications')
              .delete()
              .eq('user_id', id);
            if (delErr) {
              console.warn('KYC reset delete warning:', delErr.message);
            }
          }
        } else if (existingKyc) {
          const { error: updErr } = await supabaseAdmin
            .from('kyc_applications')
            .update({ status: kycTargetStatus, updated_at: nowIso })
            .eq('user_id', id);
          if (updErr) throw updErr;
        } else {
          const countryForKyc =
            (profileUpdate.country as string | null) ||
            currentProfile.country ||
            'N/A';
          const { error: insErr } = await supabaseAdmin
            .from('kyc_applications')
            .insert({
              user_id: id,
              status: kycTargetStatus,
              country: countryForKyc,
              document_type: 'Admin Verified',
              document_number: 'Admin Update',
              image_url: '',
              updated_at: nowIso,
            });
          if (insErr) throw insErr;
        }

        try {
          const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(id);
          const mergedMetadata = {
            ...(existingAuth?.user?.user_metadata || {}),
            kyc_status: kycTargetStatus,
          };
          await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: mergedMetadata,
          });
        } catch (authMetaErr) {
          console.warn('Auth user_metadata KYC sync skipped:', authMetaErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('PUT /api/admin/users/[id] error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
