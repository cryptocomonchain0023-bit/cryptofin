import { createServerClient } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { recordUserActivityTelemetry } from '@/lib/telemetry-server';

export const dynamic = 'force-dynamic';

type TrackEvent = 'login' | 'signup' | 'pageview' | 'heartbeat' | 'leave';

const ALLOWED_EVENTS = new Set<TrackEvent>([
  'login',
  'signup',
  'pageview',
  'heartbeat',
  'leave',
]);

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    let parsedBody: Record<string, unknown> = {};
    try {
      const rawText = await request.text();
      if (rawText) {
        parsedBody = JSON.parse(rawText) as Record<string, unknown>;
      }
    } catch {
      parsedBody = {};
    }

    const rawEvent =
      typeof parsedBody.eventType === 'string'
        ? parsedBody.eventType.trim().toLowerCase()
        : 'pageview';
    const eventType: TrackEvent = ALLOWED_EVENTS.has(rawEvent as TrackEvent)
      ? (rawEvent as TrackEvent)
      : 'pageview';

    const path =
      typeof parsedBody.path === 'string' && parsedBody.path.trim()
        ? parsedBody.path.trim()
        : '/dashboard';

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let user: User | null = null;

    // 1. Check Authorization Bearer header
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    const fallbackBodyToken =
      typeof parsedBody.token === 'string' && parsedBody.token.trim()
        ? parsedBody.token.trim()
        : null;

    const jwt = bearerToken || fallbackBodyToken;
    if (jwt) {
      const { data, error } = await supabaseAdmin.auth.getUser(jwt);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Fallback to SSR cookies (supports sendBeacon & SSR-cookie sessions)
    if (!user) {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(supabaseUrl, anonKey || serviceKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only inside activity tracker
          },
        },
      });
      const { data: cookieUserRes } = await supabaseAuth.auth.getUser();
      if (cookieUserRes?.user) {
        user = cookieUserRes.user;
      }
    }

    if (!user) {
      return NextResponse.json({ ok: true, anonymous: true });
    }

    // Do not pollute active visitor traffic with admin console navigation
    if (
      user.email?.toLowerCase() === 'admin@cryptofin.org' &&
      path.startsWith('/admin')
    ) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const result = await recordUserActivityTelemetry({
      supabaseAdmin,
      userId: user.id,
      headers: request.headers,
      path,
      eventType,
    });

    return NextResponse.json({
      ok: true,
      restricted: result.restricted,
      accountStatus: result.accountStatus,
      section: result.telemetry?.currentSection || null,
      countryCode: result.telemetry?.countryCode || null,
    });
  } catch (error) {
    console.warn('Activity track error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
