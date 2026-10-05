# Order705 — bounded JSON compset intake

Founder requests basic competitor listing/rate data for internal decisions via
JSON/mobile sources and a lightweight script. Existing market-source adapters
already normalize Booking MCP and other captured payloads. Reuse these rather
than create another warehouse or assume undocumented mobile endpoint contracts.

Scope: scripts/research/market-json-intake.ts (new); tests/order705-market-json-intake.test.ts
(new); docs/market/JSON-COMPSET-INTAKE.md (new); this order;
handoff/receipts/705-compset-json-intake.md; handoff/reviews/705-compset-json-intake.md.
Root-only docs/market/SOURCE-ACCESS-20260925.md, project status/ledger/requirements.

Create a cross-platform Bun/TypeScript CLI using existing distribution public
normalizeMarketSourceCapture surface. Input one explicit capture envelope from
stdin or bounded regular local file. Output allowlisted normalized JSON to stdout;
do not persist raw responses, secrets, guest contacts, credentials or arbitrary
fields. Keep diagnostics on stderr, sanitize errors, enforce size/record bounds,
reject invalid metadata and unknown source rather than guessing. No network fetch,
browser cookie extraction, endpoint guessing, authentication bypass, scheduler,
database/API changes, automatic price changes or new dependencies. A JSON response
from mobile is accepted only once its actual supported shape is verified.

Existing adapters preserve stay/occupancy/currency/query/source timestamp,
money minor units and unknown fees/cancellation/basis. Do not make unknown data
complete or imply complete market coverage. Independent code review, focused
tests plus existing adapter tests and types required. Root must exercise the CLI
with the already fetched real Booking MCP result (bounded ten properties) without
committing provider payloads. Document distinction between receiving/normalizing
JSON and autonomous fetching: no live mobile scraper is established by this work.
