import { findCountryCodeByName, normalizeCountryCode } from '@/lib/activity';

// Geolocation & Real-time Location Detection Utility

let cachedLocation: {
  country: string | null;
  countryCode: string | null;
  city: string | null;
} | null = null;

// Timezone fallback mapping for instant offline / client-only fallback
const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  // Western Europe
  'Europe/Paris': 'France',
  'Europe/London': 'United Kingdom',
  'Europe/Berlin': 'Germany',
  'Europe/Rome': 'Italy',
  'Europe/Madrid': 'Spain',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Vienna': 'Austria',
  'Europe/Lisbon': 'Portugal',
  'Europe/Dublin': 'Ireland',
  'Europe/Athens': 'Greece',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',

  // Americas
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Phoenix': 'United States',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Montreal': 'Canada',
  'America/Sao_Paulo': 'Brazil',
  'America/Buenos_Aires': 'Argentina',
  'America/Mexico_City': 'Mexico',
  'America/Bogota': 'Colombia',
  'America/Lima': 'Peru',
  'America/Santiago': 'Chile',

  // Africa
  'Africa/Johannesburg': 'South Africa',
  'Africa/Lagos': 'Nigeria',
  'Africa/Nairobi': 'Kenya',
  'Africa/Cairo': 'Egypt',
  'Africa/Casablanca': 'Morocco',
  'Africa/Abidjan': "Côte d'Ivoire",
  'Africa/Accra': 'Ghana',
  'Africa/Algiers': 'Algeria',
  'Africa/Tunis': 'Tunisia',
  'Africa/Addis_Ababa': 'Ethiopia',
  'Africa/Dakar': 'Senegal',

  // Asia / Pacific
  'Asia/Tokyo': 'Japan',
  'Asia/Seoul': 'South Korea',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Shanghai': 'China',
  'Asia/Dubai': 'United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Kolkata': 'India',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Manila': 'Philippines',
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Pacific/Auckland': 'New Zealand',
};

export async function detectRealUserLocation(): Promise<{
  country: string;
  countryCode: string | null;
  city: string | null;
}> {
  if (cachedLocation && cachedLocation.country) {
    return {
      country: cachedLocation.country,
      countryCode: cachedLocation.countryCode,
      city: cachedLocation.city,
    };
  }

  // 1. Try server-side IP headers via /api/geo
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.country) {
        const resolvedCode =
          normalizeCountryCode(data.countryCode) || findCountryCodeByName(data.country);
        cachedLocation = {
          country: data.country,
          countryCode: resolvedCode,
          city: data.city || null,
        };
        return {
          country: data.country,
          countryCode: resolvedCode,
          city: data.city || null,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to detect location from /api/geo:', err);
  }

  // 2. Fallback: Detect from client Intl timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
      const detected = TIMEZONE_COUNTRY_MAP[tz];
      const detectedCode = findCountryCodeByName(detected);
      cachedLocation = { country: detected, countryCode: detectedCode, city: null };
      return { country: detected, countryCode: detectedCode, city: null };
    }

    // Try extracting continent or city from timezone name
    if (tz && tz.includes('/')) {
      const parts = tz.split('/');
      const cityOrRegion = parts[parts.length - 1].replace(/_/g, ' ');
      const maybeCode = findCountryCodeByName(cityOrRegion);
      cachedLocation = { country: cityOrRegion, countryCode: maybeCode, city: null };
      return { country: cityOrRegion, countryCode: maybeCode, city: null };
    }
  } catch {
    // Ignore
  }

  return { country: 'International', countryCode: null, city: null };
}
