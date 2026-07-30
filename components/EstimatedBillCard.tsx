"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Receipt, Sparkles } from "lucide-react";
import { estimateBillForUnits } from "@/lib/billEstimate";
import type { UtilityBillData } from "@/lib/providers/types";
import { getSchedule } from "@/lib/tariffs";
import { Badge, Button, Card, SectionHeader } from "./ui";

const rupees = (value: number) => `Rs ${Math.round(value).toLocaleString()}`;

/**
 * Worked out from the notified NEPRA rates and the bill already on screen, so there
 * is nothing to fetch. The button exists because an estimate is something you ask
 * for — not something that should appear unbidden beside a reading the user is
 * still checking.
 */
export function EstimatedBillCard({
  bill,
  unitsConsumed,
}: {
  bill: UtilityBillData;
  unitsConsumed: number;
}) {
  const [shown, setShown] = useState(false);

  // A stale figure is worse than none: if the reading changes, the range on screen
  // is no longer about the units on screen.
  useEffect(() => setShown(false), [unitsConsumed, bill.referenceNo]);

  const estimate = shown ? estimateBillForUnits(unitsConsumed, bill) : null;
  const source = getSchedule(bill.providerCode).source;

  return (
    <Card className="animate-fade-up">
      <SectionHeader
        step={3}
        title="Estimated bill"
        subtitle={`What your ${unitsConsumed.toLocaleString()} units are likely to cost.`}
      />

      {estimate ? (
        <div className="animate-fade-up">
          <div className="rounded-2xl bg-ink-50 px-4 py-4 ring-1 ring-inset ring-ink-900/5">
            <p className="text-[28px] font-bold leading-tight tabular-nums tracking-tight text-ink-900 sm:text-[32px]">
              {rupees(estimate.low)}
              <span className="mx-1.5 font-medium text-ink-300">–</span>
              {rupees(estimate.high)}
            </p>
            <div className="mt-3">
              <Badge tone="brand">{estimate.categoryLabel} tariff</Badge>
            </div>
          </div>

          <p className="mt-3.5 text-sm leading-relaxed text-ink-500">
            Based on official {estimate.categoryLabel.toLowerCase()} rates plus estimated
            taxes and surcharges — not a guaranteed amount.
          </p>
        </div>
      ) : (
        <Button icon={Sparkles} onClick={() => setShown(true)}>
          Get estimated bill
        </Button>
      )}

      <p className="mt-5 flex items-center gap-1.5 border-t border-ink-100 pt-4 text-xs text-ink-400">
        <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Source:
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded font-medium text-ink-500 underline underline-offset-2 transition hover:text-brand-700 focus-ring"
        >
          {source.label}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    </Card>
  );
}
