import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  resolveSiteSection,
  type IpHistoryEntry,
  type UserTelemetry,
} from '@/lib/activity';
import { extractRequestGeo, isPrivateOrLocalIp } from '@/lib/request-geo';

export type AccountStatus = 'active' | 'suspended' | 'blocked';

export function normalizeAccountStatus(
  authUser?: Pick<User, 'app_metadata' | 'banned_until'> | null
): AccountStatus {
  const bannedUntil = (authUser as { banned_until?: string | null } | null)?.banned_until;
  if (bannedUntil) {
    const banTs = new Date(bannedUntil).getTime();
    if (Number.isFinite(banTs) && banTs > Date.now()) {
      return 'blocked';
    }
  }

  const raw = String(authUser?.app_metadata?.account_status || '')
    .trim()
    .toLowerCase();

  if (raw === 'blocked' || raw === 'suspended') {
    return raw;
  }

  return 'active';
}

export function parseTelemetryFromAuthUser(
  authUser?: Pick<User, 'app_metadata' | 'last_sign_in_at'> | null
): UserTelemetry | null {
  const raw = authUser?.app_metadata?.telemetry;
  if (!raw || typeof raw !== 'object') return null;

  const t = raw as Record<string, unknown>;
  const ipHistoryRaw = Array.isArray(t.ipHistory) ? t.ipHistory : [];
  const ipHistory: IpHistoryEntry[] = ipHistoryRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      ip: typeof entry.ip === 'string' ? entry.ip : '',
      countryCode: typeof entry.countryCode === 'string' ? entry.countryCode : null,
      countryName: typeof entry.countryName === 'string' ? entry.countryName : null,
      city: typeof entry.city === 'string' ? entry.city : null,
      region: typeof entry.region === 'string' ? entry.region : null,
      seenAt: typeof entry.seenAt === 'string' ? entry.seenAt : '',
      event: typeof entry.event === 'string' ? entry.event : 'session',
    }))
    .filter((entry) => Boolean(entry.ip));

  return {
    ip: typeof t.ip === 'string' ? t.ip : null,
    loginIp: typeof t.loginIp === 'string' ? t.loginIp : null,
    countryCode: typeof t.countryCode === 'string' ? t.countryCode : null,
    countryName: typeof t.countryName === 'string' ? t.countryName : null,
    city: typeof t.city === 'string' ? t.city : null,
    region: typeof t.region === 'string' ? t.region : null,
    currentPath: typeof t.currentPath === 'string' ? t.currentPath : null,
    currentSection: typeof t.currentSection === 'string' ? t.currentSection : null,
    lastActiveAt: typeof t.lastActiveAt === 'string' ? t.lastActiveAt : null,
    lastLoginAt:
      typeof t.lastLoginAt === 'string'
        ? t.lastLoginAt
        : authUser?.last_sign_in_at || null,
    lastEvent: typeof t.lastEvent === 'string' ? t.lastEvent : null,
    device: typeof t.device === 'string' ? t.device : null,
    ipHistory,
  };
}

