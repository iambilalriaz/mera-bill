import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

/**
 * The shared visual vocabulary. Every screen is built from these, which is what
 * stops one section drifting away from the rest: a card is only ever a `Card`, and
 * changing what a card looks like is a change here rather than in nine files.
 *
 * `tone`/`variant` props rather than className overrides, because two utilities of
 * the same specificity resolve by stylesheet order, not by intent.
 */

const CARD_TONES = {
  light: "border-white/70 bg-white shadow-card",
  /** The one dark surface, reserved for the headline result. */
  dark: "border-ink-900 bg-ink-950 text-white shadow-lift",
} as const;

export function Card({
  children,
  tone = "light",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof CARD_TONES;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${CARD_TONES[tone]} ${className}`}>
      {children}
    </section>
  );
}

/**
 * A card that navigates. Rendered as a button/anchor by the caller — this only
 * supplies the pressable surface treatment so every tappable card feels the same.
 */
export const interactiveCardClass =
  "block w-full rounded-3xl border border-white/70 bg-white p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:shadow-card focus-ring";

/**
 * Section heading. Takes either a numbered step or an icon: the numbers carry the
 * "do this next" sequence, and sections outside that sequence get an icon instead
 * so they do not look like a step the user has skipped.
 */
export function SectionHeader({
  title,
  subtitle,
  step,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  step?: number;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  const marker =
    step !== undefined ? (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
        {step}
      </span>
    ) : Icon ? (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    ) : null;

  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {marker}
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink-900">
            {title}
          </h2>
        </div>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none",
  secondary:
    "bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none",
  subtle:
    "bg-ink-100 text-ink-700 hover:bg-ink-200 active:bg-ink-300 disabled:bg-ink-100 disabled:text-ink-300",
} as const;

export function Button({
  children,
  variant = "primary",
  loading = false,
  icon: Icon,
  fullWidth = true,
  className = "",
  disabled,
  ...props
}: {
  variant?: keyof typeof BUTTON_VARIANTS;
  loading?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition duration-150 disabled:cursor-not-allowed focus-ring ${fullWidth ? "w-full" : "w-auto"} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

const BADGE_TONES = {
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
  neutral: "bg-ink-100 text-ink-600 ring-ink-500/15",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  caution: "bg-amber-50 text-amber-800 ring-amber-600/20",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const ALERT_STYLES = {
  error: "border-rose-200/80 bg-rose-50 text-rose-900",
  warning: "border-amber-200/80 bg-amber-50 text-amber-900",
  info: "border-brand-200/80 bg-brand-50 text-brand-900",
} as const;

export function Alert({
  tone,
  title,
  children,
}: {
  tone: keyof typeof ALERT_STYLES;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${ALERT_STYLES[tone]}`}
      role="alert"
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1 opacity-90" : ""}>{children}</div>
    </div>
  );
}

/** Label above value, the standard pairing for a read-only detail. */
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-1 truncate text-[15px] font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

export function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink-700">
      {children}
    </label>
  );
}

/** One input treatment, so the text field and the select cannot drift apart. */
export const inputClass =
  "w-full rounded-2xl border border-ink-200 bg-white px-4 py-3.5 text-[15px] text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";

/**
 * Loading placeholder shaped like the content it stands in for. A skeleton that
 * matches the eventual layout keeps the page from jumping when data lands.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-lg bg-ink-200/70 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden="true" />;
}
