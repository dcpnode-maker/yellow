# PMS-20260930 — Restore exact physical offer pairs

Status: authorized bounded PMS contract repair under the founder's instruction
to finish operational PMS/CRM. Independent architecture diagnosis confirms a
production discrepancy, not a new product policy. No founder question is needed
to restore the accepted D-284 and CONTRACTS exact-pair semantics.

Basis: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56` (e06 plus accepted CRM queue).
Branch: `phase-7/pms-physical-offers-20260930`.
Worktree: `/workspace/yellow-pms-offers`.

## Verified discrepancy

`offers.ts` deduplicates raw availability by unit-type code before calculating
the work ceiling and resolving exact immutable quotes. CONTRACTS159–168 and
D-284 instead require every published physical sellable/rate pair, including
blocked/unpriced/conflicted evidence, with no silent truncation. Raw ordering
does not choose bookability; a blocked first sibling can hide available later
siblings. Existing seed now has six rooms while Order084 expects five; fixture
drift is a second issue and must not conceal the production regression.

## Exact scope

- `src/contexts/reservations/offers.ts`: remove representative unit-type
  deduplication only, using all filtered raw availability for candidate count and
  existing exact quote loop. Preserve authority, filters, rate/policy/price/tax
  evidence, money/currency, deterministic ordering, guards and commands.
- NEW `tests/pms-20260930-physical-offers.test.ts`: bounded meaningful pure-port
  proof of physical siblings, mixed blocker states, exact quote selection and
  pre-quote work ceiling. Preserve returned evidence, no manufactured pricing.
- NEW `tests/pms-20260930-physical-offers.integration.test.ts`: required disposable
  PostgreSQL proof with canonical deployment fixture setup, restricted runtime
  tenant transactions, all current six physical rooms, sibling blocker scenarios,
  work ceiling before quote calls and full public row/sequence fingerprints around
  reads. Fail missing/owner/mismatched authority before fixtures; do not accept skip.
- `tests/reservation-offers.integration.test.ts`: retain every existing assertion;
  explicitly establish its documented five-sellable fixture by temporarily
  disabling only the newly added Room203 sellable in this test's disposable
  database, restore in cleanup. Do not change global seed. Replace direct
  occupancy writes/deletes with sanctioned record/release calls, with cleanup in
  finally so an earlier failed expectation does not contaminate later cases.
- `docs/CONTRACTS.md`: append repair clarification only, preserve accepted text.
- This order; NEW `handoff/reviews/PMS-20260930-physical-offer-contract.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` records.

No other source, migrations, global seed, HTTP/UI wiring, permissions, booking,
inventory/pricing mutations in production, dependencies or license policy changes.
Test-only fixtures must be task-owned disposable data, never the laptop/live app.
No merge, deployment, spending, credentials export or real guest/payment data.

## Proof and review

Independent non-implementer personally reproduces intended baseline RED using
the identical new proof then candidate GREEN. Two physical siblings of one type
must retain blocked-first/available-later and available-first/blocked-later cases;
every exact published pair retains its own physical identity and quote evidence.
Measure six-room raw availability explicitly, preserving five-room legacy oracle
through its explicit fixture. Prove a cap below physical candidate count rejects
before any quotes and no successful/denied read mutates public rows/sequences.
Existing legacy offer suite and accepted CRS helper/HTTP/database parity remain
required, alongside typecheck, boundaries, full staged/basis whitespace and
unchanged `./setup.sh --db-only`11/11 before a reviewable PR.

Earlier fixture-only offer diagnosis is corrected by append-only checkpoint; do
not rewrite historical RED receipts. License and other release blockers remain
visible until separately governed resolution. UI grouping belongs above the full
physical result and is not part of this repair. This is one PMS correctness slice,
not full PMS, CRM or provider integration completion.

## Implementation checkpoint — builder evidence, 2026-09-30

Candidate source is frozen pending independent execution. Removed only the representative-unit-type filter; all filtered physical sellables now reach the existing exact quote loop and work ceiling. Added `tests/pms-20260930-physical-offers.test.ts` and restricted PostgreSQL proof `tests/pms-20260930-physical-offers.integration.test.ts`. Legacy suite now establishes the five-room fixture by disabling only Room203 after review seed and checks restoration; direct occupancy DML is replaced by typed `ooo_oos` plus sanctioned record/release calls with cleanup in `finally`. Contract clarification appended without rewriting accepted wording.

Builder receipts: restricted candidate PG1/0/19; legacy PostgreSQL6/0/76 with every prior assertion retained; pure2/0/11; typecheck and 205 import boundaries green. This does not claim independent approval. Baseline RED, negative-authority controls and independent post-candidate proof remain required; no commit, merge, deployment or Phase7 closure.

## Final independently executed checkpoint

Required newPG1/0/69 after intended identical baseline0/1/6; canonical perphysical quote parity and raw6IDoracle are now explicit. Hardened legacy8/0/83, pure2/0/22, three runtime authority negatives and legacy wrongtarget/session refusal pass. Legacy URL/actualDBowner/session admission precedes seed/status mutation and gates cleanup; failed occupancy release retains typed parent while unrelated cleanup/pools continue. Exact original assertions remain. Separate governed detachedCRSpreview27/0/163 plusPG6/0/66, types/boundaries205 and coordinator unchangedsetup11/11 pass. Final nine-file cached review/whitespace and local commit remain; other policy/release/live-integration boundaries are separate.
