import { BillScreen } from "@/components/BillScreen";

/**
 * A bill has its own URL, so it can be linked, bookmarked and returned to. The
 * fetch itself still happens client-side against /api/bill — same request, same
 * error handling — which keeps the skeleton and the retry affordance on screen
 * rather than behind a server round trip.
 */
export default function BillPage({
  params,
}: {
  params: { provider: string; refno: string };
}) {
  return (
    <BillScreen
      providerCode={decodeURIComponent(params.provider)}
      referenceNo={decodeURIComponent(params.refno)}
    />
  );
}
