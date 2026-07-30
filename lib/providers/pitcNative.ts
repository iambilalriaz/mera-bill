"use client";

import {
  BillProviderError,
  type BillChargeLine,
  type BillHistoryEntry,
  type UtilityBillData,
} from "./types";

/**
 * On-device counterpart to lib/providers/pitc.ts, used only inside the Capacitor app
 * (see BillScreen.tsx's Capacitor.isNativePlatform() branch).
 *
 * bill.pitc.com.pk accepts connections only from Pakistani IP space (measured
 * unreachable from 25+ nodes worldwide — see README). A server hosted anywhere else
 * can't reach it at all. A phone running this app on a Pakistani connection can, and
 * CapacitorHttp's native networking bypasses the WebView's CORS/credentials
 * restriction that blocks a plain in-page fetch() from carrying the portal's session
 * cookie (confirmed: a credentialed cross-origin fetch gets "no bill found" because
 * the cookie never attaches; verified with a standalone probe app on-device).
 *
 * That probe also settled the one real unknown: the session cookie between the
 * search-page GET and the postback POST is carried automatically by the native HTTP
 * layer's own cookie jar. No manual Set-Cookie/Cookie shuttling like the server
 * version does, and no undici Agent/ProxyAgent — there's no geo-fence to route around
 * once the request originates on a Pakistani device.
 *
 * Parsing is reimplemented here with DOMParser/querySelectorAll instead of cheerio:
 * cheerio depends on Node built-ins with no guaranteed browser/WebView bundle, and
 * DOMParser is native to the WebView. The CSS selectors below mirror pitc.ts's
 * cellText/panelDate/labelledValue/parseChargesBreakdown/parseBillHistory exactly —
 * if PITC changes the portal markup, both files need the same fix.
 */
const PORTAL_ORIGIN = "https://bill.pitc.com.pk";
const FETCH_TIMEOUT_MS = 20_000;

const METER_CELL_INDEX = {
  meterNo: 1,
  previousReading: 3,
  presentReading: 4,
  billedUnits: 5,
} as const;

type PitcNativeConfig = { code: string; label: string };

/**
 * Deliberately not importing lib/providers/registry.ts for this: it chains into
 * pitc.ts, which pulls in cheerio and undici — fine on the server, but this file is
 * "use client" and must stay free of Node-only dependencies (see app/page.tsx, which
 * keeps the same registry server-side for the same reason). Mirrors the enabled
 * DISCOs in lib/providers/catalog.ts; keep the two in sync.
 */
const NATIVE_PROVIDER_LABELS: Record<string, string> = {
  mepco: "MEPCO",
  lesco: "LESCO",
  fesco: "FESCO",
};

function portalUrl(config: PitcNativeConfig): string {
  return `${PORTAL_ORIGIN}/${config.code}bill`;
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function text(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function cellText(doc: Document, oneBasedIndex: number): string {
  const cells = doc.querySelectorAll(".meter-info-grid .meter-info-cell");
  return text(cells[oneBasedIndex - 1]?.querySelector(".val-space") ?? null);
}

function panelDate(doc: Document, label: string): string {
  for (const cell of Array.from(doc.querySelectorAll(".right-grid-cell"))) {
    if (text(cell.querySelector(".right-panel-en")).toUpperCase().includes(label)) {
      return text(cell.querySelector(".right-panel-date-val"));
    }
  }
  return "";
}

function labelledValue(doc: Document, label: RegExp): string | null {
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (el.children.length > 0) continue;

    const value = text(el);
    if (!label.test(value)) continue;

    const inline = value.replace(label, "").trim();
    const candidate =
      inline || text(el.nextElementSibling) || text(el.parentElement?.nextElementSibling ?? null);

    if (candidate) return candidate;
  }
  return null;
}

function parseChargesBreakdown(doc: Document): BillChargeLine[] {
  const lines: BillChargeLine[] = [];

  for (const row of Array.from(doc.querySelectorAll(".charges-bd-row"))) {
    const label = text(row.querySelector(".charges-bd-en"));
    const amount = toNumber(text(row.querySelector(".charges-bd-val")));
    if (!label || amount === null) continue;

    const percent = toNumber(text(row.querySelector(".charges-bd-pct")));
    lines.push({ label, amount, ...(percent === null ? {} : { percent }) });
  }

  return lines;
}

function parseBillHistory(doc: Document): BillHistoryEntry[] {
  const entries: BillHistoryEntry[] = [];

  for (const row of Array.from(doc.querySelectorAll(".history-row"))) {
    const cells = Array.from(row.querySelectorAll(".history-cell")).map((cell) => text(cell));
    const [month, , rawUnits, rawBilled, rawPaid] = cells;
    const units = toNumber(rawUnits ?? "");
    const billedAmount = toNumber(rawBilled ?? "");
    if (!month || units === null || billedAmount === null) continue;

    const paidAmount = toNumber(rawPaid ?? "");
    entries.push({
      month,
      units,
      billedAmount,
      ...(paidAmount === null ? {} : { paidAmount }),
    });
  }

  return entries;
}

function networkError(cause: unknown, label: string): BillProviderError {
  const timedOut = cause instanceof Error && cause.name === "TimeoutError";

  console.error(`[${label}] native portal request failed`, cause);
  return new BillProviderError(
    "network",
    timedOut
      ? `The ${label} bill portal took too long to respond. Please try again in a moment.`
      : `Could not reach the ${label} bill portal. Check your connection and try again.`,
    { cause },
  );
}

/**
 * GET the search page, then POST the reference number. No manual cookie handling and
 * no explicit redirect handling — both are done for us here (see module comment).
 */
async function fetchBillHtml(config: PitcNativeConfig, referenceNo: string): Promise<string> {
  const url = portalUrl(config);

  let searchHtml: string;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new BillProviderError(
        "network",
        `The ${config.label} bill portal returned an error (HTTP ${response.status}). Please try again later.`,
      );
    }
    searchHtml = await response.text();
  } catch (cause) {
    if (cause instanceof BillProviderError) throw cause;
    throw networkError(cause, config.label);
  }

  const searchDoc = new DOMParser().parseFromString(searchHtml, "text/html");
  const fields: Record<string, string> = {};
  searchDoc.querySelectorAll('input[type="hidden"][name]').forEach((el) => {
    const name = el.getAttribute("name");
    if (name) fields[name] = el.getAttribute("value") ?? "";
  });

  // Without these the postback is rejected and we silently get the search page back.
  if (!fields.__VIEWSTATE || !fields.__RequestVerificationToken) {
    throw new BillProviderError(
      "parse",
      `The ${config.label} bill portal did not load as expected. Please try again later or enter your readings manually.`,
      { missingFields: ["__VIEWSTATE", "__RequestVerificationToken"].filter((f) => !fields[f]) },
    );
  }

  const body = new URLSearchParams({
    ...fields,
    rbSearchByList: "refno",
    searchTextBox: referenceNo,
    btnSearch: "Search",
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new BillProviderError(
        "network",
        `The ${config.label} bill portal returned an error (HTTP ${response.status}). Please try again later.`,
      );
    }
    return await response.text();
  } catch (cause) {
    if (cause instanceof BillProviderError) throw cause;
    throw networkError(cause, config.label);
  }
}

