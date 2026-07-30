import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/registry";
import { BillProviderError, type BillErrorKind } from "@/lib/providers/types";

export const runtime = "nodejs";

const STATUS_BY_KIND: Record<BillErrorKind, number> = {
  invalid_input: 400,
  unknown_provider: 400,
  not_found: 404,
  network: 502,
  parse: 502,
};

type BillRequestBody = {
  providerCode?: unknown;
  referenceNo?: unknown;
};

export async function POST(request: Request) {
  let body: BillRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", kind: "invalid_input" },
      { status: 400 },
    );
  }

  const providerCode = typeof body.providerCode === "string" ? body.providerCode.trim() : "";
  const referenceNo = typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";

  if (!providerCode || !referenceNo) {
    return NextResponse.json(
      {
        error: "Please choose an electricity provider and enter your reference number.",
        kind: "invalid_input",
      },
      { status: 400 },
    );
  }

  try {
    const provider = getProvider(providerCode);
    const bill = await provider.fetchBill(referenceNo);
    return NextResponse.json(bill);
  } catch (error) {
    if (error instanceof BillProviderError) {
      // Selector drift is worth a server-side breadcrumb; the user just sees the message.
      if (error.kind === "parse") {
        console.error("[api/bill] parse failure", {
          providerCode,
          missingFields: error.missingFields,
        });
      }

      return NextResponse.json(
        {
          error: error.message,
          kind: error.kind,
          ...(error.missingFields ? { missingFields: error.missingFields } : {}),
        },
        { status: STATUS_BY_KIND[error.kind] },
      );
    }

    console.error("[api/bill] unexpected error", error);
    return NextResponse.json(
      { error: "Something went wrong while fetching your bill. Please try again.", kind: "unknown" },
      { status: 500 },
    );
  }
}
