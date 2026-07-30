/**
 * Shared contract for every electricity distribution company (DISCO) adapter.
 * Nothing here may be specific to a single provider — see lib/providers/registry.ts
 * for how concrete adapters are wired in.
 */

/** One line of the bill's "BILL CHARGES BREAKDOWN (RS.)" panel. */
export type BillChargeLine = {
  label: string;
  /** Share of the bill, where the portal prints one (e.g. Taxes at 16.33 %). */
  percent?: number;
  amount: number;
};

/** One row of the bill's "BILL HISTORY" panel. */
export type BillHistoryEntry = {
  /** As printed, e.g. "Jun25". */
  month: string;
  units: number;
  billedAmount: number;
  paidAmount?: number;
};

export type UtilityBillData = {
  /** Lowercase code of the DISCO that produced the bill, e.g. "mepco". */
  providerCode: string;
  referenceNo: string;
  consumerName: string;
  meterNo: string;
  previousReading: number;
  presentReading: number;
  billedUnits: number;
  /** As printed on the bill, e.g. "30 JUN 26". Parsing lives in lib/billDate.ts. */
  readingDate: string;
  dueDate?: string;
  /**
   * Sanctioned load in kW, from the bill's "SAN LOAD" field. Fixed charges are
   * levied per kW of it. Absent when the portal omits it or prints it in a form we
   * cannot read — the estimate then assumes the residential minimum rather than
   * failing, so this must never break a lookup.
   */
  sanctionedLoad?: number;
  /**
   * Enrichment used to estimate the cost of newly consumed units. Both are empty
   * when the portal omits the panels — they must never fail a bill lookup.
   */
  chargesBreakdown: BillChargeLine[];
  billHistory: BillHistoryEntry[];
};

export type BillProvider = {
  /** Lowercase code this adapter is registered under. */
  code: string;
  /** Human-readable name shown in the UI, e.g. "MEPCO". */
  label: string;
  fetchBill(referenceNo: string): Promise<UtilityBillData>;
};

/** Why a bill lookup failed, so the API route can pick a sensible HTTP status. */
export type BillErrorKind =
  | "invalid_input"
  | "unknown_provider"
  | "network"
  | "not_found"
  | "parse";

export class BillProviderError extends Error {
  readonly kind: BillErrorKind;
  /** Fields the parser expected but could not find — useful when the site changes. */
  readonly missingFields?: string[];

  constructor(
    kind: BillErrorKind,
    message: string,
    options?: { missingFields?: string[]; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "BillProviderError";
    this.kind = kind;
    this.missingFields = options?.missingFields;
  }
}
