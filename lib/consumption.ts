import { daysElapsedSince, parseBillDate } from "./billDate";

/** Above these, a reading is far more likely to be a bad photo than real usage. */
const ABNORMAL_TOTAL_UNITS = 3000;
const ABNORMAL_UNITS_PER_DAY = 150;

export type ConsumptionWarning = {
  title: string;
  detail: string;
};

export type Consumption = {
  unitsConsumed: number;
  /** null when the bill's reading date could not be parsed. */
  daysElapsed: number | null;
  /** null when days elapsed is unknown or zero (same-day reading). */
  unitsPerDay: number | null;
  /** Non-blocking: the numbers are still shown, this just flags them as suspect. */
  warning: ConsumptionWarning | null;
};

export function calculateConsumption(
  billPresentReading: number,
  currentReading: number,
  billReadingDate: string,
  now: Date = new Date(),
): Consumption {
  const unitsConsumed = currentReading - billPresentReading;
  const daysElapsed = daysElapsedSince(parseBillDate(billReadingDate), now);

  const unitsPerDay =
    daysElapsed !== null && daysElapsed > 0 ? unitsConsumed / daysElapsed : null;

  return {
    unitsConsumed,
    daysElapsed,
    unitsPerDay,
    warning: findWarning(unitsConsumed, unitsPerDay),
  };
}

function findWarning(
  unitsConsumed: number,
  unitsPerDay: number | null,
): ConsumptionWarning | null {
  if (unitsConsumed < 0) {
    return {
      title: "Your reading is lower than the one on the bill",
      detail:
        "A meter reading only goes up, so this usually means a digit was misread from the photo, or the reference number belongs to a different meter. Check the number and try again.",
    };
  }

  if (unitsConsumed > ABNORMAL_TOTAL_UNITS) {
    return {
      title: "That is an unusually large number of units",
      detail:
        "This often happens when an extra digit is picked up from the meter display. Compare the reading below with your meter before relying on it.",
    };
  }

  if (unitsPerDay !== null && unitsPerDay > ABNORMAL_UNITS_PER_DAY) {
    return {
      title: "Daily usage looks unusually high",
      detail: `About ${Math.round(unitsPerDay)} units a day is far above a typical household. Double-check the reading you entered.`,
    };
  }

  return null;
}
