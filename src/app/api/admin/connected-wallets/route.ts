export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin-auth';
import {
  computePresence,
  findCountryCodeByName,
  getCountryNameFromCode,
} from '@/lib/activity';
import { parseTelemetryFromAuthUser } from '@/lib/telemetry-server';
import {
  parseLinkedWalletsFromAuthUser,
  type LinkedWalletRecord,
  type LinkedWalletStatus,
} from '@/lib/linked-wallets';
import {
  sendEmail,
  emailLinkedWalletApproved,
  emailLinkedWalletRejected,
} from '@/lib/emails';

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
      authUsers,
      { data: profiles, error: profileErr },
      { data: wallets, error: walletErr },
    ] = await Promise.all([
      listAllAuthUsers(supabaseAdmin),
      supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, first_name, last_name, username, avatar_url, country'),
      supabaseAdmin.from('wallets').select('user_id, readable_id, is_primary'),
    ]);

    if (profileErr) {
      console.warn('Connected wallets profile lookup warning:', profileErr.message);
    }
    if (walletErr) {
      console.warn('Connected wallets UID lookup warning:', walletErr.message);
    }

    const profileMap = new Map<string, Record<string, any>>();
    for (const p of profiles || []) {
      if (p?.id) profileMap.set(p.id, p);
    }

    const uidMap = new Map<string, string>();
    for (const w of wallets || []) {
      if (w?.user_id && w?.readable_id && (!uidMap.has(w.user_id) || w.is_primary)) {
        uidMap.set(w.user_id, w.readable_id);
      }
    }

    const nowMs = Date.now();
    const connections: Array<
      LinkedWalletRecord & {
        user: {
          id: string;
          displayName: string;
          email: string;
          avatarUrl: string | null;
          walletUid: string | null;
          countryCode: string | null;
          countryName: string | null;
          presence: string;
        };
      }
    > = [];

    for (const authUser of authUsers) {
      const records = parseLinkedWalletsFromAuthUser(authUser);
      if (records.length === 0) continue;

      const profile = profileMap.get(authUser.id);
      const telemetry = parseTelemetryFromAuthUser(authUser);
      const presence = computePresence(telemetry, nowMs);

      const email = String(profile?.email || authUser.email || '').trim();
      const displayName =
        String(profile?.full_name || '').trim() ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
        String(profile?.username || '').trim() ||
        (email ? email.split('@')[0] : 'User');

      const profileCountry = String(profile?.country || '').trim() || null;
      const fallbackCountryCode =
        telemetry?.countryCode ||
        (profileCountry ? findCountryCodeByName(profileCountry) : null);
      const fallbackCountryName =
        telemetry?.countryName ||
        (fallbackCountryCode ? getCountryNameFromCode(fallbackCountryCode) : null) ||
        profileCountry;

      for (const rec of records) {
        const recCountryCode = rec.countryCode || fallbackCountryCode;
        const recCountryName =
          rec.countryName ||
          (recCountryCode ? getCountryNameFromCode(recCountryCode) : null) ||
          fallbackCountryName;

        connections.push({
          ...rec,
          countryCode: recCountryCode,
          countryName: recCountryName,
          user: {
            id: authUser.id,
            displayName,
            email,
            avatarUrl: profile?.avatar_url || null,
            walletUid: uidMap.get(authUser.id) || null,
            countryCode: recCountryCode,
            countryName: recCountryName,
            presence,
          },
        });
      }
    }

    connections.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    const summary = {
      total: connections.length,
      pending: connections.filter((c) => c.status === 'pending').length,
      approved: connections.filter((c) => c.status === 'approved').length,
      rejected: connections.filter((c) => c.status === 'rejected').length,
    };

    return NextResponse.json({ connections, summary });
  } catch (err: unknown) {
    console.error('Admin Connected Wallets GET error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const connectionId = String(body?.connectionId || '').trim();
    const userId = String(body?.userId || '').trim();
    const action = String(body?.action || '').trim().toLowerCase();
    const adminNoteRaw =
      typeof body?.adminNote === 'string' ? body.adminNote.trim().slice(0, 300) : null;

    if (!connectionId || !userId) {
      return NextResponse.json(
        { error: 'Missing connectionId or userId' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'pending'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, reject, or pending' },
        { status: 400 }
      );
    }

    const nextStatus: LinkedWalletStatus =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';

    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetAuthUser = userRes.user;
    const existingList = parseLinkedWalletsFromAuthUser(targetAuthUser);
    const matchIndex = existingList.findIndex((item) => item.id === connectionId);

    if (matchIndex === -1) {
      return NextResponse.json(
        { error: 'Linked wallet record not found' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatedRecord: LinkedWalletRecord = {
      ...existingList[matchIndex],
      status: nextStatus,
      adminNote:
        action === 'pending'
          ? null
          : adminNoteRaw !== null
          ? adminNoteRaw || null
          : existingList[matchIndex].adminNote,
      reviewedAt: action === 'pending' ? null : nowIso,
      reviewedBy: action === 'pending' ? null : adminUser.email || 'admin@cryptofin.org',
    };

    const updatedList = [...existingList];
    updatedList[matchIndex] = updatedRecord;

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(targetAuthUser.app_metadata || {}),
        linked_wallets: updatedList,
      },
    });

    if (updateErr) {
      console.error('Connected wallet update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send email notification on approve or reject (best effort)
    if (action === 'approve' || action === 'reject') {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('first_name, full_name, email')
          .eq('id', userId)
          .maybeSingle();

        const userEmail = profile?.email || targetAuthUser.email;
        const userName =
          profile?.first_name ||
          profile?.full_name?.split(' ')[0] ||
          (userEmail ? userEmail.split('@')[0] : 'Valued User');

        if (userEmail) {
          const dateUtc = nowIso.replace('T', ' ').substring(0, 19);
          const emailContent =
            action === 'approve'
              ? emailLinkedWalletApproved(
                  userName,
                  updatedRecord.address,
                  updatedRecord.network,
                  updatedRecord.walletProvider,
                  dateUtc
                )
              : emailLinkedWalletRejected(
                  userName,
                  updatedRecord.address,
                  updatedRecord.network,
                  dateUtc,
                  updatedRecord.adminNote || undefined
                );

          await sendEmail({ to: userEmail, ...emailContent });
        }
      } catch (emailErr) {
        console.warn('[Connected Wallet Email Warning]:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      connection: updatedRecord,
    });
  } catch (err: unknown) {
    console.error('Admin Connected Wallets POST error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const userId = searchParams.get('userId')?.trim();

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing id or userId query parameter' },
        { status: 400 }
      );
    }

    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetAuthUser = userRes.user;
    const existingList = parseLinkedWalletsFromAuthUser(targetAuthUser);
    const filtered = existingList.filter((item) => item.id !== id);

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(targetAuthUser.app_metadata || {}),
        linked_wallets: filtered,
      },
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
