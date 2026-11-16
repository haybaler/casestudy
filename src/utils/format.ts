export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '$0';
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    }
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPct(value: number | null | undefined, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatCellValue(col: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    const lower = col.toLowerCase();
    if (
      lower.includes('revenue') ||
      lower.includes('spend') ||
      lower.includes('value') ||
      lower.includes('gap') ||
      lower.includes('delta') ||
      lower.includes('rev')
    ) {
      return formatCurrency(val);
    }
    if (lower.includes('roas')) {
      return `${val.toFixed(2)}x`;
    }
    if (lower.includes('pct') || lower.includes('share') || lower.includes('rate')) {
      return `${val.toFixed(1)}%`;
    }
    return formatNumber(val);
  }
  return String(val);
}
