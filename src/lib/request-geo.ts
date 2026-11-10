import {
  getCountryNameFromCode,
  normalizeCountryCode,
  parseDeviceSummary,
} from '@/lib/activity';

export interface RequestGeoInfo {
  ip: string | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
}

function safeDecodeHeader(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed).trim() || null;
  } catch {
    return trimmed;
  }
}

export function normalizeIpAddress(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let ip = raw.trim();
  if (!ip) return null;

  // Strip surrounding quotes if present
  ip = ip.replace(/^"+|"+$/g, '');

  // Handle IPv6 with brackets & port: [2001:db8::1]:443
  if (ip.startsWith('[')) {
    const closeIdx = ip.indexOf(']');
    if (closeIdx !== -1) {
      ip = ip.slice(1, closeIdx);
    }
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    // IPv4 with port
    ip = ip.split(':')[0];
  }

  // Strip IPv4-mapped IPv6 prefix ::ffff:
  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return ip || null;
}

export function isPrivateOrLocalIp(ip?: string | null): boolean {
  if (!ip) return true;
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === 'localhost' || lower === '0.0.0.0') return true;
  if (lower.startsWith('127.')) return true;
  if (lower.startsWith('10.')) return true;
  if (lower.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  if (lower.startsWith('169.254.')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) {
    return true;
  }
  return false;
}

export function extractClientIpFromHeaders(headers: Headers): string | null {
  const candidates: string[] = [];

  for (const key of [
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-vercel-forwarded-for',
    'x-forwarded-for',
  ]) {
    const val = headers.get(key);
    if (!val) continue;
    for (const part of val.split(',')) {
      const normalized = normalizeIpAddress(part);
      if (normalized) candidates.push(normalized);
    }
  }

  if (candidates.length === 0) return null;

  const firstPublic = candidates.find((ip) => !isPrivateOrLocalIp(ip));
  return firstPublic || candidates[0];
}

export async function extractRequestGeo(headers: Headers): Promise<RequestGeoInfo> {
  const ip = extractClientIpFromHeaders(headers);

  let countryCode =
    normalizeCountryCode(headers.get('cf-ipcountry')) ||
    normalizeCountryCode(headers.get('x-vercel-ip-country')) ||
    normalizeCountryCode(headers.get('x-country-code'));

  const city =
    safeDecodeHeader(headers.get('cf-ipcity')) ||
    safeDecodeHeader(headers.get('x-vercel-ip-city'));

  const region =
    safeDecodeHeader(headers.get('cf-region')) ||
    safeDecodeHeader(headers.get('x-vercel-ip-country-region'));

  const device = parseDeviceSummary(headers.get('user-agent'));

  let countryName = countryCode ? getCountryNameFromCode(countryCode) : null;

  // Fallback external geo lookup if CDN headers didn't supply country code
  if (!countryCode && ip && !isPrivateOrLocalIp(ip)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const geoRes = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const apiCode = normalizeCountryCode(geoData?.country);
        if (apiCode) {
          countryCode = apiCode;
          countryName = getCountryNameFromCode(apiCode);
        }
      }
    } catch {
      // Fail open without blocking activity tracking
    }
  }

  return {
    ip,
    countryCode,
    countryName,
    city,
    region,
    device,
  };
}