export async function recordUserActivityTelemetry(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  headers: Headers;
  path?: string | null;
  eventType: 'login' | 'signup' | 'pageview' | 'heartbeat' | 'leave';
  forcePersist?: boolean;
}): Promise<{
  updated: boolean;
  restricted: boolean;
  accountStatus: AccountStatus;
  telemetry: UserTelemetry | null;
}> {
  const { supabaseAdmin, userId, headers, path, eventType, forcePersist = false } = params;

  const { data: userRes, error: fetchErr } =
    await supabaseAdmin.auth.admin.getUserById(userId);
  if (fetchErr || !userRes?.user) {
    return {
      updated: false,
      restricted: false,
      accountStatus: 'active',
      telemetry: null,
    };
  }

  const authUser = userRes.user;
  const accountStatus = normalizeAccountStatus(authUser);
  const existingTelemetry = parseTelemetryFromAuthUser(authUser);

  if (accountStatus === 'blocked' || accountStatus === 'suspended') {
    return {
      updated: false,
      restricted: true,
      accountStatus,
      telemetry: existingTelemetry,
    };
  }

  const cleanPath = ((path || '/dashboard').split('?')[0] || '/dashboard').slice(0, 180);
  const sectionInfo = resolveSiteSection(cleanPath);
  const geo = await extractRequestGeo(headers);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const resolvedIp =
    geo.ip && (!isPrivateOrLocalIp(geo.ip) || !existingTelemetry?.ip)
      ? geo.ip
      : existingTelemetry?.ip || geo.ip || null;

  const sameIpAsPrev = resolvedIp && existingTelemetry?.ip === resolvedIp;
  const resolvedCountryCode =
    geo.countryCode || (sameIpAsPrev ? existingTelemetry?.countryCode || null : null);
  const resolvedCountryName =
    geo.countryName || (sameIpAsPrev ? existingTelemetry?.countryName || null : null);
  const resolvedCity = geo.city || (sameIpAsPrev ? existingTelemetry?.city || null : null);
  const resolvedRegion =
    geo.region || (sameIpAsPrev ? existingTelemetry?.region || null : null);
  const resolvedDevice = geo.device || existingTelemetry?.device || null;

  // Throttle repetitive unchanged heartbeats within 20 seconds
  if (
    !forcePersist &&
    eventType === 'heartbeat' &&
    existingTelemetry?.lastActiveAt &&
    existingTelemetry.currentPath === cleanPath &&
    existingTelemetry.ip === resolvedIp &&
    existingTelemetry.countryCode === resolvedCountryCode
  ) {
    const elapsedMs = nowMs - new Date(existingTelemetry.lastActiveAt).getTime();
    if (Number.isFinite(elapsedMs) && elapsedMs < 20_000) {
      return {
        updated: false,
        restricted: false,
        accountStatus,
        telemetry: existingTelemetry,
      };
    }
  }

  const prevHistory = existingTelemetry?.ipHistory || [];
  let nextHistory = [...prevHistory];

  if (resolvedIp) {
    const latest = nextHistory[0];
    const latestTs = latest?.seenAt ? new Date(latest.seenAt).getTime() : 0;
    const isRecentSameIp =
      latest &&
      latest.ip === resolvedIp &&
      (!resolvedCountryCode || latest.countryCode === resolvedCountryCode) &&
      nowMs - latestTs < 10 * 60 * 1000 &&
      eventType !== 'login' &&
      eventType !== 'signup';

    if (isRecentSameIp) {
      nextHistory[0] = {
        ...latest,
        countryCode: resolvedCountryCode || latest.countryCode,
        countryName: resolvedCountryName || latest.countryName,
        city: resolvedCity || latest.city,
        region: resolvedRegion || latest.region,
        seenAt: nowIso,
      };
    } else if (eventType !== 'leave') {
      nextHistory = [
        {
          ip: resolvedIp,
          countryCode: resolvedCountryCode,
          countryName: resolvedCountryName,
          city: resolvedCity,
          region: resolvedRegion,
          seenAt: nowIso,
          event: eventType,
        },
        ...nextHistory,
      ].slice(0, 10);
    }
  }

  const isAuthEvent = eventType === 'login' || eventType === 'signup';
  const nextTelemetry: UserTelemetry = {
    ip: resolvedIp,
    loginIp: isAuthEvent
      ? resolvedIp
      : existingTelemetry?.loginIp || resolvedIp,
    countryCode: resolvedCountryCode,
    countryName: resolvedCountryName,
    city: resolvedCity,
    region: resolvedRegion,
    currentPath: cleanPath,
    currentSection: sectionInfo.label,
    lastActiveAt: nowIso,
    lastLoginAt: isAuthEvent
      ? nowIso
      : existingTelemetry?.lastLoginAt || authUser.last_sign_in_at || null,
    lastEvent: eventType,
    device: resolvedDevice,
    ipHistory: nextHistory,
  };

  const mergedAppMeta = {
    ...(authUser.app_metadata || {}),
    telemetry: nextTelemetry,
  };

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: mergedAppMeta,
  });

  if (updErr) {
    console.warn('Failed to persist user telemetry:', updErr.message);
    return {
      updated: false,
      restricted: false,
      accountStatus,
      telemetry: existingTelemetry,
    };
  }

  // Keep empty profile.country synchronized cleanly when real geo country is first resolved
  if (
    resolvedCountryName &&
    eventType !== 'leave' &&
    existingTelemetry?.countryName !== resolvedCountryName
  ) {
    try {
      const { data: profRow } = await supabaseAdmin
        .from('profiles')
        .select('country')
        .eq('id', userId)
        .maybeSingle();

      if (profRow && (!profRow.country || !String(profRow.country).trim())) {
        await supabaseAdmin
          .from('profiles')
          .update({ country: resolvedCountryName })
          .eq('id', userId);
      }
    } catch {
      // Non-critical sync
    }
  }

  return {
    updated: true,
    restricted: false,
    accountStatus,
    telemetry: nextTelemetry,
  };
}
