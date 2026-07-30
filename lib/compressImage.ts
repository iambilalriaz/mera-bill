"use client";

/**
 * Phone cameras routinely produce multi-megabyte photos, but Vercel Functions hard-cap
 * the request body at 4.5 MB — not configurable on any plan (see README) — so an
 * uncompressed photo gets rejected with a 413 before our own code even runs. Meter
 * digits read fine well below full camera resolution, so the photo is resized and
 * re-encoded here rather than asking the user to somehow take a smaller one.
 */
const MAX_DIMENSION = 1600;
const TARGET_BYTES = 3 * 1024 * 1024;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.15;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function asJpegName(name: string): string {
  const base = name.replace(/\.[^./]+$/, "");
  return `${base || "photo"}.jpg`;
}

/** Best-effort: falls back to the original file if the browser can't decode/compress it. */
export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the photo's EXIF orientation while decoding — without it,
    // portrait phone photos can come out sideways once redrawn onto the canvas.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);

  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await canvasToBlob(canvas, quality);
  }

  if (!blob) return file;

  return new File([blob], asJpegName(file.name), { type: "image/jpeg" });
}
