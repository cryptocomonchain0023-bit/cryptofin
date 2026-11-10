export type ChainFamily = 'evm' | 'btc' | 'sol' | 'trx';

export interface ManagedTokenDef {
  id: string;
  symbol: string;
  name: string;
  network: string;
  networkShort: string;
  balanceColumn: string;
  priceKey: string;
  chainFamily: ChainFamily;
  isStable?: boolean;
}

export const MANAGED_TOKENS: ManagedTokenDef[] = [
  {
    id: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin Network',
    networkShort: 'BTC',
    balanceColumn: 'btc_balance',
    priceKey: 'BTC',
    chainFamily: 'btc',
  },
  {
    id: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum (ERC-20)',
    networkShort: 'ERC-20',
    balanceColumn: 'balance',
    priceKey: 'ETH',
    chainFamily: 'evm',
  },
  {
    id: 'USDT',
    symbol: 'USDT',
    name: 'Tether (ERC-20)',
    network: 'Ethereum (ERC-20)',
    networkShort: 'ERC-20',
    balanceColumn: 'usdt_erc20_balance',
    priceKey: 'USDT',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'USDC',
    symbol: 'USDC',
    name: 'USDC (ERC-20)',
    network: 'Ethereum (ERC-20)',
    networkShort: 'ERC-20',
    balanceColumn: 'usdc_balance',
    priceKey: 'USDC',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'BNB',
    symbol: 'BNB',
    name: 'BNB',
    network: 'BNB Smart Chain (BEP-20)',
    networkShort: 'BEP-20',
    balanceColumn: 'bnb_balance',
    priceKey: 'BNB',
    chainFamily: 'evm',
  },
  {
    id: 'USDT_BNB',
    symbol: 'USDT',
    name: 'Tether (BEP-20)',
    network: 'BNB Smart Chain (BEP-20)',
    networkShort: 'BEP-20',
    balanceColumn: 'usdt_bep20_balance',
    priceKey: 'USDT',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'USDC_BNB',
    symbol: 'USDC',
    name: 'USDC (BEP-20)',
    network: 'BNB Smart Chain (BEP-20)',
    networkShort: 'BEP-20',
    balanceColumn: 'usdc_bep20_balance',
    priceKey: 'USDC',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'SOL',
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana',
    networkShort: 'SOL',
    balanceColumn: 'sol_balance',
    priceKey: 'SOL',
    chainFamily: 'sol',
  },
  {
    id: 'USDT_SOL',
    symbol: 'USDT',
    name: 'Tether (Solana)',
    network: 'Solana',
    networkShort: 'SOL',
    balanceColumn: 'usdt_sol_balance',
    priceKey: 'USDT',
    chainFamily: 'sol',
    isStable: true,
  },
  {
    id: 'USDC_SOL',
    symbol: 'USDC',
    name: 'USDC (Solana)',
    network: 'Solana',
    networkShort: 'SOL',
    balanceColumn: 'usdc_solana_balance',
    priceKey: 'USDC',
    chainFamily: 'sol',
    isStable: true,
  },
  {
    id: 'TRX',
    symbol: 'TRX',
    name: 'Tron',
    network: 'Tron (TRC-20)',
    networkShort: 'TRC-20',
    balanceColumn: 'trx_balance',
    priceKey: 'TRX',
    chainFamily: 'trx',
  },
  {
    id: 'USDT_TRX',
    symbol: 'USDT',
    name: 'Tether (TRC-20)',
    network: 'Tron (TRC-20)',
    networkShort: 'TRC-20',
    balanceColumn: 'usdt_trc20_balance',
    priceKey: 'USDT',
    chainFamily: 'trx',
    isStable: true,
  },
  {
    id: 'MATIC',
    symbol: 'MATIC',
    name: 'Polygon',
    network: 'Polygon',
    networkShort: 'MATIC',
    balanceColumn: 'matic_balance',
    priceKey: 'MATIC',
    chainFamily: 'evm',
  },
  {
    id: 'USDT_MATIC',
    symbol: 'USDT',
    name: 'Tether (Polygon)',
    network: 'Polygon',
    networkShort: 'MATIC',
    balanceColumn: 'usdt_matic_balance',
    priceKey: 'USDT',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'USDC_MATIC',
    symbol: 'USDC',
    name: 'USDC (Polygon)',
    network: 'Polygon',
    networkShort: 'MATIC',
    balanceColumn: 'usdc_matic_balance',
    priceKey: 'USDC',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'AVAX',
    symbol: 'AVAX',
    name: 'Avalanche',
    network: 'Avalanche C-Chain',
    networkShort: 'AVAX',
    balanceColumn: 'avax_balance',
    priceKey: 'AVAX',
    chainFamily: 'evm',
  },
  {
    id: 'USDT_AVAX',
    symbol: 'USDT',
    name: 'Tether (Avalanche)',
    network: 'Avalanche C-Chain',
    networkShort: 'AVAX',
    balanceColumn: 'usdt_avax_balance',
    priceKey: 'USDT',
    chainFamily: 'evm',
    isStable: true,
  },
  {
    id: 'USDC_AVAX',
    symbol: 'USDC',
    name: 'USDC (Avalanche)',
    network: 'Avalanche C-Chain',
    networkShort: 'AVAX',
    balanceColumn: 'usdc_avax_balance',
    priceKey: 'USDC',
    chainFamily: 'evm',
    isStable: true,
  },
];