function parseBillHtml(
  html: string,
  referenceNo: string,
  config: PitcNativeConfig,
): UtilityBillData {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // No meter grid at all means the portal bounced us back to the search form,
  // rather than the markup having changed underneath us.
  if (doc.querySelectorAll(".meter-info-grid .meter-info-cell").length === 0) {
    throw new BillProviderError(
      "not_found",
      "No bill was found for that reference number. Please check the 14-digit reference number printed on your bill.",
    );
  }

  const presentReading = toNumber(cellText(doc, METER_CELL_INDEX.presentReading));
  const previousReading = toNumber(cellText(doc, METER_CELL_INDEX.previousReading));
  const billedUnits = toNumber(cellText(doc, METER_CELL_INDEX.billedUnits));
  const meterNo = cellText(doc, METER_CELL_INDEX.meterNo);
  const readingDate = panelDate(doc, "READING DATE");
  const consumerName = text(doc.querySelector(".val-space--address span"));
  const parsedReferenceNo = text(doc.querySelector(".consumer-detail-card--gbn .val-space"));

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

  const dueDate = text(doc.querySelector(".right-main-val--due")) || panelDate(doc, "DUE DATE");
  const parsedLoad = toNumber(labelledValue(doc, /san\.?\s*load/i) ?? "");
  const sanctionedLoad =
    parsedLoad !== null && parsedLoad > 0 && parsedLoad <= 500 ? parsedLoad : undefined;

  return {
    providerCode: config.code,
    referenceNo: parsedReferenceNo || referenceNo,
    consumerName,
    meterNo,
    previousReading: previousReading as number,
    presentReading: presentReading as number,
    billedUnits: billedUnits as number,
    readingDate,
    ...(dueDate ? { dueDate } : {}),
    ...(sanctionedLoad === undefined ? {} : { sanctionedLoad }),
    chargesBreakdown: parseChargesBreakdown(doc),
    billHistory: parseBillHistory(doc),
  };
}

/** Entry point used by BillScreen when running inside the Capacitor app. */
export async function fetchBillNative(
  providerCode: string,
  referenceNo: string,
): Promise<UtilityBillData> {
  const code = providerCode?.trim().toLowerCase();
  const label = NATIVE_PROVIDER_LABELS[code];
  if (!label) {
    throw new BillProviderError(
      "unknown_provider",
      `"${providerCode}" is not supported yet. Currently available: ${Object.values(NATIVE_PROVIDER_LABELS).join(", ")}.`,
    );
  }
  const config: PitcNativeConfig = { code, label };

  const normalized = referenceNo.replace(/[\s-]/g, "");
  if (!/^\d{10,20}$/.test(normalized)) {
    throw new BillProviderError(
      "invalid_input",
      "That does not look like a valid reference number. It should be the 14-digit number printed on your bill.",
    );
  }

  const html = await fetchBillHtml(config, normalized);
  return parseBillHtml(html, normalized, config);
}
