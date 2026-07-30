"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateConsumption } from "@/lib/consumption";
import { fetchBillNative } from "@/lib/providers/pitcNative";
import { BillProviderError, type UtilityBillData } from "@/lib/providers/types";
import { rememberSearch } from "@/lib/searchHistory";
import { AppShell } from "./AppShell";
import { BillSummaryCard } from "./BillSummaryCard";
import { BillSummarySkeleton } from "./BillSummarySkeleton";
import { ConsumptionCard } from "./ConsumptionCard";
import { CurrentReadingCard, type ReadingMode } from "./CurrentReadingCard";
import { EstimatedBillCard } from "./EstimatedBillCard";
import { Alert, Button, Card } from "./ui";

export function BillScreen({
  providerCode,
  referenceNo,
}: {
  providerCode: string;
  referenceNo: string;
}) {
  const [bill, setBill] = useState<UtilityBillData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<ReadingMode>("photo");
  const [currentReading, setCurrentReading] = useState<number | null>(null);

  const fetchBill = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBill(null);
    setCurrentReading(null);

    // Recorded before the fetch, so a bill that fails to load is still one tap away
    // from being retried rather than retyped.
    rememberSearch({ providerCode, referenceNo });

    try {
      // Inside the native app, the portal is reachable directly from the device —
      // see lib/providers/pitcNative.ts for why that path exists and /api/bill
      // (server-side) does not work there. On the web, nothing changes.
      let fetched: UtilityBillData;
      if (Capacitor.isNativePlatform()) {
        fetched = await fetchBillNative(providerCode, referenceNo);
      } else {
        const response = await fetch("/api/bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerCode, referenceNo }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not fetch that bill.");
          return;
        }
        fetched = data as UtilityBillData;
      }

      setBill(fetched);
      // The consumer name only exists once the bill is back; fold it in so the
      // history entry stops being an anonymous number.
      rememberSearch({ providerCode, referenceNo, consumerName: fetched.consumerName });
    } catch (err) {
      setError(
        err instanceof BillProviderError
          ? err.message
          : "Could not reach the server. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [providerCode, referenceNo]);

  useEffect(() => {
    void fetchBill();
  }, [fetchBill]);

  // One source of truth for the numbers, shared by the consumption and cost cards.
  const consumption = useMemo(
    () =>
      bill && currentReading !== null
        ? calculateConsumption(bill.presentReading, currentReading, bill.readingDate)
        : null,
    [bill, currentReading],
  );

  function changeMode(next: ReadingMode) {
    setMode(next);
    // The two inputs are independent, so a fresh mode starts with no reading.
    setCurrentReading(null);
  }

  return (
    <AppShell
      title="Your bill"
      subtitle={loading ? "Fetching from the DISCO portal…" : undefined}
      back={{ href: "/", label: "All bills" }}
    >
      {loading && <BillSummarySkeleton />}

      {error && !loading && (
        <Card>
          <Alert tone="error" title="Could not load this bill">
            {error}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void fetchBill()}>
              Try again
            </Button>
          </div>
        </Card>
      )}

      {bill && (
        <>
          <BillSummaryCard bill={bill} />

          <CurrentReadingCard
            mode={mode}
            onModeChange={changeMode}
            onReadingChange={setCurrentReading}
            previousReading={bill.presentReading}
          />

          {currentReading !== null && consumption && (
            <ConsumptionCard
              bill={bill}
              currentReading={currentReading}
              consumption={consumption}
            />
          )}

          {consumption && consumption.unitsConsumed > 0 && (
            <EstimatedBillCard bill={bill} unitsConsumed={consumption.unitsConsumed} />
          )}
        </>
      )}
    </AppShell>
  );
}
