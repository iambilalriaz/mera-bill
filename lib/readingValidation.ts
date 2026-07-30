import { ABNORMAL_TOTAL_UNITS } from "./consumption";
import type { MeterType } from "./meterVision";

export type ReadingResolution = {
  /** The reading to use: the scanned value, or the more plausible alternative. */
  reading: number;
  adjusted: boolean;
  /** Set only when `adjusted` is true. */
  notice: string | null;
};

type Candidate = {
  reading: number;
  /** Plain-language reason, folded into the notice shown to the user. */
  reason: string;
};

/**
 * OCR on a meter photo can fail in ways that are specific to the kind of meter:
 *
 * - Mechanical (drum/dial) meters have a rightmost wheel that is sometimes wrongly
 *   folded into the whole-number reading instead of being recognised as a separate
 *   tenths digit or place-value label (see the READING_PROMPT heuristics in
 *   meterVision.ts) — that inflates the true reading by roughly 10x.
 * - Digital displays can have a decimal point missed or misread under blur, which
 *   shifts the true reading by a factor of 10 in either direction.
 *
 * Neither failure is detectable from the photo alone with certainty, but both are
 * detectable from their effect: they make the jump since the last bill implausible.
 * So rather than trust the scan or the meter type label blindly, candidates are
 * generated for the ways OCR could have gone wrong and scored against the previous
 * bill reading, keeping whichever produces a realistic (small, non-negative)
 * consumption difference.
 */
export function resolvePlausibleReading(
  scannedReading: number,
  meterType: MeterType,
  previousReading: number | null,
): ReadingResolution {
  if (previousReading === null || !Number.isFinite(previousReading)) {
    return { reading: scannedReading, adjusted: false, notice: null };
  }

  const scannedDiff = scannedReading - previousReading;

  // Only a jump that is too large is something these corrections can address — a
  // reading that is too low is far more likely to be a wrong meter or a stale bill,
  // which dropping a digit or shifting a decimal point cannot fix. That case is
  // already flagged separately by lib/consumption.ts.
  if (scannedDiff <= ABNORMAL_TOTAL_UNITS) {
    return { reading: scannedReading, adjusted: false, notice: null };
  }

  let best: (Candidate & { diff: number }) | null = null;
  for (const candidate of buildCandidates(scannedReading, meterType)) {
    const diff = candidate.reading - previousReading;
    if (diff < 0 || diff > ABNORMAL_TOTAL_UNITS) continue;
    if (best === null || diff < best.diff) best = { ...candidate, diff };
  }

  // Nothing plausible turned up — keep the scan as-is and let the existing warning
  // banner in ConsumptionCard flag it, rather than silently guessing.
  if (best === null) {
    return { reading: scannedReading, adjusted: false, notice: null };
  }

  return {
    reading: best.reading,
    adjusted: true,
    notice:
      `The scanned reading (${formatReading(scannedReading)}) would mean an unrealistic jump ` +
      `in usage since your last bill, so we used ${formatReading(best.reading)} instead — ` +
      `${best.reason}. Please check it against your meter.`,
  };
}

function buildCandidates(reading: number, meterType: MeterType): Candidate[] {
  const candidates: Candidate[] = [];

  if (meterType === "mechanical" || meterType === "unknown") {
    // Only meaningful on a whole-number reading: if a tenths digit was already
    // recognised, there is no spare whole digit to have been picked up by mistake.
    if (Number.isInteger(reading) && reading >= 10) {
      candidates.push({
        reading: Math.trunc(reading / 10),
        reason: "excluding the rightmost dial, which scans sometimes mistake for a digit",
      });
    }
  }

  if (meterType === "digital" || meterType === "unknown") {
    candidates.push({
      reading: reading / 10,
      reason: "with the decimal point shifted one place left",
    });
    candidates.push({
      reading: reading * 10,
      reason: "with the decimal point shifted one place right",
    });
  }

  return candidates;
}

function formatReading(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
