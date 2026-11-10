import { NextResponse, type NextRequest } from 'next/server';
import { extractRequestGeo } from '@/lib/request-geo';

export async function GET(request: NextRequest) {
  try {
    const geo = await extractRequestGeo(request.headers);

    return NextResponse.json({
      success: true,
      country: geo.countryName || null,
      countryCode: geo.countryCode || null,
      city: geo.city || null,
      region: geo.region || null,
      ip: geo.ip || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Geo lookup failed';
    console.error('Geo API error:', error);
    return NextResponse.json(
      {
        success: false,
        country: null,
        countryCode: null,
        error: message,
      },
      { status: 500 }
    );
  }
}
