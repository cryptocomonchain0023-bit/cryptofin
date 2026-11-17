import { NextResponse } from 'next/server';
import { POST as linkWalletPost } from '@/app/api/wallet/link/route';

export const dynamic = 'force-dynamic';

/**
 * Legacy endpoint kept for backwards compatibility with older clients.
 * Only accepts public wallet addresses (never private keys or recovery phrases)
 * and delegates safely to /api/wallet/link without mutating custodial wallet rows.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.address) {
      const forwarded = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(body),
      });
      return linkWalletPost(forwarded);
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Direct secret imports are disabled for your security. Please link a public wallet address instead.',
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
