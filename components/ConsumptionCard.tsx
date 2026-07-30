"use client";

import { CalendarDays, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Consumption } from "@/lib/consumption";
import type { UtilityBillData } from "@/lib/providers/types";
import { Alert, Card } from "./ui";

/**
 * The headline result, and the only dark surface in the app. That contrast is the
 * hierarchy: everything else on the page is input or supporting detail, this is
 * the answer the user came for.
 */
export function ConsumptionCard({
  bill,
  currentReading,
  consumption,
}: {
  bill: UtilityBillData;
  currentReading: number;
  consumption: Consumption;
}) {
  const { unitsConsumed, daysElapsed, unitsPerDay, warning } = consumption;

  return (
    <Card tone="dark" className="animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
        Used since your last bill
      </p>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-[56px] font-bold leading-none tabular-nums tracking-tight">
          {unitsConsumed.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </span>
        <span className="text-lg font-medium text-ink-300">units</span>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <Stat
          icon={CalendarDays}
          label="Days elapsed"
          value={daysElapsed === null ? "N/A" : `${daysElapsed}`}
          hint={daysElapsed === null ? "Bill date unreadable" : undefined}
        />
        <Stat
          icon={TrendingUp}
          label="Average per day"
          value={
            unitsPerDay === null
              ? "N/A"
              : unitsPerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })
          }
          hint={unitsPerDay === null && daysElapsed === 0 ? "Reading taken today" : undefined}
        />
      </dl>

      {/* Labelled, because two bare numbers and a minus sign is a puzzle: nothing
          on screen says which reading is which, or why one is subtracted. */}
      <dl className="mt-5 flex items-end gap-4 border-t border-white/10 pt-4">
        <div>
          <dt className="text-[11px] text-ink-400">Your reading today</dt>
          <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-ink-100">
            {currentReading.toLocaleString()}
          </dd>
        </div>

        <span aria-hidden="true" className="pb-0.5 text-sm text-ink-500">
          &minus;
        </span>

        <div>
          <dt className="text-[11px] text-ink-400">On your last bill</dt>
          <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-ink-100">
            {bill.presentReading.toLocaleString()}
          </dd>
        </div>

        <span aria-hidden="true" className="pb-0.5 text-sm text-ink-500">
          =
        </span>

        <div>
          <dt className="text-[11px] text-ink-400">Used</dt>
          <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-brand-300">
            {unitsConsumed.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </dd>
        </div>
      </dl>

      {warning && (
        <div className="mt-4">
          <Alert tone="warning" title={warning.title}>
            {warning.detail}
          </Alert>
        </div>
      )}
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-inset ring-white/10">
      <dt className="flex items-center gap-1.5 text-xs text-ink-300">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums leading-none">{value}</dd>
      {hint && <p className="mt-1.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}
