"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Keyboard } from "lucide-react";
import { compressImage } from "@/lib/compressImage";
import { Alert, Badge, Button, Label, Skeleton, inputClass } from "./ui";

type Extraction = {
  confidence: "high" | "medium" | "low";
  rawText: string;
  notice?: string;
  /** Which kind of meter was recognised. Shown as a label; nothing depends on it. */
  meterType?: "digital" | "mechanical" | "unknown";
};

const METER_TYPE_LABEL: Record<string, string> = {
  digital: "digital display",
  mechanical: "dial meter",
};

const CONFIDENCE_TONE = {
  high: "positive",
  medium: "caution",
  low: "caution",
} as const;

type Props = {
  /** Fires when the user accepts a reading (extracted or hand-corrected). */
  onConfirm: (reading: number) => void;
  /** Fires when a new photo is picked, so any previous result is dropped. */
  onClear: () => void;
  onSwitchToManual: () => void;
};

export function PhotoReadingInput({ onConfirm, onClear, onSwitchToManual }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  // Object URLs have to be released by hand or the blob stays in memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File) {
    // One request per user action. The visible button is disabled while a request is
    // out, but the file input behind it is only visually hidden — it stays focusable
    // and operable by keyboard and assistive tech, so it can start a second request
    // over the top of the first. The free tier allows ten calls a minute, so a
    // duplicate is not free.
    if (inFlight.current) return;
    inFlight.current = true;

    onClear();
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setExtraction(null);
    setDraft("");
    setConfirmed(false);
    setError(null);
    setShowManualHint(false);
    setExtracting(true);

    try {
      // Uncompressed phone photos routinely exceed Vercel's 4.5 MB request-body limit,
      // which rejects the request before our own code runs — see compressImage.ts.
      const compressed = await compressImage(file);
      const body = new FormData();
      body.append("image", compressed);

      const response = await fetch("/api/extract-reading", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not read that photo.");
        setShowManualHint(Boolean(data.suggestManualEntry));
        return;
      }

      setExtraction({
        confidence: data.confidence,
        rawText: data.rawText ?? "",
        notice: data.notice,
        meterType: data.meterType,
      });
      setDraft(String(data.reading));
      setShowManualHint(Boolean(data.suggestManualEntry));
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
      setShowManualHint(true);
    } finally {
      inFlight.current = false;
      setExtracting(false);
    }
  }

  // Shared by both inputs below: the browser/OS's own choice of camera vs. gallery
  // when a file input has no `capture` attribute is inconsistent across devices —
  // some show a chooser with both, some (notably the Android Photo Picker) jump
  // straight to the gallery with no camera option at all. Two dedicated inputs make
  // the choice explicit and deterministic instead of depending on that behaviour.
  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    // Allow re-picking the same file.
    event.target.value = "";
  }

  function handleConfirm() {
    const value = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(value)) {
      setError("Please enter the number shown on your meter.");
      return;
    }
    setError(null);
    setConfirmed(true);
    onConfirm(value);
  }

  return (
    <div className="space-y-4">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={extracting}
        className="sr-only"
        onChange={onFilePicked}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        disabled={extracting}
        className="sr-only"
        onChange={onFilePicked}
      />

      <p className="text-sm text-ink-500">Point at the meter&rsquo;s display or dials</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={extracting}
          className="group rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-6 text-center transition duration-200 hover:border-brand-400 hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
        >
          <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-ink-900/5 transition group-hover:scale-105">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="block text-sm font-semibold text-ink-900">
            {previewUrl ? "Retake photo" : "Take a photo"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={extracting}
          className="group rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-6 text-center transition duration-200 hover:border-brand-400 hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
        >
          <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-ink-900/5 transition group-hover:scale-105">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="block text-sm font-semibold text-ink-900">Choose from gallery</span>
        </button>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, no optimisation possible
        <img
          src={previewUrl}
          alt="Photo of your meter"
          className="max-h-60 w-full rounded-2xl border border-ink-200 bg-ink-50 object-contain"
        />
      )}

      {extracting && (
        <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-inset ring-ink-900/5">
          <p className="mb-3 text-sm font-medium text-ink-600">Reading the meter…</p>
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-3 h-11 w-full rounded-xl" />
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {extraction?.notice && <Alert tone="warning">{extraction.notice}</Alert>}

      {extraction && (
        <div className="animate-fade-up">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="extractedReading">Reading from the photo</Label>
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={CONFIDENCE_TONE[extraction.confidence]}>
                {extraction.confidence} confidence
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              id="extractedReading"
              type="number"
              inputMode="decimal"
              step="any"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (confirmed) {
                  // Already confirmed once: keep the result in sync as they correct it.
                  const value = Number(event.target.value);
                  if (event.target.value.trim() !== "" && Number.isFinite(value)) {
                    onConfirm(value);
                  } else {
                    onClear();
                  }
                }
              }}
              className={`${inputClass} min-w-0 flex-1 py-4 font-mono text-xl tracking-wide`}
            />
            {!confirmed && (
              <Button
                type="button"
                onClick={handleConfirm}
                icon={Check}
                fullWidth={false}
                className="shrink-0"
              >
                Use
              </Button>
            )}
          </div>

          {extraction.rawText && (
            <p className="mt-2 text-xs text-ink-400">
              Read as <span className="font-mono text-ink-500">{extraction.rawText}</span>
              {extraction.meterType && METER_TYPE_LABEL[extraction.meterType] && (
                <> &middot; {METER_TYPE_LABEL[extraction.meterType]}</>
              )}
              {" — edit above if wrong"}
            </p>
          )}
        </div>
      )}

      {showManualHint && (
        <Button variant="subtle" icon={Keyboard} onClick={onSwitchToManual}>
          Enter the reading manually instead
        </Button>
      )}
    </div>
  );
}
