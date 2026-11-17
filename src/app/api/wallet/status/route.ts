import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { parseLinkedWalletsFromAuthUser } from '@/lib/linked-wallets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, anonKey, {
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
            // Safe no-op in read-only route contexts
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let freshUser = user;
    if (serviceRoleKey) {
      const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey);
      const { data: adminUserRes } = await supabaseAdmin.auth.admin.getUserById(user.id);
      if (adminUserRes?.user) {
        freshUser = adminUserRes.user;
      }
    }

    const linkedWallets = parseLinkedWalletsFromAuthUser(freshUser);
    const latest = linkedWallets[0] || null;

    return NextResponse.json({
      success: true,
      status: latest?.status ?? null,
      wallet: latest,
      wallets: linkedWallets,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
