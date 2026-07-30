/** Where a bill lives. One place builds it, so links and the router cannot disagree. */
export function billHref(providerCode: string, referenceNo: string): string {
  return `/bill/${encodeURIComponent(providerCode)}/${encodeURIComponent(referenceNo)}`;
}
