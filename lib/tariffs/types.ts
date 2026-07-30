/**
 * Shared shape for a published tariff schedule.
 *
 * These are gazetted rates, not anything derived or inferred — a schedule is a
 * transcription of a NEPRA notification and changes only when a new one is issued.
 * Keeping the shape provider-agnostic means a second DISCO, or a non-residential
 * category, is a new file rather than a new code path.
 */

export type TariffSlab = {
  /** First unit in the band, 1-based. */
  from: number;
  /** Last unit in the band; null for the open-ended top band. */
  to: number | null;
  /** Energy charge, Rs per kWh. */
  rate: number;
  /** Fixed charge for this band, Rs per kW of sanctioned load per month. */
  fixedChargePerKw: number;
};

/**
 * How a category's energy charge is worked out.
 *
 * - `progressive`: each band charges only the units that fall inside it.
 * - `flat`: the whole consumption is charged at the rate of the single band it
 *   lands in. This is what makes crossing a band edge expensive — every unit is
 *   re-priced, not just the new one.
 */
export type SlabBilling = "progressive" | "flat";

export type TariffCategory = {
  id: string;
  label: string;
  billing: SlabBilling;
  slabs: TariffSlab[];
};

export type TariffSchedule = {
  id: string;
  label: string;
  /** The notification these rates are transcribed from. Shown in the UI. */
  source: { label: string; url: string };
  categories: TariffCategory[];
};
