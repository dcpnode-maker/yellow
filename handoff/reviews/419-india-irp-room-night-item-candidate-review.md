# Order 419 — Fresh independent non-implementing Tier-3 review

**Verdict:** CHANGES REQUIRED — mandatory Order415-gate proof is not load-bearing

**Reviewed candidate:** `31452d4c9d20077c201846bb972c8654b8d3119d`

**Approved Order415 base:** `d42b0fcad5919d64cc9fd17d03f957020452ae1d`

**Reviewer:** `/root/order419_fresh_tier3`, fresh independent non-implementing Tier-3

## Material finding

The production candidate currently calls both approved composers and correctly rejects
the stronger hostile case below. The permanent Order419 proof does not, however, make
the Order415 call load-bearing.

I replaced only:

```ts
const b2b = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(numericInput);
```

with a shape-compatible source-hash stub. The complete shipped Order419 permanent
suite still passed **5/0 (97 assertions)**. Its claimed correctly-rehashed export case
starts from the default IGST fixture. Order414 already rejects that graph because IGST
no longer agrees with `inter_state`, so the case never reaches Order415's unique
ordinary-B2B admission rule.

A temporary reviewer-owned exact-shape probe instead started from `cgst_sgst`, changed
both governed supply-nature copies to `export`, recomputed both nested tenant-bound
hashes and the outer Order413 hash, and froze the complete graph. That graph remains a
valid Order414 numeric source but is not an ordinary registered B2B source:

- real candidate: reviewer probe **4/0 (27 assertions)**; the graph is rejected;
- Order415-removal mutant: reviewer probe **3/1**; the forged graph is accepted and
  emitted as `supplyTypeCode: "B2B"` with CGST/SGST item fields.

This is a mandatory high-risk proof defect, not a demonstrated defect in the present
production implementation. Order419 required Order414 and Order415 validation to be
demonstrably invoked and every correctly-rehashed unsupported supply graph to fail
closed. The current permanent test can pass after the unique Order415 control is
removed, so candidate approval is withheld.

Required repair: make the permanent Order419 unsupported-supply proof use a coherently
rehashed `cgst_sgst` (or equivalent non-IGST) export/deemed-export graph, and prove that
the exact Order415-removal mutant turns that permanent test red. Do not widen product
behavior. A different fresh non-implementing Tier-3 reviewer must rerun the repaired
candidate.

## Statutory/schema review

The current IRIS IRP portal, powered by IRIS for GSTN and checked on 2026-09-04,
continues to support the bounded product design:

- notified schema: `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`;
- current validation catalogue: `https://einvoice6.gst.gov.in/content/validation-rules/`;
- current web-form field guidance:
  `https://einvoice6.gst.gov.in/content/kb/generate-through-web-form/`;
- notified schema PDF:
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf`.

The notified table marks exactly `SlNo`, `IsServc`, `HsnCd`, `UnitPrice`, `TotAmt`,
`AssAmt`, `GstRt` and `TotItemVal` as mandatory item fields. The portal describes its
SGST value as the per-item SGST/UTGST amount, confirming `utgst -> SgstAmt`. Current
rules also require unique serials, the applicable IGST versus CGST+SGST family,
`AssAmt = TotAmt - Discount`, and `TotItemVal` from assessable value plus applicable
item taxes/charges. The candidate's one-room-night-per-item, no-discount/no-other-charge
boundary matches those rules without inventing quantity, UQC or description.

Source inspection found no product calculation or serialization defect: minor units
use `BigInt`; basis points use safe integer quotient/remainder; no floating-point money,
tax recomputation, rerounding, allocation or aggregation appears. Exact 5/12/18-percent
IGST, CGST+SGST and CGST+UTGST outputs carry the correct slots, and `TotItemVal` is the
persisted transaction value plus persisted tax. Output and lineage are fixed-shape,
recursively frozen and tenant-hidden.

## Reviewer-personal executable evidence

- exact Order414+415+419 focused set: **40 passed, 0 failed (549 assertions)**;
- restored exact Order419 candidate: **6 passed, 0 failed (102 assertions)**;
- reviewer exact-shape hostile probe before removal: **4 passed, 0 failed
  (27 assertions)**;
- Order414-result removal mutant: shipped permanent suite **2 passed, 3 failed**;
- Order415-gate removal mutant: shipped permanent suite incorrectly **5 passed,
  0 failed (97 assertions)**;
- the same Order415 mutant with the reviewer CGST+SGST rehashed export probe:
  **3 passed, 1 failed**, exposing the accepted forged B2B item candidate;
- source restored byte-exact to Git blob `3946f92fcbfca347ad6b1b6afd250f0c9736e075`;
  every temporary probe and mutant was removed;
- strict TypeScript: green;
- import boundaries: **153 TypeScript files**, green;
- dependency licences: **23 installed packages**, green;
- dependency audit: **0 vulnerabilities**;
- container image pins: **4/0 (7 assertions)**;
- `git diff --check` for both the Order419 product commit and exact approved-base range:
  green.

The standing run completed **1,373 passed, 1,054 skipped, 1 failed (20,225
assertions)**. The sole failure was an unrelated Order330 Chromium teardown `EBUSY`
while deleting its own temporary directory; the unchanged test immediately passed
alone **1/0 (4 assertions)**. Because this review already withholds approval for the
material proof gap, no claim of a clean full-standing run is made.

## Scope, schema and runtime preservation

The exact `d42b0fc..31452d4` range contains separately governed Order417/418 host-cleanup
coordination. I isolated Order419 product scope to candidate commit `31452d4` on parent
`349cfa0`: the only `src/` changes are the new pure Tax-Fiscal composer and its public
index export. There is no SQL, transaction, database adapter, HTTP/API/UI/server,
runtime configuration, package or lockfile change attributable to Order419.

Git-object preservation is exact across approved base and candidate:

- `migrations/` tree both `e3261866534ed8d3512142137bc28a2363634303`;
- `tests/schema/expected.sql` both
  `bae7873109b6fa4436d5111ffde16d2c9194b273`;
- `package.json` both `c6c319539ce93aa038da8a6ae6c2009412256ffe`;
- `bun.lock` both `56434f7e2432edb381612135568d3a1a0b8d274b`.

Accordingly, Order419 is migration-free and schema/runtime-preserving. I did not touch
Docker, a database, Drive, the stable local application or `.yellow`. The independently
approved Order415 official PostgreSQL baseline remains the applicable database proof:
frontier migrations **1–73**, exact schema/catalogue and referee **11/11**. No new DB
gate was warranted by this pure unchanged-schema candidate, and none is claimed.

One disposable-checkout cleanup incident affected only ignored build dependencies: Git
worktree removal followed the temporary Windows `node_modules` junction and emptied the
active worktree's dependency directory. I immediately restored it using explicit native
Windows `C:\Users\astha\.bun\bin\bun.exe install --frozen-lockfile`. All **23**
packages and the licence gate were restored; `package.json` and `bun.lock` remained
byte-identical to HEAD at the hashes recorded above. No tracked product, test, schema,
local-app or `.yellow` state was changed by that incident. The temporary worktree no
longer exists.

Order419 remains unapproved. No document, number, provider, submission, API/UI, local,
deployment, merge, push, Phase 7 or application-completion authority follows.
