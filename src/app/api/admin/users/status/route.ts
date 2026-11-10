import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['active', 'suspended', 'blocked']);

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
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';
    const suspendUntil =
      typeof body?.suspendUntil === 'string' && body.suspendUntil.trim()
        ? body.suspendUntil.trim()
        : null;

    if (!userId || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Valid User ID and status (active, suspended, blocked) are required' },
        { status: 400 }
      );
    }

    const { data: targetRes, error: lookupErr } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (lookupErr || !targetRes?.user) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetUser = targetRes.user;
    if (
      targetUser.id === adminUser.id ||
      targetUser.email?.toLowerCase() === 'admin@cryptofin.org'
    ) {
      return NextResponse.json(
        { error: 'Primary admin account status cannot be restricted' },
        { status: 400 }
      );
    }

    const mergedAppMeta = {
      ...(targetUser.app_metadata || {}),
      account_status: status,
      suspend_until: status === 'suspended' ? suspendUntil : null,
      status_updated_at: new Date().toISOString(),
      status_updated_by: adminUser.email || adminUser.id,
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: mergedAppMeta,
      ban_duration: status === 'blocked' ? '876000h' : 'none',
    });

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, userId, status });
  } catch (err: unknown) {
    console.error('Status Update Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
