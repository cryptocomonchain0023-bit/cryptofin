'use client';

import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  findCountryCodeByName,
  getCountryNameFromCode,
  normalizeCountryCode,
} from '@/lib/activity';

interface CountryFlagProps {
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  showCode?: boolean;
  fallbackLabel?: string | null;
  className?: string;
  textClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<CountryFlagProps['size']>, string> = {
  xs: 'w-3.5 h-2.5',
  sm: 'w-4 h-3',
  md: 'w-5 h-3.5',
  lg: 'w-6 h-4',
};

const ICON_SIZES: Record<NonNullable<CountryFlagProps['size']>, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};

export function CountryFlag({
  countryCode,
  countryName,
  city,
  size = 'sm',
  showName = true,
  showCode = false,
  fallbackLabel = null,
  className = '',
  textClassName = '',
}: CountryFlagProps) {
  const resolvedCode =
    normalizeCountryCode(countryCode) || findCountryCodeByName(countryName);
  const resolvedName =
    (countryName || '').trim() ||
    (resolvedCode ? getCountryNameFromCode(resolvedCode) : null);

  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedCode]);

  if (!resolvedCode && !resolvedName) {
    if (!fallbackLabel) return null;
    return (
      <span className={`inline-flex items-center gap-1.5 text-gray-400 ${className}`}>
        <Globe size={ICON_SIZES[size]} className="shrink-0 opacity-70" />
        <span className={textClassName}>{fallbackLabel}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {resolvedCode && !imgFailed ? (
        <img
          src={`https://flagcdn.com/w40/${resolvedCode.toLowerCase()}.png`}
          alt={resolvedName || resolvedCode}
          title={resolvedName || resolvedCode}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className={`${SIZE_CLASSES[size]} object-cover rounded-[2px] shadow-xs ring-1 ring-black/10 shrink-0 select-none`}
        />
      ) : (
        <Globe
          size={ICON_SIZES[size]}
          className="text-slate-400 shrink-0"
          aria-hidden="true"
        />
      )}

      {showName && (resolvedName || resolvedCode) && (
        <span className={`truncate ${textClassName}`}>
          {resolvedName || resolvedCode}
          {showCode && resolvedCode ? ` (${resolvedCode})` : ''}
          {city ? ` · ${city}` : ''}
        </span>
      )}
    </span>
  );
}
