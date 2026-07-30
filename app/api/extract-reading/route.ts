import { NextResponse } from "next/server";
import { MeterVisionError, extractMeterReading } from "@/lib/meterVision";

export const runtime = "nodejs";

// Vercel Functions hard-cap the request body at 4.5 MB on every plan — not
// configurable — and reject anything over that before this code ever runs. The
// client compresses photos before upload (see lib/compressImage.ts) specifically to
// stay under that, so this only exists as a backstop with headroom for multipart
// overhead; it should rarely fire.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data request containing an image." },
      { status: 400 },
    );
  }

  const image = form.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json(
      { error: "No photo was received. Please choose or take a photo of your meter." },
      { status: 400 },
    );
  }

  if (!image.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "That file is not an image. Please upload a photo of your meter." },
      { status: 400 },
    );
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Please use an image under 4 MB." },
      { status: 413 },
    );
  }

  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const extraction = await extractMeterReading(base64, image.type);

    if (extraction.reading === null) {
      return NextResponse.json(
        {
          error:
            "The meter display could not be read from that photo. Try again with the display filling more of the frame and no glare, or switch to manual entry.",
          suggestManualEntry: true,
          rawText: extraction.rawText,
        },
        { status: 422 },
      );
    }

    // A low-confidence reading is still returned: the user can correct it in place,
    // which beats blocking them behind an error.
    return NextResponse.json({
      ...extraction,
      ...(extraction.confidence === "low"
        ? {
            notice:
              "This reading is a low-confidence guess. Please check it against your meter before continuing.",
            suggestManualEntry: true,
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof MeterVisionError) {
      return NextResponse.json(
        { error: error.message, suggestManualEntry: true },
        { status: error.status },
      );
    }

    console.error("[api/extract-reading] unexpected error", error);
    return NextResponse.json(
      {
        error: "Something went wrong while reading the photo. Please enter the reading manually.",
        suggestManualEntry: true,
      },
      { status: 500 },
    );
  }
}
