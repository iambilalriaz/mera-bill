import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { Agent, ProxyAgent, type Dispatcher } from "undici";
import {
  BillProviderError,
  type BillChargeLine,
  type BillHistoryEntry,
  type BillProvider,
  type UtilityBillData,
} from "./types";

/**
 * Several DISCOs share one bill portal operated by PITC — the only difference is the
 * path segment (`/mepcobill`, `/lescobill`, `/fescobill`, …). This module holds the
 * whole flow once; each provider file is a few lines calling `createPitcProvider`.
 *
 * The portal is an ASP.NET WebForms app. Requesting `/general?refno=X` directly just
 * redirects back to the search page — the bill is only served to a session that has
 * actually submitted the search form. So we open the search page, carry its cookies
 * and hidden fields into a postback, then follow the redirect to the bill.
 */
const PORTAL_ORIGIN = "https://bill.pitc.com.pk";

/**
 * The portal is hosted in Pakistan and is slow to reach from outside it. Node's
 * default connect timeout is 10s, which expired before the TCP handshake completed
 * and surfaced as `UND_ERR_CONNECT_TIMEOUT` — note this is *below* the per-request
 * timeout below, so raising that alone had no effect. Both are set explicitly now.
 */
const CONNECT_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 20_000;

/**
 * A lookup makes up to three sequential requests (search page, postback, bill page),
 * each of which may be retried. One budget across all of them keeps a bad day for the
 * portal from holding the request open for minutes.
 */
const TOTAL_BUDGET_MS = 45_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 600;

/** The bill portal serves a different (near-empty) page to obvious bots. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const BASE_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Index of each value inside `.meter-info-grid .meter-info-cell` (1-based, as the
 * portal renders them: meter no, MF, previous, present, units). Kept in one place
 * because this is the first thing that breaks when PITC changes their markup.
 */
const METER_CELL_INDEX = {
  meterNo: 1,
  previousReading: 3,
  presentReading: 4,
  billedUnits: 5,
} as const;

export type PitcProviderConfig = {
  /** Lowercase DISCO code, e.g. "mepco". Also forms the portal path: /mepcobill. */
  code: string;
  /** Display name used in the UI and in user-facing error messages. */
  label: string;
};

function portalUrl(config: PitcProviderConfig): string {
  return `${PORTAL_ORIGIN}/${config.code}bill`;
}

