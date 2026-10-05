# Order 297 fresh independent Tier-3 re-review

**Reviewer:** `/root/order297_fresh_rereview`, fresh non-implementing OpenAI Codex agent
**Candidate:** `eeaf8709953d6f0e38b7633dece7eb217f9c2881`
**Approved base:** `a9cb63e35028823fb09474f5deef8d9f948f58d2` (Order296 D-800 governance descendant)
**Prior reviewed candidate:** `c789eb467a3276a7b0047020eeaa39722ee4b80b`
**Result:** **CHANGES REQUIRED**

## Independence and scope

I did not implement Order297 and did not perform its first review. I read
`PROJECT.md`, `AGENTS.md`, ran `state.sh`, and read the compliance skill, Order297,
D-801 through D-804, the prior review, the approved Order287/295/296 source
contracts, and the Phase-7 build/roadmap material before personally inspecting and
executing this re-review.

Strict ancestry is `a9cb63e..eeaf870` (four commits). The candidate changes exactly
the 14 files admitted by Order297. Static containment, `git diff --check`, dependency
and context boundaries, licences, pinned-image proof, and audit are green. No
migration, database, schema, setup or referee path changes. A reviewer-generated
65-blob Git manifest over those protected paths is byte-identical at base and
candidate, with SHA-256
`8A63BF6702AB2A9F9FE800C9485CAD4FC4EF700E795968809E46BC33DD04C7E4`.
The independently approved D-800 exact 58-migration / 110-table / referee 11/11
proof therefore remains applicable and was not needlessly recreated.

## D-803 repair verification

The production repair correctly:

- validates both Order295/296 outer hashes with their tenant-bound algorithms;
- validates the Order295 nested time hash without tenant and Order296 nested time
  hash with tenant;
- equality-binds Order287 status hashes and taxpayer/SEZ semantics to the timing
  roots; and
- returns separate supplier and recipient time-of-supply hashes.

I corrected the two hostile test helper outer rehashes locally to use
`sha256({ tenantId, ...evidence })`, then personally ran the exact wrong-algorithm
attacks. Both failed closed and focused proof passed `7/0/82`. Those temporary edits
were removed before recording this review. The production D-803 repair works, but
the candidate's complete-predecessor and permanent hostile-proof obligations remain
broken as described below.

## Blocking findings

### 1. Self-consistent non-emittable Order295/296 roots are accepted

Order297 does not fully replay the approved predecessor contracts before accepting
their tenant-rehashed envelopes.

- `validateTimeOfSupply` validates four lineage UUIDs but omits `segmentId`
  (`india-gst-accommodation-supply-nature-at-time-of-supply.ts:293-296`). I changed
  `segmentId` in both timing roots to `not-a-uuid`, recomputed the exact non-tenant
  Order295 nested hash, tenant-bound Order296 nested hash, and both tenant-bound
  outer hashes, recursively froze the complete input, and the composer returned
  `supply_nature_and_registrations_bound_at_time_of_supply`.
- `validateRecipient` accepts any exact-key non-null approval object without
  replaying its form/type, reference, validity, `in_force` status or evidence hash,
  and it does not require `approval === null` for a regular taxpayer (line 360). I
  attached `{ form: "invalid", reference: 7, validity: null, status: "expired",
  evidenceSha256: "bad" }` to the regular recipient, recomputed the exact
  tenant-bound Order296 outer hash, froze the input, and the composer accepted it.
- The supplier and recipient status evidence hashes are format-checked and
  cross-bound, but are not independently recomputed from the status envelope. I
  changed the supplier GST source evidence SHA, deliberately retained the now-stale
  `supplierRegistrationStatusEvidenceHash`, recomputed the exact tenant-bound
  Order295 outer hash, froze the input, and the composer accepted it.

One reviewer-only hostile test executed all three attacks and passed `1/0/3`, where
each expectation asserted the erroneous successful result. The test was removed
after proof. These inputs cannot be emitted by the approved Order295/296 builders,
so acceptance violates Order297's exact complete-root replay and malformed/
contradictory/cross-lineage fail-closed contract.

Required repair: replay every emitted timing lineage field (including UUID
`segmentId` and the predecessor's INR constraint); recompute the exact tenant-bound
supplier and recipient registration-status evidence hashes from the available
tenant, identities, GST status, date, legal rule and approval fields; and fully
validate the exact Order296 approval union, including regular/null and SEZ
form/validity/status/hash semantics. Add self-consistent fully rehashed attacks for
each repaired invariant.

### 2. The committed D-804 hostile proof is not zero-effect

The committed `rehashSupplier` and `rehashRecipient` helpers compute
`sha256(evidence)` instead of the approved
`sha256({ tenantId, ...evidence })`
(`tests/india-gst-accommodation-supply-nature-at-time-of-supply.test.ts:135-142`).
Consequently the wrong nested-time-algorithm cases can fail at the enclosing outer
hash even if the predecessor-specific validator is broken.

Reviewer mutation proof confirms this is material:

- I temporarily restored the exact pre-D-803 behavior that accepts either nested
  time hash algorithm for either predecessor. All committed focused tests still
  passed `7/0/82`.
- I temporarily removed both new taxpayer/SEZ cross-root comparisons. All committed
  focused tests again passed `7/0/82`.

All source/test mutations were restored byte-for-byte before the retained review
edit. D-801 makes exhaustive hostile zero-effect proof mandatory, and D-804's claim
that self-consistent attacks cover each repaired mismatch is therefore not
reproducible. Correct both outer rehash helpers and add fully rehashed supplier and
recipient taxpayer/SEZ semantic crossings so deleting any repaired comparison makes
the focused suite red.

## Reviewer-executed evidence

| Proof | Result |
|---|---:|
| Focused Order297 intentional + hostile suite | `7 pass / 0 fail / 82 expectations` |
| Impacted Orders287/295/296/297 suite | `28 pass / 0 fail / 9 expected DB skips / 644 expectations` |
| Corrected exact D-803 wrong-hash hostile fixture | `7 pass / 0 fail / 82 expectations` |
| Non-emittable complete-root acceptance proof | `1 pass / 0 fail / 3 accepted attacks` |
| Pre-D-803 accept-either mutation against committed suite | suite remained `7 pass / 0 fail / 82 expectations` |
| Removed taxpayer/SEZ cross-bind mutation against committed suite | suite remained `7 pass / 0 fail / 82 expectations` |
| Full standing suite | `1,043 pass / 0 fail / 880 expected skips / 15,986 expectations`; `1,923 tests / 340 files` |
| TypeScript / import boundaries / licences | green; `120` TypeScript files / `23` packages |
| Container pins / dependency audit | `4/0/7`; zero vulnerabilities |
| Ancestry / exact 14-file scope / static containment / diff | green |
| Database/schema/setup/referee Git blobs | byte-identical to D-800 base |

## Verdict

Exact repaired candidate `eeaf8709953d6f0e38b7633dece7eb217f9c2881` is
**CHANGES REQUIRED**. The narrow production D-803 hash repair is present, but the
composer still accepts self-consistent roots that approved predecessors cannot emit,
and the committed hostile tests do not detect removal of two D-804 repairs. No
approval, integration, merge, local promotion, deployment, Phase-7 completion or
application-complete authority is granted. A repaired exact candidate requires a
fresh independent Tier-3 re-review.
