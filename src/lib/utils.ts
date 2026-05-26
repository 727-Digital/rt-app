import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Greeting-friendly first name from a full name. "Cartee Test" → "Cartee".
// Falls back to "there" so SMS bodies still read naturally when the lead
// row arrived without a parseable name. Mirrors the firstNameOf helper
// in supabase/functions/receive-lead so the same rule applies to the
// auto-intake SMS and the rep-side follow-up SMS.
export function firstNameOf(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] || 'there';
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPhone(s: string): string {
  const digits = s.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length !== 10) return s;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function formatSqft(n: number): string {
  return `${new Intl.NumberFormat('en-US').format(n)} sq ft`;
}

export function formatSqftCompact(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatCompactCurrency(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `$${formatted}K`;
  }
  return `$${n}`;
}

export function formatDate(s: string): string {
  return format(parseISO(s), 'MMM d, yyyy');
}

export function formatRelativeTime(s: string): string {
  return formatDistanceToNow(parseISO(s), { addSuffix: true });
}

// Display-friendly quote number in the format Andy's other company uses
// (Southern Turf Co): "{LastName}-{5-digit number}". The number is derived
// deterministically from the quote UUID so the same quote always shows
// the same number, no schema change required.
export function formatQuoteNumber(
  quoteId: string,
  leadName?: string | null,
): string {
  const lastName =
    (leadName || '').trim().split(/\s+/).pop()?.replace(/[^a-z]/gi, '') || 'Quote';
  const hex = quoteId.replace(/-/g, '').slice(-8);
  const num = (parseInt(hex, 16) % 90000) + 10000; // 10000-99999
  return `${lastName}-${num}`;
}
