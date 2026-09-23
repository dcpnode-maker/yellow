# Order 278 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order278_review`)
**Reviewed commit:** `e31b71ebdabb2cf61603d643fc595985b044b5ff`
**Reviewed base:** `5fe42f5` (independently approved Orders276–277 descendant)
**Reviewed range:** `5fe42f5..e31b71e`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order278. Before reviewing I read `PROJECT.md`, `AGENTS.md`,
ran `./state.sh`, and read the Yellow compliance/entity/PostgreSQL skills, Order278,
the relevant roster/workflow, D-719 through D-727, the approved Order276 source and
evidence, and the exact candidate source/tests/contracts/governance diff.

The reviewed head was exact commit `e31b71ebdabb2cf61603d643fc595985b044b5ff`
and was clean. `5fe42f5` is its ancestor. The exact twelve changed paths are all in
Order278's declared scope: the new pure builder, bounded-context export, two tests,
two contracts, three build/phase/roadmap records, the order, decision and ledger.
There is no migration, schema, seed, dependency, credential, runtime, local or
deployment path in the range. `git diff --check 5fe42f5..e31b71e` and
`git show --check e31b71e` both exited zero.

## Official statutory-source audit

I personally checked the candidate against these primary official sources:

- GSTN-authorized IRIS IRP, **Notified E-invoice Schema**:
  `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`;
- Government of India, CBIC Notification No. 60/2020 — Central Tax, FORM GST
  INV-01, schema version 1.1:
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf?x16745=`;
- IRIS IRP current validation rules:
  `https://einvoice6.gst.gov.in/content/validation-rules/`.

The IRIS notified mapping names buyer GSTIN, legal name, optional trade name,
address1, location, PIN and state exactly as `BuyerDtls.Gstin`, `LglNm`, `TrdNm`,
`Addr1`, `Loc`, `Pin` and `Stcd`. It names mandatory buyer place of supply separately
as top-level `Pos`; it is not a member of `BuyerDtls`. FORM GST INV-01 specifies the
registered-recipient identity/address envelope used here: legal and optional trade
names up to 100 characters, GSTIN length15, address1 up to100, enumerated state code
and a six-digit numeric PIN. The exact approved Order276 source already narrows
locality to50; Order278 preserves that bounded canonical source without trimming or
synthesis, so every emitted value remains inside the notified envelope. Export,
unregistered `URP`, special state/POS codes and all supply-type decisions are outside
this order.

Source inspection and executable proof confirm canonical GSTIN structure, checksum
and equality between its first two digits and `Stcd`; the admitted current state/UT
set rejects retired codes25/28; PIN is accepted only as a nonzero six-digit string
then projected as a number; and every admitted text limit rejects empty, whitespace-
altered, non-NFC, control-containing, over-limit or coerced evidence. `TrdNm` is
omitted only for exact source null.

## Source integrity, determinism and authority audit

`buildIndiaIrpBuyerDetails(source: unknown)` accepts only the exact eleven-key
Order276 result as one frozen, plain, non-proxy, symbol-free, accessor-free object
whose property descriptors are immutable. Every source field is primitive, so the
top-level freeze covers the complete input graph. Party UUID, registration UUID and
evidence SHA-256 are canonical and isolated in the wrapper lineage; none enters the
transmitted payload or `payloadJson`.

The builder creates only fixed-order
`{BuyerDtls:{Gstin,LglNm,TrdNm?,Addr1,Loc,Pin,Stcd}}`. The wrapper, lineage, payload
and buyer record are all frozen; source bytes remain unchanged; identical evidence
replays byte-identically; `payloadJson` is the direct fixed-order serialization; and
`payloadHash` is SHA-256 of those exact bytes.

My exact source scan found no `Pos`, supply type, `URP`, export/SEZ/deemed-export,
Tx, SQL, database, service/repository, network/fetch, async path, DML, event/outbox,
journal/posting/payment, document/series, persistence or submission authority. The
only runtime import is `node:util`; the Order276 type import is erased. The passing P8
static effect oracle separately proves the same boundary. This is candidate data only,
not legal invoice-window buyer designation or a complete invoice payload.

## Reviewer-personal executable proof

I did not rely on the implementer's recorded results. At exact commit `e31b71e` I
personally ran:

- `bun test tests/india-irp-buyer-details.intentional-red.test.ts
  tests/india-irp-buyer-details.test.ts`: **9 passed, 0 failed, 108 expectations**;
- `bun test tests/india-irp-seller-details.intentional-red.test.ts
  tests/india-irp-seller-details.test.ts
  tests/india-gst-recipient-registration.intentional-red.test.ts
  tests/india-gst-recipient-registration.integration.test.ts`: **15 passed,
  10 database-only skips, 0 failed, 181 expectations**;
- `bun test`: **879 passed, 798 environment/database-only skips, 0 failed,
  8,893 expectations; 1,677 tests across 300 files**;
- `bun run typecheck`: exit0;
- `bun run boundaries`: **101 TypeScript files scanned**, pass;
- `bun run license-check`: **23 installed packages**, pass;
- `bun audit` and `bun audit --audit-level=high`: **no vulnerabilities found**;
- exact range ancestry/name-status, source-authority scan, `git show --check`,
  `git diff --check` and clean-worktree proof: pass.

The database-dependent adjacent tests remained skipped because this pure review was
explicitly forbidden from starting or mutating a database/local runtime. Their
non-database exact input/output/SQL-shape checks passed. Order278 itself contains no
database surface, and the complete standing suite is green under the repository's
normal environment-skipped contract.

## Findings and bounded approval

No finding remains. I approve only the pure Order278 buyer-details candidate at exact
commit `e31b71ebdabb2cf61603d643fc595985b044b5ff`.

This approval grants no legal invoice or folio-window buyer designation; no `Pos`,
`SupTyp`, B2C/`URP`, export, SEZ or deemed-export decision; no CGST/SGST/IGST,
item/value/tax calculation; no financial posting/correction; no document allocation,
numbering, hash chain or issue; no provider/submission/API/HTTP/UI; and no database,
schema, migration, seed, local promotion, merge, public deployment, Phase-7-complete
or application-complete authority. Apart from this review record, I changed no file
and performed no database or runtime mutation.
