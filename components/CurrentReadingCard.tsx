"use client";

import { Card, SectionHeader } from "./ui";
import { ManualReadingInput } from "./ManualReadingInput";
import { PhotoReadingInput } from "./PhotoReadingInput";

export type ReadingMode = "photo" | "manual";

type Props = {
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  onReadingChange: (reading: number | null) => void;
};

export function CurrentReadingCard({ mode, onModeChange, onReadingChange }: Props) {
  return (
    <Card className="animate-fade-up">
      <SectionHeader step={2} title="Your meter reading today" />

      {/* A sliding indicator rather than two independently styled buttons: the
          selected state is then one thing that moves, not two that can disagree. */}
      <div
        role="tablist"
        aria-label="How to enter your reading"
        className="relative mb-5 grid grid-cols-2 rounded-2xl bg-ink-100 p-1"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-sm transition-transform duration-200 ease-out ${
            mode === "photo" ? "translate-x-1" : "translate-x-[calc(100%+0.25rem)]"
          }`}
        />
        <ModeButton active={mode === "photo"} onClick={() => onModeChange("photo")}>
          Photo
        </ModeButton>
        <ModeButton active={mode === "manual"} onClick={() => onModeChange("manual")}>
          Type it in
        </ModeButton>
      </div>

      {mode === "photo" ? (
        <PhotoReadingInput
          key="photo"
          onConfirm={onReadingChange}
          onClear={() => onReadingChange(null)}
          onSwitchToManual={() => onModeChange("manual")}
        />
      ) : (
        <ManualReadingInput key="manual" onChange={onReadingChange} />
      )}
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={`relative z-10 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-ring ${
        active ? "text-ink-900" : "text-ink-500 hover:text-ink-700"
      }`}
    >
      {children}
    </button>
  );
}
