# Order451 — Private immutable rate-evaluation reuse

**Status:** BUILT; root independent focused, hostile, old/new complete-output and
controlled mutation proofs pass. Final bounded-code long-stay medians improve90.66–92.68% in the pure
fixture; no production latency claim. Q240 admits combined exact-source standing
preparation, not publication. Parent remainsffb03441 and all failed449 evidence is
retained. See handoff/reviews/451-rate-quote-evaluation-reuse.md for executed proof.
**Owner:** Codex. **Date:** 2026-09-08.
**Classification:** Backend performance/correctness preservation; no UI and no
new financial or commercial policy. Independent non-implementing high-risk review
and reviewer-executed proof are required before acceptance.

## Outcome and existing authority

Reduce redundant validation/allocation in long-stay rate quotations while returning
the exact same prices, evidence, conflicts, workUnits and quote hashes. A faster
implementation must not create a second price engine or trust caller-derived dates.

PROJECT invariants6/7, D-147/D-230, D-242 and D-245 remain binding. In particular,
**D-244/Q109 expressly rejects Object.freeze as provenance**: a caller previously
forged LOS/DOW/booking-window fields in a frozen context. That denial must remain
effective on every unrecognized object. D1288/D1290/D1292/D1293 preserve exact366
tax-attribution acceptance,367 refusal, property/date scope and package guards.
D-84's executable independent-review requirement remains binding under the current
Codex reviewer-identity policy; the implementer's results are not reviewer proof.

## Observed work, not a profiling claim

- `RateQuoteService.resolve` (`quote.ts:424–469`) evaluates every night, derives a
  stay context, then composes it.
- `deriveRateStayCompositionContext` (`composition.ts:991–1034`) canonically
  revalidates/re-evaluates each supplied night. `composeRateStayQuote` (`1116`)
  repeats that complete derivation for the already-created stay context.
- `canonicalRateBundle` (`composition.ts:542–562`) normalizes the entire evaluator
  spec and calls the evaluator, which normalizes it again (`evaluators.ts:960`).
  Calendar normalization visits, copies and sorts all cells (`326–337`). Repeating
  this for every night produces redundant N-by-calendar-size work.
- Reconstructed contexts repeatedly instantiate timezone formatters
  (`evaluators.ts:523–540,691–693`). Their contribution to elapsed time has not
  been measured separately; GC or concurrent-process interference is not proven.
- The P4 long-stay case performs one367-night quote. The test named
  `D1288: exactly 366 attributable room nights calculate while 367 is refused`
  actually performs **two** quotes,366 and367. Its whole-test duration must not be
  reported as the duration of366 nights alone.
-367 is not a failed rate quote. `quote.ts:614` marks only tax preview unavailable
  after rate composition; the tax evaluator is not invoked for that branch.

## Smallest proposed optimization

Keep all existing public functions, signatures and canonical data shapes. Add only
private object-identity provenance for successful, module-produced immutable
normalizations/contexts, allowing those exact objects to avoid redundant rebuilding.

1. In `evaluators.ts`, privately recognize outputs constructed by the existing
   spec normalizer and context derivation. Reuse an authenticated normalized spec
   in subsequent normalization/evaluation; reuse a derived context in the internal
   evaluator validator instead of recreating its property-local fields.
2. In `composition.ts`, privately recognize a complete stay context produced by
   `deriveRateStayCompositionContext`. `composeRateStayQuote` may reuse that exact
   validated output, avoiding a second full per-night canonicalization. Unrecognized
   inputs still follow the complete current reconstruction and comparison path.
3. Use module-private weak identity collections, never a caller-visible flag,
   public brand, supplied hash, structural-equality cache key or Object.isFrozen
   alone. Only validated **outputs** enter the collection, after construction and
   recursive immutability are proved. Never mark a caller-owned input simply because
   its current values passed validation; never share mutable nested aliases.
4. A valid copied/serialized object remains supported through normal validation,
   but it is not a provenance hit. A forged copy, proxy wrapper, changed night or
   mutated nested evidence cannot borrow the original object's identity.
5. Keep calendar lookup, rule evaluation and all existing logical workUnits
   calculations unchanged. Do not cache a price by date or skip nightly pricing.
   Do not add an Intl formatter cache, compiled lookup structure or another
   optimization unless this narrower change fails the agreed measurement gate;
   that would require a separately reviewed scope amendment.

First inspect every retained nested field (including target, reference and RMS
evidence, arrays and optional values) for mutable aliases. If any successful output
is not recursively immutable, do not authorize a fast path for that output. Report
the exact obstacle rather than widening this order into general input hardening.
Weak collections must neither strongly retain old tenant data nor replace current
database authorization/evidence resolution. No persisted or cross-process cache.

## Exact proposed implementation scope

Production edits, after activation only:

- `src/contexts/rates/evaluators.ts`
- `src/contexts/rates/composition.ts`

Proof edits, after activation only:

- NEW `tests/rate-evaluation-reuse.test.ts`: immutable provenance, hostile-copy,
  mutation-sensitive reuse and exact differential value tests.
- `tests/rate-quote-tax-preview.integration.test.ts`: append deterministic complete
  quote/evidence/hash parity cases using its existing pure harness. Preserve every
  existing case, assertion and timeout, especially P4 and D1288; do not export or
  rewrite its fixture merely to support a benchmark.
