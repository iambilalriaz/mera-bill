import { mepcoA1Residential } from "./mepcoA1Residential";
import type { TariffCategory, TariffSchedule } from "./types";

export type { SlabBilling, TariffCategory, TariffSchedule, TariffSlab } from "./types";

/**
 * Which schedule applies to a bill.
 *
 * NEPRA notifies one set of rates for all ex-WAPDA DISCOs, so every provider maps
 * to the same residential schedule today. The indirection is the point: when a
 * DISCO or a category diverges, it becomes an entry in the map rather than a
 * conditional somewhere in the estimate.
 */
const SCHEDULES: Record<string, TariffSchedule> = {
  default: mepcoA1Residential,
};

export function getSchedule(providerCode?: string): TariffSchedule {
  return SCHEDULES[providerCode?.trim().toLowerCase() ?? ""] ?? SCHEDULES.default;
}

export function getCategory(schedule: TariffSchedule, id: string): TariffCategory | null {
  return schedule.categories.find((category) => category.id === id) ?? null;
}
