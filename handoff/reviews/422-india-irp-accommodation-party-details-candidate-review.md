# Order 422 — Fresh independent non-implementing Tier-3 review

**Verdict:** APPROVED — exact party projection and Order414 admission are load-bearing

**Reviewed candidate:** `71219ca2d783d9e560ac93e689c3ec787474255e`

**Approved base:** `0af7625`

**Reviewer:** `/root/order422_fresh_tier3`, fresh independent non-implementing
Tier-3 reviewer

## Finding disposition

No blocking statutory-field, source-lineage, tenancy, immutability, hostile-input or
scope finding remains in the bounded candidate.

The composer calls the independently approved Order414 boundary with the exact input,
requires the returned Order413 source hash to match and discards its numeric result.
It then preserves the exact approved `SellerDtls`, preserves the exact approved
`BuyerDtls` field order and appends only `Pos` from the approved property
place-of-supply evidence. Neither a caller POS nor mutable Party/account/reservation
display data is accepted. The fixed lineage carries exactly the Order413 source,
seller-payload, buyer-payload and place-of-supply hashes. Canonical JSON and the final
tenant-bound hash are deterministic; no tenant identifier is returned and every
returned descendant is frozen.

## Reviewer-personal executable proof

- exact Orders413–422 composition set: **56 passed, 7 expected database skips,
  0 failed (650 assertions)**;
- exact Order422 focused suite after mutation restoration: **6 passed, 0 failed
  (36 assertions)**;
- complete standing suite: **1,389 passed, 1,054 expected database skips, 0 failed
  (20,325 assertions; 2,443 tests across 454 files)**;
- strict TypeScript: green;
- import boundaries: **155 TypeScript files**, green;
- dependency licence policy: **23 installed packages**, green;
- `bun audit --audit-level=high`: **no vulnerabilities**;
- container image pins: **4 passed, 0 failed (7 assertions)**;
- `git diff --check 0af7625..71219ca`: green.

The first audit spelling I attempted, `bun pm audit`, is unsupported by Bun 1.3.14;
the repository-supported `bun audit --audit-level=high` command passed. This was a
reviewer command correction, not a product finding.

## Load-bearing Order414 mutation

I replaced only the Order414 call with a shape-compatible local reviewer stub that
returned the supplied source hash. The permanent Order422 suite became red
**4 passed, 2 failed**: it admitted both the coherently rehashed forged seller legal
name and the stale place-of-supply mutation. This proves the call is the semantic
admission boundary rather than a nominal invocation.

I restored the product source byte-exact to candidate `71219ca`; `git diff --exit-code
71219ca -- <product source>` passed, and the restored focused suite passed **6/0**.
No reviewer mutation or temporary artifact remains.

## Statutory-field audit

I rechecked the current IRIS IRP production validation catalogue at
`https://einvoice6.gst.gov.in/content/validation-rules/`. Current rules require a
supplier GSTIN (2155), require valid supplier and recipient state codes and GSTIN
state agreement (2258–2260 and 2265), validate recipient POS (2242–2243), and derive
intra/inter-state tax treatment from supplier state and recipient POS (2172/2174).
The candidate does not invent these fields: the approved SellerDtls/BuyerDtls builders
remain responsible for the registered party fields and approved property POS is the
sole source of `BuyerDtls.Pos`. The module remains an intermediate party section and
does not claim a complete or submit-ready IRP payload.

## Scope and preserved state

The exact range changes only the Order422 order/governance/docs, one pure Tax-Fiscal
module, its bounded-context export and two tests. It contains no SQL, migration,
schema, RLS, permission, transaction, database adapter, HTTP/API/UI, server/runtime,
seed, package or lockfile change. Static inspection found no query, write, network,
document, provider or submission path.

Git objects are identical at base and candidate:

- `migrations/`: `e3261866534ed8d3512142137bc28a2363634303`;
- `tests/schema/expected.sql`: `bae7873109b6fa4436d5111ffde16d2c9194b273`;
- `package.json`: `c6c319539ce93aa038da8a6ae6c2009412256ffe`;
- `bun.lock`: `56434f7e2432edb381612135568d3a1a0b8d274b`.

The candidate therefore cannot alter the independently approved database/schema/
catalogue/referee frontier. Per the explicit no-local constraint, I did not start or
change PostgreSQL, Docker, WSL or the sole stable local app. `.yellow/` remained
untracked and untouched.

Approval is exact to `71219ca` and only for this pure intermediate SellerDtls plus
BuyerDtls(Pos) candidate. It grants no transaction details, items, values, tax
calculation, document, series, number, hash chain, provider, submission, IRN, QR,
API/UI, local, deployment, merge, push, Phase 7 or application-completion authority.
