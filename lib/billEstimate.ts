import type { BillChargeLine, BillHistoryEntry, UtilityBillData } from "./providers/types";
import { getCategory, getSchedule } from "./tariffs";
import type { TariffCategory, TariffSchedule, TariffSlab } from "./tariffs/types";

/**
 * Costing newly consumed units against the notified NEPRA tariff.
 *
 * Three things decide the answer, and only the first is a judgement call:
 *
 *  1. Which category the consumer is in. Protected households pay roughly half what
 *     unprotected ones pay for identical units, and nothing on the bill states
 *     which you are — it has to be read off the consumption history.
 *  2. The energy charge, which is worked out differently per category: protected
 *     progressively, unprotected as a single flat band (see `chargeFor`).
 *  3. The fixed charge, levied per kW of sanctioned load on the band the
 *     consumption lands in.
 *
 * What the tariff cannot tell us is GST, electricity duty, the fuel price
 * adjustment, TV fee and the surcharges, none of which are calculable without live
 * data. That is why the result is a range and not a number.
 */

/** Consumption at or below this, sustained, is what protected status turns on. */
const PROTECTED_LIMIT = 200;

/**
 * What the notified rates leave out: GST, electricity duty, the fuel price
 * adjustment, TV fee and the financing surcharges. None are calculable without live
 * data — but they are not a rounding error either. Measured against real MEPCO and
 * LESCO bills they add about 30% to the energy-plus-fixed figure, consistently
 * enough that a range centred on the bare tariff misses almost every bill (9 of 59
 * months in that check, against 33 of 59 with this applied).
 *
 * It is an observed multiplier, not a notified one, which is precisely why the
 * answer is presented as a range and hedged in the UI.
 */
const SURCHARGE_MULTIPLIER = 1.3;

/** How wide the quoted range is allowed to be. */
const SPREAD_FRACTION = 0.2;
const MIN_SPREAD = 1000;
const MAX_SPREAD = 2000;

/** Ranges are quoted to the nearest hundred; rupee precision would be a fiction. */
const ROUNDING = 100;

/**
 * Assumed when the bill does not state a sanctioned load. Domestic connections are
 * sanctioned at 1 kW unless the consumer asked for more, so this is the floor
 * rather than a guess at the middle.
 */
const DEFAULT_SANCTIONED_LOAD_KW = 1;

export type ConsumerCategory = "protected" | "unprotected";

/**
 * What the last bill actually came to, for display alongside the estimate.
 *
 * Grand total first: that is the figure the consumer paid, arrears and all. "Current
 * Bill" is the fallback because some bills print only that. Returns null rather than
 * zero when the portal omits the panel, so the UI can leave the row out entirely.
 */
export function lastBillTotal(breakdown: BillChargeLine[]): number | null {
  const find = (label: string) =>
    breakdown.find((line) => line.label.toLowerCase() === label.toLowerCase());

  const line = find("Grand Total") ?? find("Current Bill");
  return line ? line.amount : null;
}

export type BillEstimate = {
  units: number;
  low: number;
  high: number;
  category: ConsumerCategory;
  categoryLabel: string;
  /** The notification the rates came from, for the citation in the UI. */
  source: TariffSchedule["source"];
};

/**
 * Protected or unprotected, from the consumer's own billing history.
 *
 * NEPRA grants protected status to households that stay at or below 200 units for
 * six consecutive months, so a single month above the limit is disqualifying. With
 * no history at all we assume unprotected: it is both the common case and the
 * higher figure, so the estimate errs towards over-quoting rather than under.
 */
export function categoriseConsumer(history: BillHistoryEntry[]): ConsumerCategory {
  const months = history.filter((entry) => Number.isFinite(entry.units) && entry.units >= 0);
  if (months.length === 0) return "unprotected";

  return months.every((entry) => entry.units <= PROTECTED_LIMIT) ? "protected" : "unprotected";
}

/** The band `units` falls into. */
function slabFor(slabs: TariffSlab[], units: number): TariffSlab {
  return slabs.find((slab) => slab.to === null || units <= slab.to) ?? slabs[slabs.length - 1];
}

/** Units of `total` consumption that fall inside `slab`. */
function unitsInSlab(slab: TariffSlab, total: number): number {
  const width = slab.to === null ? Infinity : slab.to - slab.from + 1;
  return Math.min(Math.max(total - (slab.from - 1), 0), width);
}

/**
 * Energy charge for `units` under `category`.
 *
 * Progressive splits the consumption across bands and charges each at its own rate.
 * Flat does not split: the whole consumption is charged at the rate of the single
 * band it lands in, so 205 units are 205 units at the 201–300 rate — not 100 at one
 * rate plus 100 at another plus 5 at a third.
 */
export function chargeFor(category: TariffCategory, units: number): number {
  if (units <= 0) return 0;

  if (category.billing === "flat") {
    return units * slabFor(category.slabs, units).rate;
  }

  return category.slabs.reduce(
    (total, slab) => total + unitsInSlab(slab, units) * slab.rate,
    0,
  );
}

/** Widens a computed amount into the range the UI quotes. */
function toRange(amount: number): { low: number; high: number } {
  // Wider for larger bills, since the charges being absorbed scale with the bill,
  // but never so wide as to be useless nor so narrow as to imply false precision.
  const spread = Math.min(Math.max(amount * SPREAD_FRACTION, MIN_SPREAD), MAX_SPREAD);

  const low = Math.max(0, Math.round((amount - spread / 2) / ROUNDING) * ROUNDING);
  return { low, high: low + Math.round(spread / ROUNDING) * ROUNDING };
}

/**
 * Estimates what `units` will cost this consumer, as a range.
 * Returns null when there is nothing sensible to estimate.
 */
export function estimateBillForUnits(units: number, bill: UtilityBillData): BillEstimate | null {
  if (!Number.isFinite(units) || units <= 0) return null;

  const schedule = getSchedule(bill.providerCode);
  const detected = categoriseConsumer(bill.billHistory ?? []);

  // Protected rates only run to 200 units. A month past that has left protected
  // status behind regardless of what the history says, so it is billed unprotected.
  const categoryId: ConsumerCategory =
    detected === "protected" && units > PROTECTED_LIMIT ? "unprotected" : detected;

  const category = getCategory(schedule, categoryId);
  if (!category) return null;

  const load =
    Number.isFinite(bill.sanctionedLoad) && (bill.sanctionedLoad as number) > 0
      ? (bill.sanctionedLoad as number)
      : DEFAULT_SANCTIONED_LOAD_KW;

  const energyCharge = chargeFor(category, units);
  const fixedCharge = slabFor(category.slabs, units).fixedChargePerKw * load;
  const { low, high } = toRange((energyCharge + fixedCharge) * SURCHARGE_MULTIPLIER);

  return {
    units,
    low,
    high,
    category: categoryId,
    categoryLabel: category.label,
    source: schedule.source,
  };
}
