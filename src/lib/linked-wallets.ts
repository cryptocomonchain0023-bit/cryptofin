import type { User } from '@supabase/supabase-js';

export type LinkedWalletStatus = 'pending' | 'approved' | 'rejected';

export interface LinkedWalletRecord {
  id: string;
  userId: string;
  address: string;
  network: string;
  walletProvider: string;
  label: string | null;
  status: LinkedWalletStatus;
  adminNote: string | null;
  ip: string | null;
  countryCode: string | null;
  countryName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export const SUPPORTED_WALLET_NETWORKS = [
  'Ethereum (ERC20)',
  'BNB Smart Chain (BEP20)',
  'Tron (TRC20)',
  'Solana (SOL)',
  'Bitcoin (BTC)',
  'Polygon (MATIC)',
  'Avalanche (C-Chain)',
] as const;

export const SUPPORTED_WALLET_PROVIDERS = [
  'MetaMask',
  'Trust Wallet',
  'Coinbase Wallet',
  'Phantom',
  'Ledger',
  'TronLink',
  'Exodus',
  'SafePal',
  'Bitget Wallet',
  'Other',
] as const;

export const LINK_WALLET_REASONS = [
  'Get Access To This Wallet',
  'Transfer Assets Into This Wallet',
  'Withdraw Assets From This Wallet',
  'Verify External Wallet Ownership',
] as const;

export function detectNetworkFromAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'Ethereum / EVM';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) return 'Tron (TRC20)';
  if (/^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(trimmed)) {
    return 'Bitcoin (BTC)';
  }
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(trimmed)) return 'Ripple (XRP)';
  if (/^(ltc1[a-zA-HJ-NP-Z0-9]{25,62}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$/.test(trimmed)) {
    return 'Litecoin (LTC)';
  }
  if (/^addr1[a-z0-9]{50,110}$/.test(trimmed)) return 'Cardano (ADA)';
  if (/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(trimmed)) return 'TON';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'Solana (SOL)';
  return null;
}

export function validatePublicWalletAddress(
  address: string,
  _network?: string | null
): { valid: boolean; normalized: string; error?: string } {
  const trimmed = address.trim();

  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Please enter a wallet address.' };
  }

  // Reject multi-word inputs (e.g., recovery phrases)
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter a public wallet address only (no spaces or phrases).',
    };
  }

  // Reject raw 64-hex private keys
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter your public wallet address, not a private key.',
    };
  }

  // Allow any valid public blockchain address format (EVM, BTC, TRX, SOL, XRP, LTC, ADA, TON, Cosmos, Polkadot, etc.)
  if (trimmed.length < 20 || trimmed.length > 128) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Please enter a valid public wallet address (20-128 characters).',
    };
  }

  if (!/^[a-zA-Z0-9:_-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Wallet address contains invalid characters.',
    };
  }

  return { valid: true, normalized: trimmed };
}

export function normalizeLinkedWalletStatus(raw: unknown): LinkedWalletStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'approved' || s === 'verified') return 'approved';
  if (s === 'rejected' || s === 'declined') return 'rejected';
  return 'pending';
}

export function parseLinkedWalletsFromAuthUser(
  authUser?: Pick<User, 'id' | 'app_metadata'> | null
): LinkedWalletRecord[] {
  const rawList = authUser?.app_metadata?.linked_wallets;
  if (!Array.isArray(rawList)) return [];

  const parsed: LinkedWalletRecord[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : '';
    const address = typeof r.address === 'string' && r.address.trim() ? r.address.trim() : '';
    if (!id || !address) continue;

    parsed.push({
      id,
      userId: typeof r.userId === 'string' && r.userId.trim() ? r.userId.trim() : authUser?.id || '',
      address,
      network:
        typeof r.network === 'string' && r.network.trim()
          ? r.network.trim()
          : detectNetworkFromAddress(address) || 'External Wallet',
      walletProvider:
        typeof r.walletProvider === 'string' && r.walletProvider.trim()
          ? r.walletProvider.trim()
          : 'External Wallet',
      label: typeof r.label === 'string' && r.label.trim() ? r.label.trim() : null,
      status: normalizeLinkedWalletStatus(r.status),
      adminNote: typeof r.adminNote === 'string' && r.adminNote.trim() ? r.adminNote.trim() : null,
      ip: typeof r.ip === 'string' && r.ip.trim() ? r.ip.trim() : null,
      countryCode:
        typeof r.countryCode === 'string' && r.countryCode.trim()
          ? r.countryCode.trim().toUpperCase()
          : null,
      countryName:
        typeof r.countryName === 'string' && r.countryName.trim()
          ? r.countryName.trim()
          : null,
      submittedAt:
        typeof r.submittedAt === 'string' && r.submittedAt.trim()
          ? r.submittedAt.trim()
          : new Date().toISOString(),
      reviewedAt:
        typeof r.reviewedAt === 'string' && r.reviewedAt.trim() ? r.reviewedAt.trim() : null,
      reviewedBy:
        typeof r.reviewedBy === 'string' && r.reviewedBy.trim() ? r.reviewedBy.trim() : null,
    });
  }

  return parsed.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}
