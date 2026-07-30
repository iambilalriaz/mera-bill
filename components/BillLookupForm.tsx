"use client";

import { useState } from "react";
import { Search, Zap } from "lucide-react";
import type { ProviderOption } from "@/lib/providers/catalog";
import { Button, Card, Label, SectionHeader, inputClass } from "./ui";

/**
 * The lookup form. It no longer fetches anything — it navigates to the bill's own
 * URL and lets that route do the work, so a bill is linkable and the back button
 * has somewhere to go back to.
 */
export function BillLookupForm({
  providerOptions,
  onSubmit,
}: {
  providerOptions: ProviderOption[];
  onSubmit: (lookup: { providerCode: string; referenceNo: string }) => void;
}) {
  const [providerCode, setProviderCode] = useState(
    () => providerOptions.find((option) => option.enabled)?.code ?? "",
  );
  const [referenceNo, setReferenceNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ready = referenceNo.trim() !== "" && providerCode !== "";

  return (
    <Card>
      <SectionHeader step={1} title="Find your last bill" />

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          // Stays true until the route changes, so the button cannot be pressed twice.
          setSubmitting(true);
          onSubmit({ providerCode, referenceNo: referenceNo.trim() });
        }}
      >
        <div>
          <Label htmlFor="provider">Electricity company</Label>
          <div className="relative">
            <Zap
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <select
              id="provider"
              value={providerCode}
              onChange={(event) => setProviderCode(event.target.value)}
              className={`${inputClass} appearance-none pl-11`}
            >
              {providerOptions.map((option) => (
                <option key={option.code} value={option.code} disabled={!option.enabled}>
                  {option.label} — {option.region}
                  {option.enabled ? "" : " (coming soon)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="referenceNo">Reference number</Label>
          <input
            id="referenceNo"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="14-digit number on your bill"
            value={referenceNo}
            onChange={(event) => setReferenceNo(event.target.value)}
            className={`${inputClass} font-mono tracking-wide placeholder:font-sans placeholder:tracking-normal`}
          />
        </div>

        <Button type="submit" icon={Search} disabled={!ready} loading={submitting}>
          {submitting ? "Opening bill…" : "Fetch bill"}
        </Button>
      </form>
    </Card>
  );
}
