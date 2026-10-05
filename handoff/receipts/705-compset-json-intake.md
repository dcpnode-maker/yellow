# Order705 — bounded JSON compset intake receipt

25 September 2026. Added an offline, cross-platform Bun/TypeScript command that
accepts one explicitly versioned market capture envelope from stdin or one
bounded regular local file and passes it through the existing distribution
`normalizeMarketSourceCapture` boundary. The CLI prints one allowlisted normalized
JSON object to stdout; errors are sanitized to stderr. It does not save input or
output, contact providers, use browser credentials, write a database/API, or
schedule future work.

## Scoped files

- `scripts/research/market-json-intake.ts` — exact envelope/query metadata checks,
  stdin/file input, bounded reads and sanitized CLI behavior.
- `tests/order705-market-json-intake.test.ts` — schema, adapter, boundary,
  output-redaction and CLI behavior tests.
- `docs/market/JSON-COMPSET-INTAKE.md` — invocation and safety/meaning contract.
- This receipt. Independent-review record is owned by root/reviewer.

No new adapter schema, package, provider request, private response file, database,
API or UI change was added. Provider-specific payload normalization remains owned
by the existing distribution adapter.

## Interface and limits

Invocation: `bun scripts/research/market-json-intake.ts [--input capture.json]`;
without `--input`, read JSON from stdin. The exact top-level schema is
`yellow.market-json-intake/v1` with `source`, `query`, `collectedAt` and `payload`.
Unknown source/envelope/query fields and invalid metadata fail closed. Input is
limited to 4 MiB; the existing adapter separately limits payloads to 2 MiB and
normalized candidate count to 500. Its normalized result is allowlisted and
retains available source, stay, timestamp and exact money-basis metadata while
leaving unknown fees/taxes/cancellation and data coverage unknown. It explicitly
marks `operationalWrites: false` and `automaticPricingEligible: false`.

## Verification

- Builder focused command: `bun test tests/order705-market-json-intake.test.ts
  tests/market-source-adapters.test.ts tests/market-source-batch.test.ts` — **21
  passed, 0 failed, 139 assertions**. Nine existing market-source-batch tests are
  platform-skipped on Windows; the new Order705 CLI tests all ran on Windows.
- `bun run typecheck` passed.
- Root independently reran the 705/adapter tests with **21 passed, 0 failed,
  139 assertions**, full typecheck, 208-file import boundaries and 120-package
  license check; all passed.
- Root exercised the actual connected Booking MCP result: bounded 10-property
  Dubai capture (`collectedAt` `2026-09-24T21:38:39.585Z`, stay 2–3 Oct 2026, 2
  adults/1 room, children none, AED, point-of-sale IN, `en-gb`) normalized to 10
  candidates. Root observed the first price as 55,250 AED minor units, taxes
  inclusion unknown for all 10, and operational writes false. No raw payload or
  file was retained. This was an already fetched MCP response—not a new HTTP
  request, live mobile integration or autonomous acquisition.
- Root's independent review is recorded and approved in
  `handoff/reviews/705-compset-json-intake.md`, for the JSON receiver only.

## Limits

`status: complete` means this one capture normalized without adapter issues; it
does not mean complete fee/tax detail, accurate future rates, live availability,
comprehensive competitor coverage or a complete global compset. No mobile source
is established unless its actual supported payload shape passes the existing
adapter contract. This order adds JSON intake only—not scraping, account login,
PriceLabs/Airbnb global feeds, scheduler, database ingestion, pricing changes or
persisted market observations.