function cellText($: CheerioAPI, oneBasedIndex: number): string {
  return $(".meter-info-grid .meter-info-cell")
    .eq(oneBasedIndex - 1)
    .find(".val-space")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads a labelled date from the right-hand panel, e.g. "READING DATE" -> "30 JUN 26". */
function panelDate($: CheerioAPI, label: string): string {
  let value = "";

  $(".right-grid-cell").each((_, el) => {
    const cell = $(el);
    if (cell.find(".right-panel-en").text().toUpperCase().includes(label)) {
      value = cell.find(".right-panel-date-val").first().text().trim();
      return false; // stop iterating
    }
  });

  return value;
}

/**
 * Reads a value sitting next to a label, wherever on the page it happens to be.
 *
 * Used for "SAN LOAD", which is not in the meter grid and whose exact markup we
 * have not pinned down. Searching by label rather than by selector survives the
 * portal moving the field, which is the failure mode that matters here: a missing
 * sanctioned load degrades the estimate, it must never fail the lookup.
 */
function labelledValue($: CheerioAPI, label: RegExp): string | null {
  let value: string | null = null;

  $("*").each((_, el) => {
    const node = $(el);
    // Only leaf nodes: an ancestor's text contains the label too, and its "value"
    // would be the whole subtree.
    if (node.children().length > 0) return;

    const text = node.text().replace(/\s+/g, " ").trim();
    if (!label.test(text)) return;

    // The value may follow the label in the same node, or sit in the next one.
    const inline = text.replace(label, "").trim();
    const candidate = inline || node.next().text().trim() || node.parent().next().text().trim();

    if (candidate) {
      value = candidate;
      return false; // stop iterating
    }
  });

  return value;
}

/** "1,234" / "1 234 kWh" -> 1234. Returns null when there is no usable number. */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * "BILL CHARGES BREAKDOWN (RS.)" — rows of label / optional percentage / amount.
 * Returns [] rather than throwing: the breakdown enriches the estimate, it is not
 * needed to report a reading.
 */
function parseChargesBreakdown($: CheerioAPI): BillChargeLine[] {
  const lines: BillChargeLine[] = [];

  $(".charges-bd-row").each((_, el) => {
    const row = $(el);
    const label = row.find(".charges-bd-en").first().text().replace(/\s+/g, " ").trim();
    const amount = toNumber(row.find(".charges-bd-val").first().text());
    if (!label || amount === null) return;

    const percent = toNumber(row.find(".charges-bd-pct").first().text());
    lines.push({ label, amount, ...(percent === null ? {} : { percent }) });
  });

  return lines;
}

/** "BILL HISTORY" — twelve months of month / status / units / billed / paid. */
function parseBillHistory($: CheerioAPI): BillHistoryEntry[] {
  const entries: BillHistoryEntry[] = [];

  $(".history-row").each((_, el) => {
    const cells = $(el)
      .find(".history-cell")
      .map((_i, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();

    // [month, status, units, bill, payment] — status is an icon and often empty.
    const [month, , rawUnits, rawBilled, rawPaid] = cells;
    const units = toNumber(rawUnits ?? "");
    const billedAmount = toNumber(rawBilled ?? "");
    if (!month || units === null || billedAmount === null) return;

    const paidAmount = toNumber(rawPaid ?? "");
    entries.push({
      month,
      units,
      billedAmount,
      ...(paidAmount === null ? {} : { paidAmount }),
    });
  });

  return entries;
}

/**
 * `fetch` reports every transport failure as a bare "TypeError: fetch failed" and hides
 * the real reason one or more `cause` levels down, so both the retry decision and the
 * user-facing message have to be read from the deepest cause rather than the throw.
 */
function rootCause(error: unknown): { name: string; code: string } {
  let current: unknown = error;
  let name = "";
  let code = "";

  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    name = current.name;
    code = String((current as { code?: unknown }).code ?? code);
    current = (current as { cause?: unknown }).cause;
  }

  return { name, code };
}

/** Ran out of time rather than being refused — worth telling the user to wait. */
const TIMEOUT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ETIMEDOUT",
]);

/** Transport faults that a second attempt can plausibly get past. */
const RETRYABLE_CODES = new Set([
  ...TIMEOUT_CODES,
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EAI_AGAIN",
]);

function isTimeout(error: unknown): boolean {
  const { name, code } = rootCause(error);
  // AbortSignal.timeout() rejects with a DOMException that carries no code.
  return name === "TimeoutError" || TIMEOUT_CODES.has(code);
}

function isRetryable(error: unknown): boolean {
  const { name, code } = rootCause(error);
  return name === "TimeoutError" || RETRYABLE_CODES.has(code);
}

function timedOutMessage(label: string): string {
  return `The ${label} bill portal took too long to respond. Please try again in a moment.`;
}

function networkError(cause: unknown, label: string): BillProviderError {
  // The user-facing text is deliberately vague; keep the real reason for the logs.
  console.error(`[${label}] portal request failed`, cause);
  return new BillProviderError(
    "network",
    isTimeout(cause)
      ? timedOutMessage(label)
      : `Could not reach the ${label} bill portal. Check your connection and try again.`,
    { cause },
  );
}

/**
 * Connection pool for the portal, reused across requests in a warm function.
 *
 * `BILL_PORTAL_PROXY_URL` is the escape hatch for the portal refusing traffic from
 * outside Pakistan: point it at a proxy that egresses there and nothing else changes.
 */
let portalAgent: Dispatcher | undefined;

function portalDispatcher(): Dispatcher {
  if (portalAgent) return portalAgent;

  const options = {
    connect: { timeout: CONNECT_TIMEOUT_MS },
    headersTimeout: FETCH_TIMEOUT_MS,
    bodyTimeout: FETCH_TIMEOUT_MS,
  };
  const proxyUrl = process.env.BILL_PORTAL_PROXY_URL?.trim();

  portalAgent = proxyUrl ? new ProxyAgent({ uri: proxyUrl, ...options }) : new Agent(options);
  return portalAgent;
}

/** `dispatcher` is an undici extension that the DOM `RequestInit` type omits. */
type PortalRequestInit = RequestInit & { dispatcher: Dispatcher };

/** Time left in the budget shared by every request of a single lookup. */
type Deadline = { remainingMs: () => number };

