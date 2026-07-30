"use client";

import Link from "next/link";
import { ChevronRight, Clock, X } from "lucide-react";
import type { ProviderOption } from "@/lib/providers/catalog";
import { billHref } from "@/lib/routes";
import type { SearchHistoryEntry } from "@/lib/searchHistory";
import { Badge, SectionHeader, interactiveCardClass } from "./ui";

/**
 * Previously looked-up bills, one card each.
 *
 * Cards rather than rows because each entry is a destination, not a list item: the
 * consumer name is the thing being recognised, and it needs room to be read at a
 * glance on a phone.
 */
export function RecentSearches({
  entries,
  providerOptions,
  onForget,
}: {
  entries: SearchHistoryEntry[];
  providerOptions: ProviderOption[];
  onForget: (entry: SearchHistoryEntry) => void;
}) {
  if (entries.length === 0) return null;

  const labelFor = (code: string) =>
    providerOptions.find((option) => option.code === code)?.label ?? code.toUpperCase();

  // Not a Card: these are cards *in* a section, and wrapping cards in a card gives
  // the page two competing surfaces at the same elevation.
  return (
    <section className="pt-1">
      <SectionHeader icon={Clock} title="Recent searches" subtitle="Tap one to look it up again." />

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={`${entry.providerCode}:${entry.referenceNo}`} className="relative">
            <Link
              href={billHref(entry.providerCode, entry.referenceNo)}
              className={`${interactiveCardClass} group pr-12`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-snug text-ink-900">
                    {entry.consumerName || `${labelFor(entry.providerCode)} bill`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{labelFor(entry.providerCode)}</Badge>
                    <span className="font-mono text-xs text-ink-400">{entry.referenceNo}</span>
                  </div>
                </div>
                <ChevronRight
                  className="mt-0.5 h-5 w-5 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                  aria-hidden="true"
                />
              </div>
            </Link>

            {/* Outside the Link: a button inside an anchor is invalid, and this
                action must not navigate. */}
            <button
              type="button"
              onClick={() => onForget(entry)}
              aria-label={`Remove ${entry.referenceNo} from recent searches`}
              className="absolute right-2 top-2 rounded-full p-1.5 text-ink-300 transition hover:bg-ink-100 hover:text-ink-700 focus-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
