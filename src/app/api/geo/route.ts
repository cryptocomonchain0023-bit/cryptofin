import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const headers = request.headers;

    // 1. Try Cloudflare & Vercel Geo headers
    const countryCode = 
      headers.get('cf-ipcountry') || 
      headers.get('x-vercel-ip-country') || 
      headers.get('x-country-code') || 
      '';

    const city = 
      headers.get('cf-ipcity') || 
      headers.get('x-vercel-ip-city') || 
      '';

    const region = 
      headers.get('cf-region') || 
      headers.get('x-vercel-ip-country-region') || 
      '';

    const ip = 
      headers.get('cf-connecting-ip') || 
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
      headers.get('x-real-ip') || 
      '';

    let countryName = '';

    if (countryCode && countryCode.length === 2 && countryCode !== 'XX' && countryCode !== 'T1') {
      try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        countryName = regionNames.of(countryCode.toUpperCase()) || '';
      } catch (e) {
        console.error('Error resolving country code:', e);
      }
    }

    // 2. If headers did not supply a valid country (e.g. localhost or stripped header)
    if (!countryName && ip && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const geoRes = await fetch(`https://api.country.is/${ip}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.country) {
            const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
            countryName = regionNames.of(geoData.country.toUpperCase()) || '';
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    return NextResponse.json({
      success: true,
      country: countryName || null,
      countryCode: countryCode ? countryCode.toUpperCase() : null,
      city: city || null,
      region: region || null,
      ip: ip || null
    });
  } catch (error: any) {
    console.error('Geo API error:', error);
    return NextResponse.json({
      success: false,
      country: null,
      error: error.message
    }, { status: 500 });
  }
}
