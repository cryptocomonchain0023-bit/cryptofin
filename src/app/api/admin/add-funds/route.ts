import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { sendEmail, emailCompletedDeposit } from '@/lib/emails';

const formatNetwork = (currency: string) => {
  if (!currency) return 'Unknown';
  if (currency === 'USDT' || currency === 'USDC' || currency.includes('ERC20')) return 'Ethereum (ERC20)';
  if (currency.includes('_TRX') || currency.includes('TRC20')) return 'Tron (TRC20)';
  if (currency.includes('_BNB') || currency.includes('BEP20')) return 'BNB Smart Chain (BEP20)';
  if (currency.includes('_SOL') || currency.includes('SOLANA')) return 'Solana';
  if (currency.includes('_MATIC') || currency.includes('POLYGON')) return 'Polygon';
  if (currency.includes('_AVAX') || currency.includes('AVALANCHE')) return 'Avalanche';
  if (currency === 'BTC') return 'Bitcoin';
  if (currency === 'ETH') return 'Ethereum';
  if (currency === 'BNB') return 'BNB Smart Chain (BEP20)';
  if (currency === 'SOL') return 'Solana';
  if (currency === 'TRX') return 'Tron (TRC20)';
  if (currency === 'MATIC') return 'Polygon';
  if (currency === 'AVAX') return 'Avalanche';
  return 'Unknown';
};

export async function POST(request: Request) {
  try {
    const { user: adminUser, isAdmin, supabaseAdmin, authError } =
      await verifyAdminRequest(request);

    if (!adminUser) {
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

    const body = await request.json();
    const {
      selectedUser,
      walletType,
      amount,
      fromAddress,
      txHash,
      date,
      sendEmail: shouldSendEmail,
    } = body;

    if (!selectedUser) {
      return NextResponse.json({ error: 'No user selected' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let currency = walletType;
    if (walletType === 'usdt_erc20') currency = 'USDT';
    else if (walletType === 'usdt_trc20') currency = 'USDT_TRX';
    else if (walletType === 'usdt_bep20') currency = 'USDT_BNB';
    else if (walletType === 'usdt_sol') currency = 'USDT_SOL';
    else if (walletType === 'usdt_matic') currency = 'USDT_MATIC';
    else if (walletType === 'usdt_avax') currency = 'USDT_AVAX';
    else if (walletType === 'usdc_erc20' || walletType === 'usdc') currency = 'USDC';
    else if (walletType === 'usdc_solana' || walletType === 'usdc_sol') currency = 'USDC_SOL';
    else if (walletType === 'usdc_bep20') currency = 'USDC_BNB';
    else if (walletType === 'usdc_matic') currency = 'USDC_MATIC';
    else if (walletType === 'usdc_avax') currency = 'USDC_AVAX';
    else if (walletType === 'btc') currency = 'BTC';
    else if (walletType === 'eth') currency = 'ETH';
    else if (walletType === 'bnb') currency = 'BNB';
    else if (walletType === 'sol') currency = 'SOL';
    else if (walletType === 'trx') currency = 'TRX';
    else if (walletType === 'matic') currency = 'MATIC';
    else if (walletType === 'avax') currency = 'AVAX';

    let balanceField = '';
    if (walletType === 'usdt_erc20') balanceField = 'usdt_erc20_balance';
    else if (walletType === 'usdt_trc20') balanceField = 'usdt_trc20_balance';
    else if (walletType === 'usdt_bep20') balanceField = 'usdt_bep20_balance';
    else if (walletType === 'usdt_sol') balanceField = 'usdt_sol_balance';
    else if (walletType === 'usdt_matic') balanceField = 'usdt_matic_balance';
    else if (walletType === 'usdt_avax') balanceField = 'usdt_avax_balance';
    else if (walletType === 'usdc_erc20' || walletType === 'usdc') balanceField = 'usdc_balance';
    else if (walletType === 'usdc_bep20') balanceField = 'usdc_bep20_balance';
    else if (walletType === 'usdc_solana' || walletType === 'usdc_sol') balanceField = 'usdc_solana_balance';
    else if (walletType === 'usdc_matic') balanceField = 'usdc_matic_balance';
    else if (walletType === 'usdc_avax') balanceField = 'usdc_avax_balance';
    else if (walletType === 'btc') balanceField = 'btc_balance';
    else if (walletType === 'eth') balanceField = 'balance';
    else if (walletType === 'bnb') balanceField = 'bnb_balance';
    else if (walletType === 'sol') balanceField = 'sol_balance';
    else if (walletType === 'trx') balanceField = 'trx_balance';
    else if (walletType === 'matic') balanceField = 'matic_balance';
    else if (walletType === 'avax') balanceField = 'avax_balance';
    else balanceField = walletType + '_balance';

    // 1. Resolve user from profile with auth fallback
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', selectedUser)
      .maybeSingle();

    let resolvedUser: any = profile;
    if (!resolvedUser) {
      const { data: authLookup } = await supabaseAdmin.auth.admin.getUserById(selectedUser);
      if (authLookup?.user) {
        const meta = (authLookup.user.user_metadata || {}) as Record<string, any>;
        resolvedUser = {
          id: authLookup.user.id,
          email: authLookup.user.email || null,
          first_name: meta.first_name || null,
          last_name: meta.last_name || null,
          full_name: meta.full_name || null,
        };
      }
    }

    if (!resolvedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Get or create primary wallet
    let { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', selectedUser)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: selectedUser, is_primary: true })
        .select()
        .single();
      wallet = newWallet;
    }

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const { data: newTx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: selectedUser,
        type: 'deposit',
        amount: numAmount,
        currency: currency,
        status: 'completed',
        created_at: date || new Date().toISOString(),
        from_address: fromAddress || null,
        tx_hash: txHash || null,
      })
      .select()
      .single();

    if (txErr) {
      throw new Error('DB Error creating transaction: ' + txErr.message);
    }

    if (balanceField) {
      const currentBalance = parseFloat(wallet[balanceField] || 0);
      const { error: updateErr } = await supabaseAdmin
        .from('wallets')
        .update({ [balanceField]: currentBalance + numAmount })
        .eq('id', wallet.id);
      if (updateErr) throw new Error('DB Error updating wallet: ' + updateErr.message);
    }

    // 3. Send email if requested
    if (shouldSendEmail && resolvedUser.email) {
      try {
        const symbol = currency.split('_')[0];
        const displayUsername =
          resolvedUser.first_name || resolvedUser.last_name
            ? `${resolvedUser.first_name || ''} ${resolvedUser.last_name || ''}`.trim()
            : resolvedUser.email
            ? resolvedUser.email.split('@')[0]
            : 'Member';

        const networkStr = formatNetwork(currency);
        const dateUtc = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const finalTxId = txHash
          ? txHash.substring(0, 10) + '...'
          : newTx?.id?.substring(0, 8) || 'Internal';

        const emailTemplate = emailCompletedDeposit(
          numAmount,
          symbol,
          networkStr,
          finalTxId,
          dateUtc,
          displayUsername
        );
        await sendEmail({ to: resolvedUser.email, ...emailTemplate });
      } catch (emailErr) {
        console.error('Failed to send email to ' + resolvedUser.email, emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