export const LEGACY_USDT_BALANCE_COLUMN = 'usdt_balance';

export const EDITABLE_WALLET_BALANCE_COLUMNS: ReadonlySet<string> = new Set([
  ...MANAGED_TOKENS.map((t) => t.balanceColumn),
  LEGACY_USDT_BALANCE_COLUMN,
]);

export const DEFAULT_FALLBACK_PRICES: Record<string, number> = {
  BTC: 64500,
  ETH: 3450,
  BNB: 600,
  SOL: 145,
  TRX: 0.15,
  MATIC: 0.45,
  AVAX: 25,
  USDT: 1,
  USDC: 1,
};

export function getTokenPriceUsd(
  priceKey: string,
  prices: Record<string, number>
): number {
  if (priceKey === 'USDT' || priceKey === 'USDC') {
    return Number(prices[priceKey] ?? 1) || 1;
  }
  return Number(prices[priceKey] ?? DEFAULT_FALLBACK_PRICES[priceKey] ?? 0) || 0;
}

export interface TokenHolding {
  id: string;
  symbol: string;
  name: string;
  networkShort: string;
  balanceColumn: string;
  balance: number;
  usdValue: number;
  isLegacy?: boolean;
}

export function extractWalletHoldings(
  walletLike: Record<string, unknown> | null | undefined,
  prices: Record<string, number>
): { holdings: TokenHolding[]; totalUsd: number; legacyUsdtBalance: number } {
  if (!walletLike) {
    return { holdings: [], totalUsd: 0, legacyUsdtBalance: 0 };
  }

  const source =
    walletLike.balances && typeof walletLike.balances === 'object'
      ? (walletLike.balances as Record<string, unknown>)
      : walletLike;

  const holdings: TokenHolding[] = [];
  let totalUsd = 0;

  for (const token of MANAGED_TOKENS) {
    const qty = Number(source[token.balanceColumn] ?? 0);
    if (Number.isFinite(qty) && qty > 0) {
      const price = getTokenPriceUsd(token.priceKey, prices);
      const usdValue = qty * price;
      totalUsd += usdValue;
      holdings.push({
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        networkShort: token.networkShort,
        balanceColumn: token.balanceColumn,
        balance: qty,
        usdValue,
      });
    }
  }

  const legacyUsdtBalance = Number(source[LEGACY_USDT_BALANCE_COLUMN] ?? 0);
  if (Number.isFinite(legacyUsdtBalance) && legacyUsdtBalance > 0) {
    const usdtPrice = getTokenPriceUsd('USDT', prices);
    const usdValue = legacyUsdtBalance * usdtPrice;
    totalUsd += usdValue;
    holdings.push({
      id: 'USDT_LEGACY',
      symbol: 'USDT',
      name: 'Tether (Legacy Sync)',
      networkShort: 'Legacy',
      balanceColumn: LEGACY_USDT_BALANCE_COLUMN,
      balance: legacyUsdtBalance,
      usdValue,
      isLegacy: true,
    });
  }

  holdings.sort((a, b) => b.usdValue - a.usdValue || b.balance - a.balance);

  return { holdings, totalUsd, legacyUsdtBalance };
}

export function formatTransactionAsset(currency?: string | null): {
  token: string;
  network: string;
} {
  if (!currency) return { token: 'Unknown', network: 'Unknown' };
  const norm = currency.trim().toUpperCase();
  if (norm === 'MAIN' || norm === 'USD' || norm === 'WALLET') {
    return { token: 'USD', network: 'Main Wallet' };
  }

  const token = norm.split('_')[0];
  let network = 'Unknown';

  if (norm === 'USDT' || norm === 'USDC' || norm.includes('ERC20')) {
    network = 'Ethereum (ERC20)';
  } else if (norm.includes('_TRX') || norm.includes('TRC20') || norm === 'TRX') {
    network = 'Tron (TRC20)';
  } else if (norm.includes('_BNB') || norm.includes('BEP20') || norm === 'BNB') {
    network = 'BNB Smart Chain (BEP20)';
  } else if (norm.includes('_SOL') || norm.includes('SOLANA') || norm === 'SOL') {
    network = 'Solana';
  } else if (
    norm.includes('_MATIC') ||
    norm.includes('POLYGON') ||
    norm === 'MATIC' ||
    norm === 'POL'
  ) {
    network = 'Polygon';
  } else if (norm.includes('_AVAX') || norm.includes('AVALANCHE') || norm === 'AVAX') {
    network = 'Avalanche';
  } else if (norm === 'BTC') {
    network = 'Bitcoin';
  } else if (norm === 'ETH') {
    network = 'Ethereum';
  }

  return { token, network };
}

export function formatCryptoAmount(amount: number, maxDecimals = 6): string {
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function truncateAddress(addr?: string | null, start = 7, end = 5): string {
  if (!addr) return '';
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}
