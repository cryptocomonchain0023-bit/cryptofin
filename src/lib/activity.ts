export type PresenceState = 'online' | 'idle' | 'offline';

export interface IpHistoryEntry {
  ip: string;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  region?: string | null;
  seenAt: string;
  event: string;
}

export interface UserTelemetry {
  ip: string | null;
  loginIp: string | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  region: string | null;
  currentPath: string | null;
  currentSection: string | null;
  lastActiveAt: string | null;
  lastLoginAt: string | null;
  lastEvent: string | null;
  device: string | null;
  ipHistory: IpHistoryEntry[];
}

export type SectionCategory =
  | 'wallet'
  | 'activity'
  | 'security'
  | 'markets'
  | 'account'
  | 'auth'
  | 'support'
  | 'public'
  | 'admin';

export interface SiteSectionInfo {
  label: string;
  category: SectionCategory;
  shortPath: string;
}

const VALID_ALPHA2 = /^[A-Z]{2}$/;
const EXCLUDED_GEO_CODES = new Set(['XX', 'T1', 'ZZ', 'EU', 'AP']);

export function normalizeCountryCode(code?: string | null): string | null {
  if (!code || typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  if (!VALID_ALPHA2.test(upper) || EXCLUDED_GEO_CODES.has(upper)) return null;
  return upper;
}

function normalizeNameKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`.()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedNameToCodeMap: Map<string, string> | null = null;
let cachedCompactNameToCodeMap: Map<string, string> | null = null;

function ensureCountryLookupMaps() {
  if (cachedNameToCodeMap && cachedCompactNameToCodeMap) {
    return { byName: cachedNameToCodeMap, byCompact: cachedCompactNameToCodeMap };
  }

  const byName = new Map<string, string>();
  const byCompact = new Map<string, string>();

  const registerAlias = (name: string, code: string) => {
    const key = normalizeNameKey(name);
    if (!key) return;
    if (!byName.has(key)) byName.set(key, code);
    const compact = key.replace(/\s+/g, '');
    if (compact && !byCompact.has(compact)) byCompact.set(compact, code);
  };

  try {
    const locales = ['en', 'pt', 'fr', 'es'];
    const displayInstances = locales
      .map((loc) => {
        try {
          return new Intl.DisplayNames([loc], { type: 'region' });
        } catch {
          return null;
        }
      })
      .filter((d): d is Intl.DisplayNames => Boolean(d));

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const code = `${letters[i]}${letters[j]}`;
        if (EXCLUDED_GEO_CODES.has(code)) continue;
        for (const dn of displayInstances) {
          try {
            const label = dn.of(code);
            if (
              label &&
              label.toUpperCase() !== code &&
              !label.toLowerCase().includes('unknown region')
            ) {
              registerAlias(label, code);
            }
          } catch {
            // Skip invalid ISO pairs
          }
        }
      }
    }
  } catch {
    // Fallback cleanly if Intl.DisplayNames is unavailable
  }

  const manualAliases: Record<string, string> = {
    usa: 'US',
    'u s a': 'US',
    'u s': 'US',
    'united states of america': 'US',
    america: 'US',
    uk: 'GB',
    'u k': 'GB',
    england: 'GB',
    'great britain': 'GB',
    uae: 'AE',
    'u a e': 'AE',
    'cote divoire': 'CI',
    'cote d ivoire': 'CI',
    'ivory coast': 'CI',
    brasil: 'BR',
    russia: 'RU',
    'south korea': 'KR',
    'north korea': 'KP',
    vietnam: 'VN',
    turkey: 'TR',
    turkiye: 'TR',
    hongkong: 'HK',
    'hong kong sar': 'HK',
    taiwan: 'TW',
    drc: 'CD',
    'dr congo': 'CD',
    'congo kinshasa': 'CD',
    congo: 'CG',
    czechia: 'CZ',
    'czech republic': 'CZ',
    eswatini: 'SZ',
    swaziland: 'SZ',
    palestine: 'PS',
    'cape verde': 'CV',
    cabo: 'CV',
  };

  for (const [alias, code] of Object.entries(manualAliases)) {
    registerAlias(alias, code);
  }

  cachedNameToCodeMap = byName;
  cachedCompactNameToCodeMap = byCompact;
  return { byName, byCompact };
}

export function getCountryNameFromCode(code?: string | null): string | null {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return null;
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(normalized);
    if (name && name.toUpperCase() !== normalized && !name.toLowerCase().includes('unknown')) {
      return name;
    }
  } catch {
    // Ignore Intl errors
  }
  return normalized;
}

export function findCountryCodeByName(countryName?: string | null): string | null {
  if (!countryName || typeof countryName !== 'string') return null;
  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const directCode = normalizeCountryCode(trimmed);
  if (directCode) return directCode;

  const { byName, byCompact } = ensureCountryLookupMaps();
  const normalized = normalizeNameKey(trimmed);
  if (byName.has(normalized)) return byName.get(normalized)!;

  const compact = normalized.replace(/\s+/g, '');
  if (byCompact.has(compact)) return byCompact.get(compact)!;

  return null;
}

const ASSET_LABEL_MAP: Record<string, string> = {
  BTC: 'BTC',
  ETH: 'ETH',
  BNB: 'BNB (BEP-20)',
  SOL: 'SOL',
  TRX: 'TRX',
  MATIC: 'MATIC',
  POL: 'POL',
  AVAX: 'AVAX',
  USDT: 'USDT',
  USDT_ERC20: 'USDT (ERC-20)',
  USDT_TRC20: 'USDT (TRC-20)',
  USDT_TRX: 'USDT (TRC-20)',
  USDT_BEP20: 'USDT (BEP-20)',
  USDT_BSC: 'USDT (BEP-20)',
  USDT_SOL: 'USDT (Solana)',
  USDT_SOLANA: 'USDT (Solana)',
  USDT_MATIC: 'USDT (Polygon)',
  USDT_POLYGON: 'USDT (Polygon)',
  USDT_AVAX: 'USDT (Avalanche)',
  USDC: 'USDC',
  USDC_ERC20: 'USDC (ERC-20)',
  USDC_BEP20: 'USDC (BEP-20)',
  USDC_BSC: 'USDC (BEP-20)',
  USDC_SOL: 'USDC (Solana)',
  USDC_SOLANA: 'USDC (Solana)',
  USDC_MATIC: 'USDC (Polygon)',
  USDC_POLYGON: 'USDC (Polygon)',
  USDC_AVAX: 'USDC (Avalanche)',
};

function formatAssetParam(rawAsset: string): string {
  const clean = decodeURIComponent(rawAsset || '')
    .trim()
    .replace(/-/g, '_')
    .toUpperCase();
  return ASSET_LABEL_MAP[clean] || clean.replace(/_/g, ' ');
}

export function resolveSiteSection(pathname?: string | null): SiteSectionInfo {
  const cleanPath = ((pathname || '/').split('?')[0] || '/').replace(/\/+$/, '') || '/';

  if (cleanPath === '/') {
    return { label: 'Landing Page', category: 'public', shortPath: '/' };
  }
  if (cleanPath === '/dashboard') {
    return { label: 'Dashboard Overview', category: 'wallet', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/assets') {
    return { label: 'Assets Hub', category: 'wallet', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/wallet') {
    return { label: 'Wallets Overview', category: 'wallet', shortPath: cleanPath };
  }

  const walletSendMatch = cleanPath.match(/^\/dashboard\/wallet\/([^/]+)\/send$/i);
  if (walletSendMatch) {
    return {
      label: `Sending ${formatAssetParam(walletSendMatch[1])}`,
      category: 'wallet',
      shortPath: cleanPath,
    };
  }

  const walletReceiveMatch = cleanPath.match(/^\/dashboard\/wallet\/([^/]+)\/receive$/i);
  if (walletReceiveMatch) {
    return {
      label: `Receiving ${formatAssetParam(walletReceiveMatch[1])}`,
      category: 'wallet',
      shortPath: cleanPath,
    };
  }

  const walletAssetMatch = cleanPath.match(/^\/dashboard\/wallet\/([^/]+)$/i);
  if (walletAssetMatch) {
    return {
      label: `${formatAssetParam(walletAssetMatch[1])} Wallet`,
      category: 'wallet',
      shortPath: cleanPath,
    };
  }

  if (cleanPath === '/dashboard/transactions') {
    return { label: 'Transaction History', category: 'activity', shortPath: cleanPath };
  }
  if (cleanPath.startsWith('/dashboard/transactions/')) {
    return { label: 'Transaction Receipt', category: 'activity', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/settings/kyc') {
    return { label: 'KYC Verification', category: 'security', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/settings') {
    return { label: 'Settings & Security', category: 'security', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/profile') {
    return { label: 'User Profile', category: 'account', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/staking') {
    return { label: 'Staking Vault', category: 'wallet', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/connect') {
    return { label: 'Connect Wallet', category: 'wallet', shortPath: cleanPath };
  }
  if (cleanPath === '/dashboard/admin') {
    return { label: 'Dashboard Admin Redirect', category: 'admin', shortPath: cleanPath };
  }
  if (cleanPath === '/markets') {
    return { label: 'Live Markets', category: 'markets', shortPath: cleanPath };
  }
  if (cleanPath === '/support') {
    return { label: 'Support Center', category: 'support', shortPath: cleanPath };
  }
  if (cleanPath === '/rescue') {
    return { label: 'Wallet Recovery', category: 'security', shortPath: cleanPath };
  }
  if (cleanPath === '/giftflow') {
    return { label: 'GiftFlow', category: 'public', shortPath: cleanPath };
  }
  if (cleanPath.startsWith('/company/')) {
    const seg = cleanPath.split('/')[2] || 'Company';
    return {
      label: `Company · ${seg.charAt(0).toUpperCase() + seg.slice(1)}`,
      category: 'public',
      shortPath: cleanPath,
    };
  }
  if (cleanPath === '/auth/login') {
    return { label: 'Signing In', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/signup') {
    return { label: 'Creating Account', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/verify-email') {
    return { label: 'Email OTP Verification', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/recovery-phrase') {
    return { label: 'Recovery Phrase Setup', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/create-pin') {
    return { label: 'Transaction PIN Setup', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/forgot-password') {
    return { label: 'Password Reset', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/update-password') {
    return { label: 'Updating Password', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/login-recovery') {
    return { label: 'Seed Phrase Login', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath === '/auth/success') {
    return { label: 'Onboarding Complete', category: 'auth', shortPath: cleanPath };
  }
  if (cleanPath.startsWith('/admin')) {
    return { label: 'Admin Console', category: 'admin', shortPath: cleanPath };
  }

  const tail = cleanPath.split('/').filter(Boolean).pop() || 'Site';
  const pretty = tail
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { label: pretty, category: 'public', shortPath: cleanPath };
}

export function parseDeviceSummary(userAgent?: string | null): string | null {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const ua = userAgent.trim();
  if (!ua) return null;

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS/i.test(ua) || (/Chrome\//i.test(ua) && !/Edg\//i.test(ua))) browser = 'Chrome';
  else if (/FxiOS|Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/wv\)/i.test(ua)) browser = 'In-App Browser';

  let os = 'Device';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

export const ONLINE_WINDOW_MS = 90 * 1000; // 90 seconds (heartbeat runs every 25s while visible)
export const IDLE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function computePresence(
  telemetry?: Partial<UserTelemetry> | null,
  nowMs: number = Date.now()
): PresenceState {
  if (!telemetry?.lastActiveAt) return 'offline';
  if (telemetry.lastEvent === 'leave') return 'offline';

  const lastMs = new Date(telemetry.lastActiveAt).getTime();
  if (!Number.isFinite(lastMs)) return 'offline';

  const diffMs = Math.max(0, nowMs - lastMs);
  if (diffMs <= ONLINE_WINDOW_MS) return 'online';
  if (diffMs <= IDLE_WINDOW_MS) return 'idle';
  return 'offline';
}

export function formatRelativeTime(iso?: string | null, nowMs: number = Date.now()): string {
  if (!iso) return 'Never';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'Unknown';

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatFullTimestamp(iso?: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
