import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import {
  sendEmail,
  emailCompletedDeposit,
  emailFailedDeposit,
  emailCompletedWithdrawal,
  emailReversedWithdrawal,
} from '@/lib/emails';

const formatNetwork = (currency: string) => {
  if (!currency) return 'Unknown';
  if (currency === 'USDT' || currency === 'USDC' || currency.includes('ERC20'))
    return 'Ethereum (ERC20)';
  if (currency.includes('_TRX') || currency.includes('TRC20')) return 'Tron (TRC20)';
  if (currency.includes('_BNB') || currency.includes('BEP20'))
    return 'BNB Smart Chain (BEP20)';
  if (currency.includes('_SOL') || currency.includes('SOLANA')) return 'Solana';
  if (currency.includes('_MATIC') || currency.includes('POLYGON')) return 'Polygon';
  if (currency.includes('_AVAX') || currency.includes('AVALANCHE')) return 'Avalanche';
  if (currency === 'BTC') return 'Bitcoin';
  if (currency === 'ETH') return 'Ethereum';
  if (currency === 'SOL') return 'Solana';
  return 'Unknown';
};

const shortAddr = (addr: string) =>
  addr ? (addr.length > 15 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr) : 'Internal';

export async function POST(request: Request) {
  try {
    const { user, isAdmin, supabaseAdmin, authError } =
      await verifyAdminRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: `Unauthorized: ${authError || 'Please sign in again.'}` },
        { status: 401 }
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }

    const { txId, newStatus } = await request.json();
    if (!txId || !newStatus)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .single();

    if (txErr || !tx)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    if (
      tx.status === 'completed' ||
      tx.status === 'failed' ||
      tx.status === 'rejected'
    ) {
      return NextResponse.json(
        { error: 'Transaction already processed' },
        { status: 400 }
      );
    }

    const amount = Math.abs(Number(tx.amount));
    const assetId = tx.currency;
    const network = formatNetwork(assetId);
    const dateUtc = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const shortTxId = tx.id.substring(0, 8);
    const destAddr = shortAddr(tx.to_address);
    const assetSymbol = assetId.split('_')[0];

    let colName = '';
    if (assetId === 'USDT' || assetId === 'usdt_erc20') colName = 'usdt_erc20_balance';
    else if (assetId === 'USDT_TRX' || assetId === 'usdt_trc20')
      colName = 'usdt_trc20_balance';
    else if (assetId === 'USDT_BNB' || assetId === 'usdt_bep20')
      colName = 'usdt_bep20_balance';
    else if (assetId === 'USDT_SOL' || assetId === 'usdt_sol')
      colName = 'usdt_sol_balance';
    else if (assetId === 'USDT_MATIC' || assetId === 'usdt_matic')
      colName = 'usdt_matic_balance';
    else if (assetId === 'USDT_AVAX' || assetId === 'usdt_avax')
      colName = 'usdt_avax_balance';
    else if (assetId === 'USDC_BNB' || assetId === 'usdc_bep20')
      colName = 'usdc_bep20_balance';
    else if (assetId === 'USDC_SOL' || assetId === 'usdc_solana')
      colName = 'usdc_solana_balance';
    else if (assetId === 'USDC' || assetId === 'usdc_erc20') colName = 'usdc_balance';
    else if (assetId === 'USDC_MATIC' || assetId === 'usdc_matic')
      colName = 'usdc_matic_balance';
    else if (assetId === 'USDC_AVAX' || assetId === 'usdc_avax')
      colName = 'usdc_avax_balance';
    else if (assetId === 'BTC' || assetId === 'btc') colName = 'btc_balance';
    else if (assetId === 'ETH' || assetId === 'eth') colName = 'balance';
    else if (assetId === 'BNB' || assetId === 'bnb') colName = 'bnb_balance';
    else if (assetId === 'SOL' || assetId === 'sol') colName = 'sol_balance';
    else if (assetId === 'TRX' || assetId === 'trx') colName = 'trx_balance';
    else if (assetId === 'MATIC' || assetId === 'matic') colName = 'matic_balance';
    else if (assetId === 'AVAX' || assetId === 'avax') colName = 'avax_balance';
    else colName = assetId.split('_')[0].toLowerCase() + '_balance';

    if (newStatus === 'completed') {
      if (tx.type === 'deposit' || tx.type === 'crypto_deposit') {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select(colName)
          .eq('user_id', tx.user_id)
          .single();
        const currentBal = Number(wallet?.[colName as keyof typeof wallet] || 0);

        const { error: wErr } = await supabaseAdmin
          .from('wallets')
          .update({ [colName]: currentBal + amount })
          .eq('user_id', tx.user_id);
        if (wErr) throw new Error('DB Error updating wallet: ' + wErr.message);
      }

      await supabaseAdmin
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', txId);

      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', tx.user_id)
        .single();
      if (userProfile?.email) {
        const uName =
          `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() ||
          (userProfile.email ? userProfile.email.split('@')[0] : 'Member');
        const emailTemplate =
          tx.type === 'withdrawal'
            ? emailCompletedWithdrawal(
                amount,
                assetSymbol,
                destAddr,
                network,
                shortTxId,
                dateUtc,
                uName
              )
            : emailCompletedDeposit(
                amount,
                assetSymbol,
                network,
                shortTxId,
                dateUtc,
                uName
              );
        await sendEmail({ to: userProfile.email, ...emailTemplate });
      }
    } else if (newStatus === 'rejected' || newStatus === 'failed') {
      if (tx.type === 'withdrawal') {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select(colName)
          .eq('user_id', tx.user_id)
          .single();
        const currentBal = Number(wallet?.[colName as keyof typeof wallet] || 0);

        const { error: wErr } = await supabaseAdmin
          .from('wallets')
          .update({ [colName]: currentBal + amount })
          .eq('user_id', tx.user_id);
        if (wErr) throw new Error('DB Error updating wallet: ' + wErr.message);
      }

      await supabaseAdmin
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', txId);

      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', tx.user_id)
        .single();
      if (userProfile?.email) {
        const uName =
          `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() ||
          (userProfile.email ? userProfile.email.split('@')[0] : 'Member');
        const emailTemplate =
          tx.type === 'withdrawal'
            ? emailReversedWithdrawal(amount, assetSymbol, destAddr, dateUtc, uName)
            : emailFailedDeposit(amount, assetSymbol, uName);
        await sendEmail({ to: userProfile.email, ...emailTemplate });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Transaction ${newStatus} successfully`,
    });
  } catch (err: any) {
    console.error('ADMIN TX ERROR:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
