import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const moneyFmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyFmtCompact = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return moneyFmt.format(value);
}

/** Compact money for tight chart labels/tiles, e.g. $1.2M. */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return moneyFmtCompact.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return numberFmt.format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Format a cost with its currency label, e.g. "Rs 1,200,000". */
export function formatCost(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const num = Math.round(amount).toLocaleString();
  return currency ? `${currency} ${num}` : num;
}

/** Safe division: returns `fallback` when the denominator is 0/undefined. */
export function ratio(
  numerator: number,
  denominator: number,
  fallback = 0,
): number {
  if (!denominator || !Number.isFinite(denominator)) return fallback;
  return numerator / denominator;
}

/** Whole days from `a` to `b` (positive when b is after a). */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Deterministic id from arbitrary text (session-scoped, not cryptographic). */
export function hashId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
