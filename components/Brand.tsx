import { Zap } from "lucide-react";

/**
 * The wordmark.
 *
 * "Mera" sits in ink and "Bill" in brand teal, so the name carries the palette
 * rather than needing a separate logo — and the accent lands on the half that says
 * what the app is for. The bolt tile gives it a mark small enough to work as a
 * favicon or an app icon later.
 */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-900 text-brand-300 shadow-card">
        <Zap className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
      </span>
      <span className="text-[26px] font-bold leading-none tracking-tight text-ink-900 sm:text-[28px]">
        Mera<span className="text-brand-600">Bill</span>
      </span>
    </span>
  );
}
