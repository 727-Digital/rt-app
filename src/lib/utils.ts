import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function formatDate(s: string): string {
  return format(parseISO(s), 'MMM d, yyyy');
}

export function formatRelativeTime(s: string): string {
  return formatDistanceToNow(parseISO(s), { addSuffix: true });
}
