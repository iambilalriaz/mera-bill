"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProviderOption } from "@/lib/providers/catalog";
import { billHref } from "@/lib/routes";
import { forgetSearch, readSearchHistory, type SearchHistoryEntry } from "@/lib/searchHistory";
import { AppShell } from "./AppShell";
import { BillLookupForm } from "./BillLookupForm";
import { Brand } from "./Brand";
import { RecentSearches } from "./RecentSearches";

export function HomeScreen({ providerOptions }: { providerOptions: ProviderOption[] }) {
  const router = useRouter();
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  // localStorage is not readable during the server render, so the list arrives on
  // mount rather than in the initial HTML. Reading it in useState would make the
  // two renders disagree.
  useEffect(() => setHistory(readSearchHistory()), []);

  return (
    <AppShell
      title={<Brand />}
      subtitle="Fetch your bill, read your meter, and see what your next bill will cost."
    >
      <BillLookupForm
        providerOptions={providerOptions}
        onSubmit={(lookup) => router.push(billHref(lookup.providerCode, lookup.referenceNo))}
      />

      <RecentSearches
        entries={history}
        providerOptions={providerOptions}
        onForget={(entry) => setHistory(forgetSearch(entry))}
      />
    </AppShell>
  );
}
