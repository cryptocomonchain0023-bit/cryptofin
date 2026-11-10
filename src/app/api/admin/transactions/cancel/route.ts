import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function resolveWalletColumn(
  currency?: string | null,
  metadata?: Record<string, unknown> | null
): string {
  const norm = String(currency || '').trim().toUpperCase();

  if (norm === 'MAIN' || norm === 'USD' || norm === 'WALLET') return 'wallet_balance';
  if (norm === 'SAVINGS') return 'savings_balance';

  if (norm === 'USDT' && metadata?.source === 'sync_job') return 'usdt_balance';

  if (norm === 'USDT' || norm === 'USDT_ERC20') return 'usdt_erc20_balance';
  if (norm === 'USDT_TRX' || norm === 'USDT_TRC20') return 'usdt_trc20_balance';
  if (norm === 'USDT_BNB' || norm === 'USDT_BEP20') return 'usdt_bep20_balance';
  if (norm === 'USDT_SOL' || norm === 'USDT_SOLANA') return 'usdt_sol_balance';
  if (norm === 'USDT_MATIC' || norm === 'USDT_POLYGON') return 'usdt_matic_balance';
  if (norm === 'USDT_AVAX' || norm === 'USDT_AVALANCHE') return 'usdt_avax_balance';

  if (norm === 'USDC' || norm === 'USDC_ERC20') return 'usdc_balance';
  if (norm === 'USDC_BNB' || norm === 'USDC_BEP20') return 'usdc_bep20_balance';
  if (norm === 'USDC_SOL' || norm === 'USDC_SOLANA') return 'usdc_solana_balance';
  if (norm === 'USDC_MATIC' || norm === 'USDC_POLYGON') return 'usdc_matic_balance';
  if (norm === 'USDC_AVAX' || norm === 'USDC_AVALANCHE') return 'usdc_avax_balance';

  if (norm === 'BTC') return 'btc_balance';
  if (norm === 'ETH') return 'balance';
  if (norm === 'BNB') return 'bnb_balance';
  if (norm === 'SOL') return 'sol_balance';
  if (norm === 'TRX') return 'trx_balance';
  if (norm === 'MATIC' || norm === 'POL') return 'matic_balance';
  if (norm === 'AVAX') return 'avax_balance';

  return norm.split('_')[0].toLowerCase() + '_balance';
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin =
      user.email?.toLowerCase() === 'admin@cryptofin.org' ||
      callerProfile?.is_admin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const txId = body?.txId;

    if (!txId || typeof txId !== 'string') {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .maybeSingle();

    if (txErr) throw txErr;

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found or already cancelled' },
        { status: 404 }
      );
    }

    const rawType = String(tx.type || '').toLowerCase();
    const status = String(tx.status || '').toLowerCase();
    const rawAmount = Number(tx.amount || 0);
    const absAmount = Math.abs(rawAmount);

    const isWithdrawal =
      rawType === 'withdrawal' ||
      rawType === 'send' ||
      rawType === 'transfer' ||
      rawAmount < 0;

    const meta =
      tx.metadata && typeof tx.metadata === 'object'
        ? (tx.metadata as Record<string, unknown>)
        : null;

    const normCurrency = String(tx.currency || '').trim().toUpperCase();
    let column = resolveWalletColumn(tx.currency, meta);

    let direction: 'deduct' | 'refund' | 'none' = 'none';
    if (!isWithdrawal) {
      // Deposit / credit: only deduct if it had already been credited
      if (
        (status === 'completed' || status === 'approved' || status === 'success') &&
        absAmount > 0
      ) {
        direction = 'deduct';
      }
    } else {
      // Withdrawal / debit: refund if DB balance was deducted (amount < 0) and not already rejected/failed
      if (
        rawAmount < 0 &&
        absAmount > 0 &&
        status !== 'failed' &&
        status !== 'rejected' &&
        status !== 'cancelled'
      ) {
        direction = 'refund';
      }
    }

    // If a SmartSend withdrawal stored a deducted ETH gas fee in metadata.fee, restore it too
    let ethFeeRefund = 0;
    if (direction === 'refund' && typeof meta?.fee === 'string') {
      const feeMatch = meta.fee.trim().match(/^([\d.]+)\s+ETH$/i);
      if (feeMatch) {
        const parsedFee = Number(feeMatch[1]);
        if (Number.isFinite(parsedFee) && parsedFee > 0) {
          ethFeeRefund = parsedFee;
        }
      }
    }

    let walletRow: Record<string, unknown> | null = null;
    let previousBalance = 0;
    let newBalance = 0;

    if (direction !== 'none' || ethFeeRefund > 0) {
      const { data: wallet, error: walletErr } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', tx.user_id)
        .maybeSingle();

      if (walletErr) throw walletErr;

      if (wallet) {
        walletRow = wallet as Record<string, unknown>;

        if (
          direction === 'deduct' &&
          normCurrency === 'USDT' &&
          column === 'usdt_erc20_balance' &&
          Number(walletRow.usdt_erc20_balance || 0) < absAmount &&
          Number(walletRow.usdt_balance || 0) >= absAmount
        ) {
          column = 'usdt_balance';
        }

        if (!(column in walletRow)) {
          return NextResponse.json(
            {
              error: `Unsupported wallet column "${column}" for currency "${tx.currency}"`,
            },
            { status: 400 }
          );
        }

        previousBalance = Number(walletRow[column] || 0);
        if (direction === 'deduct') {
          newBalance = Math.max(0, Number((previousBalance - absAmount).toFixed(8)));
        } else {
          newBalance = Number((previousBalance + absAmount).toFixed(8));
        }
      } else if (direction === 'refund') {
        return NextResponse.json(
          { error: 'User wallet record not found to restore balance' },
          { status: 404 }
        );
      }
    }

    // Delete transaction atomically first so concurrent requests cannot double-adjust balance
    const { data: deletedTx, error: deleteErr } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', txId)
      .select()
      .maybeSingle();

    if (deleteErr) throw deleteErr;

    if (!deletedTx) {
      return NextResponse.json(
        { error: 'Transaction was already cancelled' },
        { status: 404 }
      );
    }

    let balanceAdjusted = false;
    if (walletRow && direction !== 'none') {
      const updates: Record<string, number> = {
        [column]: newBalance,
      };

      if (ethFeeRefund > 0) {
        if (column === 'balance') {
          const combined = Number((newBalance + ethFeeRefund).toFixed(8));
          updates.balance = combined;
          newBalance = combined;
        } else if ('balance' in walletRow) {
          const currentEth = Number(walletRow.balance || 0);
          updates.balance = Number((currentEth + ethFeeRefund).toFixed(8));
        }
      }

      const { error: updateWalletErr } = await supabaseAdmin
        .from('wallets')
        .update(updates)
        .eq('user_id', tx.user_id);

      if (updateWalletErr) {
        // Restore deleted transaction row if wallet update fails
        await supabaseAdmin.from('transactions').insert(deletedTx);
        throw new Error(`Failed to update wallet balance: ${updateWalletErr.message}`);
      }

      balanceAdjusted = true;
    }

    return NextResponse.json({
      success: true,
      deletedId: txId,
      balanceAdjusted,
      direction,
      column: balanceAdjusted ? column : null,
      amount: absAmount,
      feeRefunded: ethFeeRefund,
      previousBalance: balanceAdjusted ? previousBalance : null,
      newBalance: balanceAdjusted ? newBalance : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel transaction';
    console.error('ADMIN CANCEL TX ERROR:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