function startDeadline(): Deadline {
  const expiresAt = Date.now() + TOTAL_BUDGET_MS;
  return { remainingMs: () => expiresAt - Date.now() };
}

/** One portal request, bounded by the per-request timeout and the remaining budget. */
async function portalFetch(
  url: string | URL,
  init: RequestInit,
  deadline: Deadline,
  label: string,
): Promise<Response> {
  const remaining = deadline.remainingMs();
  if (remaining <= 0) throw new BillProviderError("network", timedOutMessage(label));

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, remaining)),
      dispatcher: portalDispatcher(),
    } as PortalRequestInit);
  } catch (cause) {
    throw networkError(cause, label);
  }
}

/**
 * Retries the lookup as a whole rather than the individual request. A transport failure
 * mid-flow can leave the WebForms session half-spent, and re-posting a used __VIEWSTATE
 * gets the search page back — which the parser would report as "no bill found" for what
 * is really a network fault. Starting over with a fresh session cannot misreport itself
 * that way. Only transport faults are retried; a parse or not-found result is final.
 */
async function withPortalRetry<T>(
  runLookup: () => Promise<T>,
  deadline: Deadline,
  label: string,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runLookup();
    } catch (error) {
      const roomToRetry = deadline.remainingMs() > RETRY_DELAY_MS;
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error) || !roomToRetry) throw error;

      console.warn(`[${label}] portal lookup failed, retrying`, rootCause(error));
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/**
 * Reads a response body as text. Separate from `portalFetch` because the abort signal
 * outlives that call: the body can still stall after the headers arrived, and that has
 * to be reported as a network failure rather than escaping as an unhandled 500.
 */
async function portalText(response: Response, label: string): Promise<string> {
  try {
    return await response.text();
  } catch (cause) {
    throw networkError(cause, label);
  }
}

/** Collects `name=value` pairs from Set-Cookie, merged onto anything already held. */
function mergeCookies(response: Response, existing = ""): string {
  const jar = new Map<string, string>();

  for (const pair of existing.split("; ").filter(Boolean)) {
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }

  // getSetCookie() is the only way to read multiple Set-Cookie headers correctly.
  const setCookies =
    (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];

  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

type PortalSession = {
  cookie: string;
  /** __VIEWSTATE, __EVENTVALIDATION, __RequestVerificationToken and friends. */
  fields: Record<string, string>;
};

/** Loads the search page to obtain a session cookie and the WebForms hidden fields. */
async function openPortalSession(
  config: PitcProviderConfig,
  deadline: Deadline,
): Promise<PortalSession> {
  const url = portalUrl(config);

  const response = await portalFetch(url, { headers: BASE_HEADERS }, deadline, config.label);

  if (!response.ok) {
    throw new BillProviderError(
      "network",
      `The ${config.label} bill portal returned an error (HTTP ${response.status}). Please try again later.`,
    );
  }

  const cookie = mergeCookies(response);
  const $ = cheerio.load(await portalText(response, config.label));

  const fields: Record<string, string> = {};
  $('input[type="hidden"][name]').each((_, el) => {
    fields[$(el).attr("name") as string] = $(el).attr("value") ?? "";
  });

  // Without these the postback is rejected and we silently get the search page back.
  if (!fields.__VIEWSTATE || !fields.__RequestVerificationToken) {
    throw new BillProviderError(
      "parse",
      `The ${config.label} bill portal did not load as expected. Please try again later or enter your readings manually.`,
      { missingFields: ["__VIEWSTATE", "__RequestVerificationToken"].filter((f) => !fields[f]) },
    );
  }

  return { cookie, fields };
}

/** Submits the reference-number search and returns the resulting page's HTML. */
async function fetchBillHtml(
  config: PitcProviderConfig,
  referenceNo: string,
  deadline: Deadline,
): Promise<string> {
  const url = portalUrl(config);
  const session = await openPortalSession(config, deadline);

  const body = new URLSearchParams({
    ...session.fields,
    rbSearchByList: "refno",
    searchTextBox: referenceNo,
    btnSearch: "Search",
  });

  const response = await portalFetch(
    url,
    {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: session.cookie,
        Referer: url,
        Origin: PORTAL_ORIGIN,
      },
      body,
      // Handled by hand so the session cookie is definitely carried to the bill page.
      redirect: "manual",
    },
    deadline,
    config.label,
  );

  const location = response.headers.get("location");

  // A successful search redirects to /general?refno=…; anything else means the portal
  // kept us on the form, which the parser reports as "no bill found".
  if (!location) return portalText(response, config.label);

  const cookie = mergeCookies(response, session.cookie);

  const billResponse = await portalFetch(
    new URL(location, url),
    { headers: { ...BASE_HEADERS, Cookie: cookie, Referer: url } },
    deadline,
    config.label,
  );

  if (!billResponse.ok) {
    throw new BillProviderError(
      "network",
      `The ${config.label} bill portal returned an error (HTTP ${billResponse.status}). Please try again later.`,
    );
  }

  return portalText(billResponse, config.label);
}

