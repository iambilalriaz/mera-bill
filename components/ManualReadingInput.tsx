"use client";

import { useState } from "react";
import { Label, inputClass } from "./ui";

export function ManualReadingInput({
  onChange,
}: {
  /** null while the field is empty or not a usable number. */
  onChange: (reading: number | null) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div>
      <Label htmlFor="manualReading">Reading on your meter right now</Label>
      <input
        id="manualReading"
        type="number"
        inputMode="decimal"
        step="any"
        autoFocus
        placeholder="e.g. 34128"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);

          const parsed = Number(next);
          onChange(next.trim() !== "" && Number.isFinite(parsed) ? parsed : null);
        }}
        className={`${inputClass} py-4 font-mono text-xl tracking-wide placeholder:font-sans placeholder:text-base placeholder:tracking-normal`}
      />
      <p className="mt-2 text-xs text-ink-400">
        Type the digits exactly as they appear on the display.
      </p>
    </div>
  );
}
