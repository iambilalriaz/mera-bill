import type { TariffSchedule } from "./types";

/**
 * A-1 General Supply Tariff — Residential, as notified by NEPRA on 11 Feb 2026
 * (TRF-100 XWDISCOS AND KE, Rationalization of Tariff).
 *
 * Transcribed by hand from the notification; the URL below is the authority, and
 * this file is only a copy of it. When NEPRA issues a revision, edit the rates here
 * and nothing else in the app needs to change.
 *
 * Rates are energy charges in Rs/kWh. Fixed charges are Rs per kW of sanctioned
 * load per month, and are levied on the band the consumption lands in. Neither
 * figure includes GST, electricity duty, the fuel price adjustment, TV fee or the
 * various surcharges — those are what the estimate's range is there to absorb.
 */
export const mepcoA1Residential: TariffSchedule = {
  id: "a1-residential",
  label: "A-1 General Supply — Residential",
  source: {
    label: "NEPRA notification, 11 Feb 2026",
    url: "https://nepra.org.pk/tariff/Tariff/Ex-WAPDA%20DISCOS/2026/TRF-100%20XWDISCOS%20AND%20KE%20RATIONALIZATION%20OF%20TARIFF%2011-02-2026%202935-57.pdf",
  },
  categories: [
    /**
     * Lifeline is transcribed for completeness but is not yet selected by
     * `categoriseConsumer` — qualifying for it depends on sustained low usage and
     * a sanctioned-load limit that the bill does not state. Very low usage is
     * therefore treated as Protected's first band, which over-states the bill
     * rather than under-stating it.
     */
    {
      id: "lifeline",
      label: "Lifeline",
      billing: "progressive",
      slabs: [
        { from: 1, to: 50, rate: 3.95, fixedChargePerKw: 0 },
        { from: 51, to: 100, rate: 7.74, fixedChargePerKw: 0 },
      ],
    },
    {
      id: "protected",
      label: "Protected",
      billing: "progressive",
      slabs: [
        { from: 1, to: 100, rate: 10.54, fixedChargePerKw: 200 },
        { from: 101, to: 200, rate: 13.01, fixedChargePerKw: 300 },
      ],
    },
    {
      id: "unprotected",
      label: "Unprotected",
      billing: "flat",
      slabs: [
        { from: 1, to: 100, rate: 22.44, fixedChargePerKw: 275 },
        { from: 101, to: 200, rate: 28.91, fixedChargePerKw: 300 },
        { from: 201, to: 300, rate: 33.1, fixedChargePerKw: 350 },
        { from: 301, to: 400, rate: 36.46, fixedChargePerKw: 400 },
        { from: 401, to: 500, rate: 38.95, fixedChargePerKw: 500 },
        { from: 501, to: 600, rate: 40.22, fixedChargePerKw: 675 },
        { from: 601, to: 700, rate: 41.85, fixedChargePerKw: 675 },
        { from: 701, to: null, rate: 47.2, fixedChargePerKw: 675 },
      ],
    },
  ],
};
