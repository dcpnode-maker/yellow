# Order 419 — Different fresh independent non-implementing Tier-3 rereview

**Verdict:** APPROVED — repaired Order415 admission proof is load-bearing

**Reviewed candidate:** `623faea63b4f7bfbcbc633ba21f974794862acf7`

**Candidate parent:** `31452d4c9d20077c201846bb972c8654b8d3119d`

**Approved Order415 base:** `d42b0fcad5919d64cc9fd17d03f957020452ae1d`

**Reviewer:** `/root/order419_repair_rereview`, different fresh independent
non-implementing Tier-3 reviewer

## Resolution of the first review

The first fresh review correctly withheld approval because the original unsupported
export fixture began as IGST. Its forged export graph therefore contradicted the
Order414 inter-State/component-family relationship and failed before the unique
Order415 ordinary-registered-B2B admission rule. Removing Order415 still left the
old permanent test green.

The repaired fixture now starts from `cgst_sgst`, changes both governed supply-nature
copies to `export`, recomputes each nested tenant-bound evidence hash and recomputes
the outer Order413 evidence hash. I personally proved the resulting frozen graph has
these exact properties:

- Order414 admits it as one coherent `cgst_sgst` numeric room-night source;
- Order415 rejects it with
  `IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError` because export is not an
  ordinary registered Indian B2B accommodation supply;
- the real Order419 candidate rejects it;
- replacing only the Order415 call with the same shape-compatible source-hash stub
  makes the permanent Order419 suite fail **4 passed, 1 failed (97 assertions)**;
- that failure exposes the forged export as an emitted `supplyTypeCode: "B2B"`
  candidate with `CgstAmt` and `SgstAmt`, which is exactly the forbidden behavior the
  permanent proof must catch.

After the mutation I restored the production source byte-exact. Its SHA-256 is
`D71CEDD58EEA2DD8CC9499D92DC0F0E664562E98FF1D928DA8F6B84D1E728B30` and its Git
blob is `3946f92fcbfca347ad6b1b6afd250f0c9736e075`, identical at both `31452d4` and
`623faea`. The restored Order419 suite then passed **6/0 (102 assertions)**.

The repair changes only the hostile fixture's starting family plus explanatory
comment. Production behavior is unchanged. Fixture Git blob changes from
`ba5728eaf2cf8274db44fa22e51311f2e0f9c947` to
`a79b4ed9abcd80c7d811438b2da153f4fbc32a81`.

## Reviewer-personal executable evidence

- repaired Order419 real candidate: **6 passed, 0 failed (102 assertions)**;
- exact repaired Order415-removal mutation: **4 passed, 1 failed (97 assertions)**;
- exact Order414/415/419 focused set: **40 passed, 0 failed (549 assertions)**;
- Orders413–419 focused set: **41 passed, 7 expected database skips, 0 failed
  (554 assertions)**;
- complete standing suite: **1,374 passed, 1,054 expected database skips, 0 failed
  (20,229 assertions; 2,428 tests across 450 files)**;
- strict TypeScript: green;
- import boundaries: **153 TypeScript files**, green;
- dependency licence policy: **23 installed packages**, green;
- dependency audit: **0 vulnerabilities**;
- `git diff --check` for `31452d4..623faea` and
  `d42b0fc..623faea`: green.

The exact mutation is therefore not a nominal call-count check: the repaired
unsupported graph is valid at Order414 and becomes an observable false B2B candidate
only when Order415 is removed. The permanent test is now load-bearing for both
approved admission composers.

## Product and statutory inspection

The production composer remains a pure, migration-free Tax-Fiscal boundary. It
accepts only an exact deeply frozen tenant-bound Order413 source, invokes both
approved Order414 and Order415 composers over the same source, and requires their
source hashes to agree. It emits one item for each existing dense room-night. It does
not aggregate nights, allocate residuals, recalculate persisted tax, use floating
point, issue a fiscal document or call a provider.

Minor-unit serialization uses `BigInt`, enforces canonical non-negative signed-int64
strings and emits two decimal places. Rate serialization accepts only an existing
non-negative safe-integer basis-point rate and emits two decimal places. The output
contains exact 5/12/18-percent IGST, CGST+SGST and CGST+UTGST cases; UTGST uses the
schema's `SgstAmt` slot. Item total is exact persisted transaction value plus exact
persisted tax. Serial numbers remain dense for 1, 2 and 366 nights, zero component
amounts remain explicit, and output/lineage are fixed-shape, recursively frozen and
tenant-hidden.

I personally checked the current IRIS IRP production portal on 2026-09-04:

- notified schema:
  `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`;
- current validation catalogue:
  `https://einvoice6.gst.gov.in/content/validation-rules/`;
- notified schema PDF:
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf`;
- IRIS explanation of schema value validations:
  `https://einvoice6.gst.gov.in/content/validation-rules-for-e-invoicing-that-you-must-take-care-to-avoid-errors/`.

The notified item table still marks `SlNo`, `IsServc`, `HsnCd`, `UnitPrice`,
`TotAmt`, `AssAmt`, `GstRt` and `TotItemVal` as mandatory. It provides the applicable
`SgstAmt`, `CgstAmt` and `IgstAmt` tax slots. Current rules require unique item
serials, mutually applicable IGST versus CGST+SGST families, equal CGST/SGST,
`AssAmt = TotAmt - Discount`, and item total from assessable value plus applicable
tax/cess/other charges. The bounded no-discount/no-cess/no-other-charge candidate is
consistent with those checks and invents none of those fields.

The current live catalogue also contains errors 2238/2239 for missing quantity and
UQC even though the notified table does not star `Qty` or `Unit`. This does not block
Order419 because its contract is explicitly an intermediate mandatory-field item
candidate and forbids inventing quantity/UQC; it is not a complete provider payload.
A future full-payload/provider order must settle and prove the correct service
quantity/UQC before submission. This approval grants no submit-ready-payload claim.

## Scope, schema and runtime preservation

The repair commit contains the first review record and governance status plus the
single fixture repair. It changes no `src/`, migration, schema oracle, package,
lockfile, HTTP/API/UI/server or runtime configuration. Git-object comparison between
the approved Order415 base and repaired candidate is exact:

- `migrations/` tree:
  `e3261866534ed8d3512142137bc28a2363634303` at both commits;
- `tests/schema/expected.sql`:
  `bae7873109b6fa4436d5111ffde16d2c9194b273` at both commits;
- `package.json`:
  `c6c319539ce93aa038da8a6ae6c2009412256ffe` at both commits;
- `bun.lock`:
  `56434f7e2432edb381612135568d3a1a0b8d274b` at both commits.

No new database execution was warranted or permitted for this rereview because the
candidate and repair are pure and those database/schema objects are byte-identical.
The independently approved Order415-base PostgreSQL proof remains the applicable
frontier/schema/catalogue/referee **11/11** evidence. I did not use or alter Docker,
WSL, the stable local application, Google Drive or `.yellow`.

Order419 is approved at exactly `623faea`. This approval covers only the pure
ordinary-B2B room-night item-candidate boundary in the order. It grants no document,
series, number, hash-chain, invoice-total, provider, submission, IRN, QR, API/UI,
local, deployment, merge, push, Phase 7 or application-completion authority.
