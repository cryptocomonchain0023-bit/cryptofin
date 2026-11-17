import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { extractRequestGeo } from '@/lib/request-geo';
import {
  detectNetworkFromAddress,
  parseLinkedWalletsFromAuthUser,
  validatePublicWalletAddress,
  type LinkedWalletRecord,
} from '@/lib/linked-wallets';

export const dynamic = 'force-dynamic';

async function getAuthenticatedUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: 'Server misconfiguration', status: 500 as const };
  }

  const cookieStore = await cookies();
  const supabaseSession = createServerClient(supabaseUrl, anonKey, {
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
          // Safe no-op
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseSession.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized. Please log in again.', status: 401 as const };
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey);
  return { user, supabaseAdmin };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { user, supabaseAdmin } = auth;
    const body = await req.json();

    const rawAddress = String(body?.address ?? '').trim();
    const rawNetwork = String(body?.network ?? '').trim();
    const rawProvider = String(body?.walletProvider ?? body?.provider ?? '').trim();
    const rawLabel = String(body?.label ?? body?.reason ?? '').trim();

    const resolvedNetwork =
      rawNetwork || detectNetworkFromAddress(rawAddress) || 'Ethereum (ERC20)';

    const validation = validatePublicWalletAddress(rawAddress, resolvedNetwork);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid public wallet address' },
        { status: 400 }
      );
    }

    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json({ success: false, error: 'Account lookup failed' }, { status: 404 });
    }

    const authUser = userRes.user;
    const existingList = parseLinkedWalletsFromAuthUser(authUser);

    // Prevent duplicate pending submission for exact same address + network
    const alreadyPending = existingList.find(
      (item) =>
        item.status === 'pending' &&
        item.address.toLowerCase() === validation.normalized.toLowerCase() &&
        item.network.toLowerCase() === resolvedNetwork.toLowerCase()
    );

    if (alreadyPending) {
      return NextResponse.json({
        success: true,
        wallet: alreadyPending,
        wallets: existingList,
        message: 'Verification for this wallet address is already pending review.',
      });
    }

    const geo = await extractRequestGeo(req.headers).catch(() => ({
      ip: null,
      countryCode: null,
      countryName: null,
    }));

    const newRecord: LinkedWalletRecord = {
      id: crypto.randomUUID(),
      userId: user.id,
      address: validation.normalized,
      network: resolvedNetwork.slice(0, 60),
      walletProvider: (rawProvider || 'External Wallet').slice(0, 60),
      label: rawLabel ? rawLabel.slice(0, 160) : null,
      status: 'pending',
      adminNote: null,
      ip: geo?.ip || null,
      countryCode: geo?.countryCode || null,
      countryName: geo?.countryName || null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
    };

    const updatedList = [newRecord, ...existingList].slice(0, 25);

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        linked_wallets: updatedList,
      },
    });

    if (updateErr) {
      console.error('Failed to persist linked wallet:', updateErr);
      return NextResponse.json(
        { success: false, error: updateErr.message || 'Failed to save linked wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      wallet: newRecord,
      wallets: updatedList,
    });
  } catch (error: unknown) {
    console.error('Link wallet POST error:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { user, supabaseAdmin } = auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing wallet link id' }, { status: 400 });
    }

    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json({ success: false, error: 'Account lookup failed' }, { status: 404 });
    }

    const authUser = userRes.user;
    const existingList = parseLinkedWalletsFromAuthUser(authUser);
    const filtered = existingList.filter((item) => item.id !== id);

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        linked_wallets: filtered,
      },
    });

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: updateErr.message || 'Failed to remove linked wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, wallets: filtered });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
