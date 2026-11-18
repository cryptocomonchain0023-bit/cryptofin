import type { User } from '@supabase/supabase-js';

export type LinkedWalletStatus = 'pending' | 'approved' | 'rejected';

export interface LinkedWalletRecord {
  id: string;
  userId: string;
  address: string;
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

export const LINK_WALLET_REASONS = [
  'Get Access To This Wallet',
  'Transfer Assets Into This Wallet',
  'Withdraw Assets From This Wallet',
  'Verify External Wallet Ownership',
] as const;

export function validatePublicWalletAddress(
  address: string
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

  if (trimmed.length < 16 || trimmed.length > 128) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Please enter a valid public wallet address.',
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
