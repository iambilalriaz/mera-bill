import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * The flash-lite line: cheap, fast, and enough for reading digits off a photo.
 *
 * The alias rather than a pinned version deliberately. `gemini-2.5-flash-lite` is
 * listed by the models endpoint on this account but returns
 * "404 … no longer available to new users" when called, and `gemini-2.0-flash`
 * before it has a free-tier quota of zero. An alias cannot rot that way. Pin to
 * `gemini-3.1-flash-lite` instead if reproducible behaviour matters more than
 * staying on the current model.
 */
const MODEL = "gemini-flash-lite-latest";

export const READING_PROMPT = `You are reading an electricity meter from a photograph.

The photo may be of EITHER of two kinds of meter. Work out which one it is first:

- "digital": an electronic meter with an LCD/LED display, usually 7-segment digits.
- "mechanical": an electromechanical meter with physical rotating digit wheels (a drum
  counter) seen through a small glass or plastic window.

Report ONLY the cumulative kWh reading shown by that display or those digit wheels.

For mechanical drum counters:
- Read the digits on the wheels themselves, left to right.
- There is often a row of small printed numbers beneath or beside the windows, such as
  "10000 1000 100 10 1" or "x1000 x100 x10 x1". These are place-value labels printed on
  the faceplate, NOT part of the reading. Never include them.
- Before reporting the number, look hard at the right-most wheel and decide which of these
  two cases you are in:
  (a) It is set apart from the others — a red or orange background, differently coloured
      digits, its own frame, or a visible gap. Then it is the tenths digit: report it after
      a decimal point, so wheels 4, 0, 7, 2 and a red 9 are 4072.9.
  (b) It looks exactly like every other wheel. Then there is no tenths digit and the
      reading is a whole number, so wheels 9, 8, 3, 1, 6 are 98316.
  Being enclosed in its own window is not on its own a distinguishing mark: on most drum
  counters every wheel has one.
- A wheel caught part-way through rotating shows two digits at once. Take the digit that
  has most fully arrived in the window, and set confidence to "medium".

For digital displays:
- Read only the digits on the lit segmented panel.
- Some displays print the final digit smaller, in a different colour, or inside a
  separate box. That digit is a decimal place: a display of "6876" with a smaller "36"
  is 6876.36, not 687636. A display with no such marking and no decimal point is a whole
  number, e.g. "464182" is 464182.
- Some meters cycle through several screens. Choose the screen showing the total consumed
  units in kWh. If several numbers are visible and you cannot tell which is the kWh
  total, set confidence to "low".

For both kinds:
- Report the reading exactly as displayed, including any decimal portion. Include leading
  zeros when describing what you saw, but return the value as a plain number, so a display
  of "0034128" is 34128.
- Ignore every other marking on the meter: serial numbers, barcodes, QR codes, model and
  manufacturer names, "Made in Pakistan" and similar text, warranty or inspection dates,
  phase and wire-type labels ("1 Phase 2 Wire"), accuracy class markings ("Class 1.0",
  "kWh", "Imp/kWh"), utility stickers and seals, and any handwriting, marker or pen marks
  on the meter body.
- If the reading is unreadable — blurred, angled past legibility, covered by glare,
  cropped out of frame, obstructed, or simply not in the image — set reading to null and
  say why in rawText.
- If you are unsure of any single digit, set confidence to "low" rather than guessing.

Respond with JSON only. No markdown, no code fences, no commentary. Match exactly this shape:
{"reading": <number or null>, "confidence": "high" | "medium" | "low", "rawText": "<the exact characters you read from the display or wheels, or a short note if unreadable>", "meterType": "digital" | "mechanical" | "unknown"}`;

export type MeterReadingExtraction = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  rawText: string;
  /** Which kind of meter the model believes it read. Informational only. */
  meterType: "digital" | "mechanical" | "unknown";
};

export class MeterVisionError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "MeterVisionError";
    this.status = status;
  }
}

/** Gemini often wraps JSON in ```json fences despite being asked not to. */
export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseExtractionResponse(rawResponse: string): MeterReadingExtraction {
  const cleaned = stripCodeFences(rawResponse);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (cause) {
    throw new MeterVisionError(
      "Could not understand the response from the reading service. Please enter the reading manually.",
      502,
      { cause },
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new MeterVisionError(
      "The reading service returned an unexpected response. Please enter the reading manually.",
      502,
    );
  }

  const { reading, confidence, rawText, meterType } = parsed as Record<string, unknown>;

  const numericReading =
    typeof reading === "number" && Number.isFinite(reading)
      ? reading
      : typeof reading === "string" && reading.trim() !== "" && Number.isFinite(Number(reading))
        ? Number(reading)
        : null;

  return {
    reading: numericReading,
    confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "low",
    rawText: typeof rawText === "string" ? rawText : "",
    // A model that skips the field, or invents a value for it, must not turn a
    // perfectly good reading into a failure — hence "unknown" rather than a throw.
    meterType:
      meterType === "digital" || meterType === "mechanical" ? meterType : "unknown",
  };
}

/**
 * Turns an SDK failure into something the user can act on. Quota and bad-key
 * failures look identical to "it broke" otherwise, and they need different fixes.
 */
function toMeterVisionError(cause: unknown): MeterVisionError {
  const status = typeof (cause as { status?: unknown })?.status === "number"
    ? (cause as { status: number }).status
    : undefined;

  if (status === 429) {
    return new MeterVisionError(
      "Photo reading has hit its usage limit on the Gemini API key. Wait a moment and try again, or enter the reading manually.",
      429,
      { cause },
    );
  }

  if (status === 401 || status === 403) {
    return new MeterVisionError(
      "Photo reading is not authorised — the Gemini API key looks invalid. Please enter the reading manually.",
      503,
      { cause },
    );
  }

  return new MeterVisionError(
    "Could not read the photo right now. Please try again or enter the reading manually.",
    502,
    { cause },
  );
}

export async function extractMeterReading(
  imageBase64: string,
  mimeType: string,
): Promise<MeterReadingExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new MeterVisionError(
      "Photo reading is not configured on this server (GEMINI_API_KEY is missing). Please enter the reading manually.",
      503,
    );
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  let responseText: string;
  try {
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      { text: READING_PROMPT },
    ]);
    responseText = result.response.text();
  } catch (cause) {
    console.error("[meterVision] Gemini request failed", cause);
    throw toMeterVisionError(cause);
  }

  return parseExtractionResponse(responseText);
}