- Private reviewed baseline/candidate benchmark and evidence only under
  `.yellow/evidence/order451/`; no helper execution is granted by this proposal.
- This order, and a new `handoff/reviews/451-rate-quote-evaluation-reuse.md` after
  activation. Root owns any later status/ledger/decision integration explicitly.

Read-only dependencies/regression files include `quote.ts`, `publication.ts`, the
tax evaluator/resolver, `tests/rate-evaluators.test.ts`,
`tests/rate-composition.test.ts`, `tests/rate-quote.integration.test.ts` and
`tests/rate-quote-tax-preview.intentional-red.test.ts`. No context-index export,
command/HTTP edit, publication DB batch loading, schema/index/migration, fixture
seeding, stored quote rewrite, new dependency, UI, app restart or provider action.

## Executable correctness proof required after activation

1. Before implementation, pin old production source and record deterministic
   complete outputs from that unchanged implementation. Use exact bigint-preserving
   encoding, not JSON conversion through Number. Retain baseline output bytes/hash
   and the common fixture/test source hash; never regenerate expected values from
   the optimized implementation. A read-only baseline artifact must be separately
   approved by root; no new worktree, ref change or broad source replacement.
2. Compare complete normalized specs, contexts, per-night evaluation results,
   composition results and complete RateQuote outputs including quoteHash for
   identical controlled inputs. Cover all existing model families, calendar
   missing/closed cells, rules/conflicts, floors/ceilings, exact rounding/overflow,
   package/promotion/policy/availability blockers and reference/target/RMS evidence.
   Preserve error classes/messages where already contracted, output ordering,
   recursive freeze, original input immutability and every workUnits value.
3. Warm the reuse path, then try frozen clones with altered LOS, DOW, booking
   window, night/timezone/UTC instants, amounts/currency, context/result pairing,
   nested evidence and reordered/omitted fields. Include outer-frozen but mutable
   nested objects, proxies, accessors and serialization round trips. Compare the
   old path's behavior; no cache hit may turn a prior denial into acceptance.
4. Prove successful outputs have no mutable caller aliases and cannot be changed
   after recognition. Private provenance is not injectable or exported. Obtain an
   intentional red for redundant normalization/reconstruction before optimization;
   use a private isolated benchmark/diagnostic or narrow structural check plus
   behavioral identity tests, not a public instrumentation API or global mock.
5. Preserve property-local DST spring/fall, leap day, timezone-separated inputs,
   supported1–730-night rate quotes, exact366 tax acceptance and367 unavailable
   tax preview. Never short-circuit the complete rate quote at the tax limit.
6. A non-implementing reviewer personally runs focused/differential/hostile proofs,
   then separately disables the provenance check in a controlled candidate and
   proves forged frozen-context tests become red; restore exact frozen bytes.
   Merely pasted green results or an unmeasured speed claim cannot close the order.

## Measurement and release gate

Before any optimization, record warm and cold baseline timings for deterministic
calendar stays of1,30,60,183,366 and367 nights, with calendar size equal to stay
length; also measure a small fixed-price case. Use the same Bun version, machine,
fixtures and output serialization for old/new builds. Separate setup and complete
quote time. Record process identity, source/artifact hashes, median/range, CPU time
and available memory observations; do not attribute GC without profiling evidence.

Run bounded old/new samples sequentially, alternating order, with at least one
discarded warmup and five measured runs per size/build. No simultaneous full suite,
browser or helper launch by this proof. Do not stop unrelated user processes.
If outside load is material, label the sample inconclusive and schedule a clean
repeat; retain it rather than quietly discarding unfavorable runs. Evidence should
show fewer full-calendar normalization/context reconstruction passes as well as
elapsed improvement; a timeout increase or changed fixture is not optimization.

Proposed acceptance target, for root to approve at activation: at least30% lower
median complete-quote time for each366/367 workload, no material short-stay/fixed
regression (report both ratio and absolute delta), and exact output parity on every
sample. Do not claim globally linear pricing: the unchanged calendar lookup still
has N-by-calendar-size work. If the target is not met, retain measurements and
return to root rather than adding another optimization or weakening correctness.

Run focused pure rate/composition/preview suites, typecheck and import boundaries;
then the unchanged standing gates and exact-source CI. Database-gated rate tests
must be reported honestly; actual DB/referee execution, if required for publication,
needs separate exact target admission. This proposal does not authorize bootstrap,
roles, seeding, Docker/WSL or any database/service mutation.

## Read-only inspection pins — not a released implementation base

- `evaluators.ts`: `dce4996716869778fe7a2637811071e58e3eb94f120653cf100b32b5f2d8a9a5`
- `composition.ts`: `c6d5e81ef061aab0e48ad127de1858466ec9035f5f9d3cb33f2ba2d9312d5156`
- `quote.ts`: `8b309668a9a28cccd4334aed91d38b90f49893fe8c731e08125e38e580baa43e`
- Existing preview tests: `d88b4eeb2fc2dd0e0879b9040259df4ad4ae893652d8d2ea7e5010f8b0af24f9`

At activation no performance test has been executed and no measured speedup is
claimed. Root accepted the proposed 30% median long-stay improvement gate, with
complete parity and independent proof. No founder pricing/tax choice, release
completion or Phase7 completion is inferred.
