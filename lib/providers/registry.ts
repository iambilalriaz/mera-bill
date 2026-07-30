import { fescoProvider } from "./fesco";
import { lescoProvider } from "./lesco";
import { mepcoProvider } from "./mepco";
import { BillProviderError, type BillProvider } from "./types";

/**
 * Every implemented DISCO adapter.
 *
 * Adding a new distribution company is: create `lib/providers/<code>.ts` exporting a
 * `BillProvider`, then add one line here. Nothing else in the app needs to change.
 */
const providers: Record<string, BillProvider> = {
  [mepcoProvider.code]: mepcoProvider,
  [lescoProvider.code]: lescoProvider,
  [fescoProvider.code]: fescoProvider,
};

export function getProvider(providerCode: string): BillProvider {
  const provider = providers[providerCode?.trim().toLowerCase()];

  if (!provider) {
    throw new BillProviderError(
      "unknown_provider",
      `"${providerCode}" is not supported yet. Currently available: ${listProviders()
        .map((p) => p.label)
        .join(", ")}.`,
    );
  }

  return provider;
}

export function isProviderSupported(providerCode: string): boolean {
  return Boolean(providers[providerCode?.trim().toLowerCase()]);
}

export function listProviders(): BillProvider[] {
  return Object.values(providers);
}
