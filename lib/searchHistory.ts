/**
 * Recently looked-up bills, kept in localStorage.
 *
 * No backend: this is a convenience so nobody has to retype a fourteen-digit
 * reference number, and it belongs to the device rather than to an account. Every
 * read is defensive — localStorage is shared with anything else on the origin, can
 * be edited by hand, and throws outright in private mode on some browsers, so bad
 * data has to degrade to an empty list rather than a broken page.
 */

const STORAGE_KEY = "unit-tracker:search-history";

/** Enough to cover a household's meters without turning into a filing cabinet. */
const MAX_ENTRIES = 8;

export type SearchHistoryEntry = {
  providerCode: string;
  referenceNo: string;
  /** Filled in once the bill has been fetched; absent until then. */
  consumerName?: string;
  /** ISO timestamp of the most recent lookup, used only for ordering. */
  lastSearchedAt: string;
};

function isEntry(value: unknown): value is SearchHistoryEntry {
  const entry = value as SearchHistoryEntry | null;
  return (
    !!entry &&
    typeof entry.providerCode === "string" &&
    entry.providerCode !== "" &&
    typeof entry.referenceNo === "string" &&
    entry.referenceNo !== "" &&
    typeof entry.lastSearchedAt === "string"
  );
}

/** Two lookups are the same bill when the provider and reference number match. */
function isSame(a: { providerCode: string; referenceNo: string }, b: SearchHistoryEntry): boolean {
  return a.providerCode === b.providerCode && a.referenceNo === b.referenceNo;
}

export function readSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function write(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
  if (typeof window === "undefined") return entries;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Full or unavailable storage costs the user a convenience, not their lookup.
  }
  return entries;
}

/**
 * Records a lookup, newest first.
 *
 * A repeat of a bill already in the list moves it to the top and keeps whatever it
 * already knew — so re-running a search before the bill comes back does not wipe
 * the consumer name that a previous lookup had filled in.
 */
export function rememberSearch(
  entry: { providerCode: string; referenceNo: string; consumerName?: string },
  history: SearchHistoryEntry[] = readSearchHistory(),
): SearchHistoryEntry[] {
  const previous = history.find((candidate) => isSame(entry, candidate));

  const updated: SearchHistoryEntry = {
    providerCode: entry.providerCode,
    referenceNo: entry.referenceNo,
    ...(entry.consumerName || previous?.consumerName
      ? { consumerName: entry.consumerName || previous?.consumerName }
      : {}),
    lastSearchedAt: new Date().toISOString(),
  };

  const rest = history.filter((candidate) => !isSame(entry, candidate));
  return write([updated, ...rest].slice(0, MAX_ENTRIES));
}

export function forgetSearch(
  entry: { providerCode: string; referenceNo: string },
  history: SearchHistoryEntry[] = readSearchHistory(),
): SearchHistoryEntry[] {
  return write(history.filter((candidate) => !isSame(entry, candidate)));
}