export function parseBillHtml(
  html: string,
  referenceNo: string,
  config: PitcProviderConfig,
): UtilityBillData {
  const $ = cheerio.load(html);

  // No meter grid at all means the portal bounced us back to the search form,
  // rather than the markup having changed underneath us.
  if ($(".meter-info-grid .meter-info-cell").length === 0) {
    throw new BillProviderError(
      "not_found",
      "No bill was found for that reference number. Please check the 14-digit reference number printed on your bill.",
    );
  }

  const presentReading = toNumber(cellText($, METER_CELL_INDEX.presentReading));
  const previousReading = toNumber(cellText($, METER_CELL_INDEX.previousReading));
  const billedUnits = toNumber(cellText($, METER_CELL_INDEX.billedUnits));
  const meterNo = cellText($, METER_CELL_INDEX.meterNo);
  const readingDate = panelDate($, "READING DATE");
  const consumerName = $(".val-space--address span").first().text().replace(/\s+/g, " ").trim();
  const parsedReferenceNo = $(".consumer-detail-card--gbn .val-space").first().text().trim();

  const missingFields: string[] = [];
  if (presentReading === null) missingFields.push("presentReading");
  if (previousReading === null) missingFields.push("previousReading");
  if (billedUnits === null) missingFields.push("billedUnits");
  if (!meterNo) missingFields.push("meterNo");
  if (!readingDate) missingFields.push("readingDate");
  if (!consumerName) missingFields.push("consumerName");

  if (missingFields.length > 0) {
    throw new BillProviderError(
      "parse",
      `The bill was found but could not be read — the ${config.label} website layout may have changed. Please enter your readings manually or try again later.`,
      { missingFields },
    );
  }

  // Due date sits in its own panel, not alongside the reading date.
  const dueDate = $(".right-main-val--due").first().text().trim() || panelDate($, "DUE DATE");

  // Residential sanctioned loads are a few kW; anything outside this is a stray
  // number picked up next to the label rather than a real load.
  const parsedLoad = toNumber(labelledValue($, /san\.?\s*load/i) ?? "");
  const sanctionedLoad =
    parsedLoad !== null && parsedLoad > 0 && parsedLoad <= 500 ? parsedLoad : undefined;

  return {
    providerCode: config.code,
    // Prefer what the portal echoes back, fall back to what the user typed.
    referenceNo: parsedReferenceNo || referenceNo,
    consumerName,
    meterNo,
    previousReading: previousReading as number,
    presentReading: presentReading as number,
    billedUnits: billedUnits as number,
    readingDate,
    ...(dueDate ? { dueDate } : {}),
    ...(sanctionedLoad === undefined ? {} : { sanctionedLoad }),
    chargesBreakdown: parseChargesBreakdown($),
    billHistory: parseBillHistory($),
  };
}

/** Builds a `BillProvider` for any DISCO hosted on the shared PITC bill portal. */
export function createPitcProvider(config: PitcProviderConfig): BillProvider {
  return {
    code: config.code,
    label: config.label,

    async fetchBill(referenceNo: string): Promise<UtilityBillData> {
      const normalized = referenceNo.replace(/[\s-]/g, "");

      if (!/^\d{10,20}$/.test(normalized)) {
        throw new BillProviderError(
          "invalid_input",
          "That does not look like a valid reference number. It should be the 14-digit number printed on your bill.",
        );
      }

      const deadline = startDeadline();
      const html = await withPortalRetry(
        () => fetchBillHtml(config, normalized, deadline),
        deadline,
        config.label,
      );

      return parseBillHtml(html, normalized, config);
    },
  };
}

/** Exported for unit testing the selectors against saved HTML fixtures. */
export const __testing = { parseBillHtml, toNumber };
