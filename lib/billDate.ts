import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isValid,
  parse,
} from "date-fns";

/** Format DISCO bills print reading dates in, e.g. "30 JUN 26". */
const BILL_DATE_FORMAT = "dd MMM yy";

/** Format the BILL HISTORY panel labels its rows with, e.g. "Jun25" or "JUL25". */
const HISTORY_MONTH_FORMAT = "MMM yy";

/**
 * Parses a bill reading date such as "30 JUN 26".
 * Returns null instead of throwing — a date we cannot read must not break the
 * units calculation, the UI just shows "N/A" for anything date-derived.
 */
export function parseBillDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;

  // "30 JUN 26" -> "30 Jun 26"; also tolerates stray double spaces.
  const normalized = raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());

  const parsed = parse(normalized, BILL_DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

/** Whole days between the bill reading date and now; null when the date is unreadable. */
export function daysElapsedSince(
  readingDate: Date | null,
  now: Date = new Date(),
): number | null {
  if (!readingDate) return null;
  return differenceInCalendarDays(now, readingDate);
}

/**
 * Parses a BILL HISTORY month label such as "Jun25", "JUL25" or "Jun 25" to the
 * first of that month. Returns null rather than throwing — an unreadable label
 * means one observation is dropped from the tariff dataset, nothing more.
 */
export function parseHistoryMonth(raw: string | undefined | null): Date | null {
  if (!raw) return null;

  const match = raw.trim().replace(/\s+/g, "").match(/^([A-Za-z]{3})'?(\d{2})$/);
  if (!match) return null;

  const [, month, year] = match;
  const normalized = `${month[0].toUpperCase()}${month.slice(1).toLowerCase()} ${year}`;

  const parsed = parse(normalized, HISTORY_MONTH_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

/** Renders a date as a BILL HISTORY label, e.g. "Jun26". Inverse of the parse above. */
export function toHistoryMonth(date: Date): string {
  return format(date, "MMMyy");
}

/** Whole months between two dates, used to age-weight tariff observations. */
export function monthsBetween(earlier: Date, later: Date): number {
  return differenceInCalendarMonths(later, earlier);
}

/**
 * Renders an ISO timestamp for display, e.g. "30 Jul 2026, 14:02".
 *
 * Pinned to Pakistan time rather than the viewer's: this is the only rendering the
 * server and the browser can agree on, and disagreeing would be a hydration
 * mismatch. Every consumer of this app is on PKT anyway.
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "never";

  const date = new Date(iso);
  if (!isValid(date)) return "unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  }).format(date);
}

/** Human-friendly rendering of a parsed bill date, falling back to the raw string. */
export function formatBillDate(raw: string | undefined | null): string {
  const parsed = parseBillDate(raw);
  if (!parsed) return raw?.trim() || "N/A";
  return format(parsed, "d MMM yyyy");
}
