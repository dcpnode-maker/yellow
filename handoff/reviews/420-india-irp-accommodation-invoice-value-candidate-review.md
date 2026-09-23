# Order 420 — Fresh independent non-implementing Tier-3 review

**Verdict:** APPROVED — exact Order419 admission is load-bearing and invoice values are exact

**Reviewed candidate:** `b6821863568595828fb96e53d1f70fd620f4740b`

**Approved Order419 base:** `1ebb3f591ae230e47be01ba8ee70c88a814ec012`

**Reviewer:** `/root/order420_fresh_tier3`, fresh independent non-implementing
Tier-3 reviewer

## Finding disposition

No blocking product, statutory-field, arithmetic, tenancy, immutability or scope
finding remains in the bounded Order420 candidate.

The composer invokes the independently approved Order419 boundary over the exact
deeply frozen tenant/source pair. It aggregates only canonical item `AssAmt`, the
applicable `IgstAmt` or `CgstAmt` plus `SgstAmt`, and `TotItemVal`. Every parse, sum
and render uses `bigint`; no floating-point money, tax recalculation, rerounding,
residual allocation, discount, cess, other charge or round-off inference exists.
The emitted field family is exact: IGST produces only `AssVal`, `IgstVal` and
`TotInvVal`; CGST+SGST and CGST+UTGST produce only `AssVal`, `CgstVal`, `SgstVal`
and `TotInvVal`. Output and lineage are recursively frozen, tenant-hidden and
deterministic apart from the intended tenant-bound evidence-hash preimage.

## Reviewer-personal executable proof

- exact Orders414/415/419/420 focused set: **45 passed, 0 failed (589 assertions)**;
- Orders413–420 composition set: **46 passed, 7 expected database skips, 0 failed
  (594 assertions)**;
- complete standing suite: **1,382 passed, 1,054 expected database skips, 0 failed
  (20,284 assertions; 2,436 tests across 452 files)**;
- strict TypeScript: green;
- import boundaries: **154 TypeScript files**, green;
- dependency licence policy: **23 installed packages**, green;
- dependency audit: **0 vulnerabilities**;
- container image pins: **4 passed, 0 failed (7 assertions)**;
- `git diff --check` for `1ebb3f5..b682186`: green.

A reviewer-only native Bun probe additionally proved:

- 366 positive room-night values aggregate exactly to the signed-int64 ceiling
  `92233720368547758.07` without drift;
- one-minor-unit aggregate overflow fails closed;
- IGST and CGST+UTGST expose only their exact applicable field families;
- the complete result, `valDtls` and lineage are frozen;
- a tenant/source evidence mismatch fails closed; and
- the tenant UUID is absent from returned truth.

## Load-bearing Order419 mutation

I replaced only the Order419 call result with a shape-compatible reviewer stub that
would admit the permanent coherently rehashed CGST+SGST export forgery. The exact
permanent Order420 test became red **0 passed, 1 failed** and exposed an emitted false
`supplyTypeCode: "B2B"` candidate with `AssVal=100.00`, `CgstVal=2.50`,
`SgstVal=2.50` and `TotInvVal=105.00`. This proves the Order419 call is a semantic
admission boundary rather than a nominal invocation.

I then restored the product source byte-exact. Its SHA-256 is
`3CEE4F51B043717085243A7EE498BA2AAB7A35F9F2EBB2F4D0611D09464C47FF` and its Git
blob is `1f4aae351b76417872fab374d7ba1abfcc70c728`, identical to candidate
`b682186`. The restored load-bearing test passes **1/0**.

## Official IRP schema and validation audit

I personally checked the current IRIS IRP production portal on 2026-09-04:

- notified schema:
  `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`;
- current validation catalogue:
  `https://einvoice6.gst.gov.in/content/validation-rules/`;
- notified schema PDF:
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf`;
- current explanation of invoice-level value validations:
  `https://einvoice6.gst.gov.in/content/validation-rules-for-e-invoicing-that-you-must-take-care-to-avoid-errors/`.

The notified schema marks total taxable value (`AssVal`) and total invoice value
(`TotInvVal`) mandatory. Applicable tax is conditional: either total IGST, or total
CGST plus total SGST/UTGST. The PDF explicitly defines the SGST slot as
`SGST_UTGST_Amt_Total`, so Order419's UTGST-to-`SgstAmt` mapping and Order420's
`SgstVal` aggregation are correct. Current errors 2182–2185 require invoice totals to
equal the corresponding item sums; error 2189 derives total invoice value from item
totals, invoice other charges, discount and round-off. With those optional invoice
adjustments absent by contract, Order420's exact sums implement the admitted case.

The notified numeric totals have field specification `Number (Max length: 14,2)`.
Order420 deliberately remains an intermediate canonical candidate and its written
contract explicitly proves the wider internal signed-int64 ceiling; it does **not**
claim a complete or submit-ready JSON payload. Therefore this does not block the
bounded approval. A later full-payload/provider boundary must enforce the notified
`14,2` limit and exact numeric-token serialization before any IRP submission; values
beyond that limit must fail closed rather than be rounded, truncated or submitted.

## Scope and preserved state

The exact `1ebb3f5..b682186` range changes only the Order420 order/governance/docs,
one pure Tax-Fiscal module, its public export and its two proof files. It contains no
SQL, migration, schema, RLS, permission, transaction, database adapter, HTTP/API/UI,
server/runtime configuration, seed, package or lockfile change.

Git-object preservation is exact across approved base and candidate:

- `migrations/` tree: `e3261866534ed8d3512142137bc28a2363634303` at both;
- `tests/schema/expected.sql`: `bae7873109b6fa4436d5111ffde16d2c9194b273` at both;
- `package.json`: `c6c319539ce93aa038da8a6ae6c2009412256ffe` at both;
- `bun.lock`: `56434f7e2432edb381612135568d3a1a0b8d274b` at both.

Because those database/schema objects are byte-identical and this assignment
explicitly prohibited Docker/local execution, no new PostgreSQL instance was started.
The independently approved Order419-base database/schema/catalogue/referee 11/11
frontier remains applicable. I did not access or change Docker, WSL, the stable local
application, Google Drive or `.yellow`.

Order420 is approved exactly at `b682186`. This approval covers only the pure
intermediate India IRP accommodation invoice-value candidate. It grants no complete
payload, document, series, number, hash chain, provider, submission, IRN, QR, API/UI,
local, deployment, merge, push, Phase 7 or application-completion authority.
