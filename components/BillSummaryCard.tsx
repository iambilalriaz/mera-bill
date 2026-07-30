"use client";

import { CheckCircle2, Gauge, Hash, Zap } from "lucide-react";
import { formatBillDate } from "@/lib/billDate";
import { lastBillTotal } from "@/lib/billEstimate";
import type { UtilityBillData } from "@/lib/providers/types";
import { Badge, Card, Field } from "./ui";

const rupees = (value: number) => `Rs ${Math.round(value).toLocaleString()}`;

export function BillSummaryCard({ bill }: { bill: UtilityBillData }) {
  const total = lastBillTotal(bill.chargesBreakdown);

  return (
    <Card className="animate-fade-up">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="positive">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Bill found
          </Badge>
          <h2 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-ink-900">
            {bill.consumerName}
          </h2>
        </div>
      </div>

      {/* The amount is what someone opening a bill looks for first, so it gets the
          only tinted panel on the card rather than a row in the grid below. */}
      {total !== null && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-brand-50/70 px-4 py-3.5 ring-1 ring-inset ring-brand-600/10">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand-700/80">
              Last bill amount
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-brand-900">
              {rupees(total)}
            </p>
          </div>
          {bill.dueDate && (
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-brand-700/80">
                Due
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-900">
                {formatBillDate(bill.dueDate)}
              </p>
            </div>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field
          label="Meter no"
          value={<span className="font-mono text-sm">{bill.meterNo}</span>}
        />
        <Field label="Reading date" value={formatBillDate(bill.readingDate)} />
        <Field
          label="Present reading"
          value={<span className="font-mono text-sm">{bill.presentReading.toLocaleString()}</span>}
        />
        <Field label="Billed units" value={`${bill.billedUnits.toLocaleString()} kWh`} />
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-4 text-xs text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono">{bill.referenceNo}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 uppercase tracking-wide">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          {bill.providerCode}
        </span>
        {bill.sanctionedLoad !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            {bill.sanctionedLoad} kW load
          </span>
        )}
      </div>
    </Card>
  );
}
