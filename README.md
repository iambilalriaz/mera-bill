# Mera Bill

Fetch your electricity bill, read your meter from a photo, and see how many units you
have used since your last bill — plus an estimate of what the next one will cost.

Built for Pakistani distribution companies (DISCOs). MEPCO, LESCO and FESCO are
implemented; the remaining DISCOs are listed but disabled. No code outside
`lib/providers/` is aware of which providers exist.

## Running locally

```bash
npm install
```

Copy the environment template and add a Gemini API key (from
<https://aistudio.google.com/apikey>):

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Then open <http://localhost:3000>. The app is mobile-first — use your browser's
device toolbar, or open it on your phone, since the photo step uses the camera.

Other scripts:

```bash
npm run build && npm start
```

```bash
npm run typecheck
```

Photo reading is optional: without `GEMINI_API_KEY` the app still works, it just
tells the user to type the reading in instead.

## Deploying

The PITC bill portal is hosted in Pakistan and is slow — sometimes unreachable — from
servers outside the region. Vercel defaults to `iad1` (Washington, D.C.), from which
every lookup failed on a TCP connect timeout while the identical request succeeded from
a local machine. `vercel.json` therefore pins functions to `bom1` (Mumbai), the closest
region to Pakistan, and `lib/providers/pitc.ts` raises the connect timeout above Node's
10s default and retries a failed lookup once.

If the portal blocks the deployment region outright rather than merely being slow to
reach, set `BILL_PORTAL_PROXY_URL` to a proxy that egresses from Pakistan; the provider
routes portal traffic through it with no other change.

## How it fits together

| Path | Role |
| --- | --- |
| `lib/providers/types.ts` | `BillProvider` / `UtilityBillData` contracts, `BillProviderError` |
| `lib/providers/pitc.ts` | The shared PITC portal flow: session postback, selectors, parsing |
| `lib/providers/{mepco,lesco,fesco}.ts` | One line each — a code and a label |
| `lib/providers/registry.ts` | `getProvider(code)` factory — the only file that knows which adapters exist |
| `lib/providers/catalog.ts` | DISCO list for the dropdown; `enabled` is derived from the registry |
| `lib/billDate.ts` | Parses the `"30 JUN 26"` bill date format; returns `null` rather than throwing |
| `lib/consumption.ts` | Units consumed, days elapsed, units/day, and the "this looks wrong" warnings |
| `lib/meterVision.ts` | Gemini call + strict JSON parsing of the meter reading |
| `lib/billEstimate.ts` | Category detection, energy + fixed charges, and the quoted range |
| `lib/tariffs/mepcoA1Residential.ts` | The NEPRA rates, transcribed. Edit here when the tariff is revised |
| `lib/tariffs/index.ts` | `getSchedule(providerCode)` — which schedule applies to a bill |
| `lib/searchHistory.ts` | Recently looked-up bills, in localStorage. Defensive on every read |
| `app/api/bill` | `POST { providerCode, referenceNo }` → `UtilityBillData` |
| `app/api/extract-reading` | `POST multipart/form-data` with `image` → `{ reading, confidence, rawText, meterType }` |

`app/page.tsx` is a server component so the provider list comes from the registry
without pulling the server-only parsing code (cheerio) into the client bundle. The
estimate needs no server call at all: the rates are public and the arithmetic is
small, so pressing "Get estimated bill" is instant.

## Adding another DISCO

If it is on the PITC portal (`bill.pitc.com.pk/<code>bill`), it is two lines:

```ts
// lib/providers/gepco.ts
import { createPitcProvider } from "./pitc";
export const gepcoProvider = createPitcProvider({ code: "gepco", label: "GEPCO" });
```

then register it in `lib/providers/registry.ts`. The dropdown entry switches from
"coming soon" to selectable on its own — the catalog reads `enabled` from the registry.

A DISCO on its own portal instead implements `BillProvider` (`code`, `label`,
`fetchBill`) directly; the registry does not care which route a provider took.

## How the PITC portal fetch works

`GET /<code>bill/general?refno=X` does **not** work on its own — it 302s back to the
search page. The bill is only served to a session that has submitted the search form.
So `lib/providers/pitc.ts`:

1. `GET /<code>bill` — collects the `ASP.NET_SessionId` and `__RequestVerificationToken`
   cookies plus the WebForms hidden fields (`__VIEWSTATE`, `__EVENTVALIDATION`, …).
2. `POST /<code>bill` — replays those fields with `searchTextBox=<referenceNo>`.
3. Follows the redirect to `/general?refno=…` carrying the cookies, and parses that.

Dropping any hidden field makes the portal silently return the search page again,
which surfaces as "no bill found" rather than an error — worth knowing when debugging.

## How the cost estimate works

Rates come from the NEPRA notification of 11 Feb 2026 (A-1 General Supply —
Residential), transcribed into `lib/tariffs/mepcoA1Residential.ts`. That file is a
copy of the gazette and nothing else: when NEPRA revises the tariff, edit the rates
there and no other code changes. `lib/tariffs/index.ts` maps a provider to a
schedule, so a DISCO or category that diverges becomes a new file rather than a
conditional in the estimate.

Three things decide the answer:

- **Category.** Protected households pay roughly half what unprotected ones pay for
  the same units, and nothing on the bill states which you are — it is read off the
  consumption history. Every available month at or below 200 units means protected;
  one month above it does not. With no history we assume unprotected, which is both
  the common case and the higher figure.
- **Energy charge**, worked out differently per category. Protected is
  **progressive**: units in 1–100 at that band's rate, units in 101–200 at that
  band's. Unprotected is **flat**: the whole consumption is charged at the rate of
  the single band it lands in, so 205 units are 205 units at the 201–300 rate, and
  crossing a band edge re-prices every unit rather than just the new one.
- **Fixed charge**, the landed band's Rs/kW figure times the sanctioned load parsed
  from the bill's `SAN LOAD` field. Absent that field, 1 kW is assumed.

What the notification cannot tell us is GST, electricity duty, the fuel price
adjustment, TV fee and the surcharges — none are calculable without live data, and
together they are worth about 30% of the bill. `SURCHARGE_MULTIPLIER` in
`lib/billEstimate.ts` carries that uplift, measured against real MEPCO and LESCO
bills. It is an observed figure rather than a notified one, which is exactly why the
result is presented as a range and hedged in the UI.

Lifeline rates are transcribed but not yet selected: qualifying depends on a
sanctioned-load limit the bill does not state, so very low usage is treated as
protected's first band. That over-states such a bill rather than under-stating it.

## Error handling

| Situation | Behaviour |
| --- | --- |
| Reference number isn't 10–20 digits | 400, before any network call |
| Unknown provider code | 400 naming the providers that do work |
| No bill for that reference number | 404 — the portal returns its search page, which the parser detects |
| Portal unreachable / slow | 502 after a 20s timeout (per request; a lookup makes two) |
| Bill page markup changed | 502, and the missing field names are logged server-side |
| Gemini returns no reading | 422 with `suggestManualEntry`, and the UI offers manual entry |
| Gemini low confidence | 200 — the reading is shown as editable with a warning, never blocked |
| Gemini quota exhausted / bad key | 429 / 503 with a message saying which it is |
| Bill reading date unparseable | Units still computed; days and average show "N/A" |
| Reading lower than the bill, or implausibly high | Soft warning, results still shown |
| Bill omits `SAN LOAD` | Fixed charges assume 1 kW rather than failing the estimate |
| localStorage unavailable or corrupt | Search history degrades to empty; lookups still work |

## Notes / limitations

- Verified end to end against real MEPCO and LESCO bills. FESCO uses the identical
  portal and parses the same markup, but has not been checked against a real FESCO
  reference number yet.
- A lookup costs two requests to the portal, so it takes a few seconds. There is no
  caching — if this ever gets traffic, cache the session rather than the bill.
- Bills are fetched server-side, so the browser never calls the DISCO portal directly.
- No database. Search history lives in the browser's localStorage and belongs to the
  device, not to an account.
- `SAN LOAD` is read by searching the bill page for the label rather than by a fixed
  selector, because we have not pinned down its markup against a real bill. It has
  not been confirmed against live HTML — if fixed charges look wrong, check this
  first (`labelledValue` in `lib/providers/pitc.ts`).
- Checked against 29 recent months across five real bills, the quoted range contains
  the actual billed amount 21 times. Nearly every miss is a consumer who changed
  category part-way through the year, which one category per consumer cannot
  represent, or a month carrying arrears — not the slab arithmetic, which is exact.
- The surcharge uplift is measured from a handful of bills, not notified. It is the
  weakest number in the estimate and the first thing to revisit if the ranges drift.
- Tariff category is inferred from consumption history: nothing on a PITC bill states
  whether a consumer is protected. A household near the 200-unit line may be
  classified either way, which moves the estimate by roughly half.
