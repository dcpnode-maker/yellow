# Order 337 — India GST accommodation numeric component-rate split

**Status:** REVIEW-WITHHELD-PROOF-SENSITIVITY-D944
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-numeric-component-rate-split`
**Base:** `25db385` (approved Orders335–336 governance head)
**Risk tier:** 3 — statutory tax-rate decomposition; fresh independent executable review mandatory

## Outcome

Close Order310's explicit numeric-rate-authority gap for intra-State accommodation:
revalidate one complete approved levy-component-identity result and derive the exact
per-component rate schedule for CGST+SGST or CGST+UTGST. Preserve IGST as the already
authorized sole-component aggregate schedule.

## Exact contract

- Accept the complete Order310 input graph and supplied Order310 result; rerun Order310
  and require byte-exact equality rather than trusting a public evidence hash.
- For `igst`, preserve the aggregate GST_ROOM schedule exactly once and identify each
  aggregate rate as the IGST rate.
- For `cgst_sgst`, derive an ordered `[cgst,sgst]` schedule in which each component is
  exactly one half of every approved aggregate basis-point rate.
- For `cgst_utgst`, derive an ordered `[cgst,utgst]` schedule in which each component is
  exactly one half of every approved aggregate basis-point rate.
- Reject non-integral halves, changed slab bounds, changed ITC/nil semantics, component
  order changes, duplicated aggregate schedules, thawed graphs and surplus authority.
- Return recursively frozen, tenant-hidden deterministic evidence bound to the complete
  Order310 result and official source identities.

## Source basis

- CBIC's current goods-and-services rate table presents intra-State service rates as
  matching central and State/UT components beside the aggregate integrated rate.
- Notification 11/2017-Central Tax (Rate) is the central-rate authority for intra-State
  services; the corresponding State or Union-territory levy supplies the matching half.
- The already approved historical/active accommodation aggregate schedules and their
  effective-date lineage remain authoritative; this order does not re-decide them.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap;
- one pure tax-fiscal module plus context export;
- intentional-red and permanent hostile/mutation-sensitive unit proof;
- bounded contract/domain/security/QA documentation;
- fresh non-implementing Tier-3 executable review evidence.

## Forbidden boundary

No SQL/database/migration/schema/RLS/grant/seed/writer; no taxable-value selection,
tax amount, rounding or residual allocation; no Section14/calendar, zero-rating,
reverse charge/payer, account/posting/correction, item/document/IRP/API/UI/local,
merge/deploy or Phase/application-complete authority.

## Pre-registered proof

- **P0 red:** the numeric component-rate builder/export is absent.
- **P1 exact split:** 5% becomes ordered 2.5%+2.5%; 12% becomes 6%+6%; 18% becomes
  9%+9%; IGST remains a single unchanged aggregate rate.
- **P2 ancestry:** complete Order310 inputs are replayed and byte-matched; coherent
  predecessor, family, schedule, source and final-hash mutations fail closed.
- **P3 hostility:** odd basis points, reordered identities, changed bounds/ITC/nil,
  duplicate/surplus fields and thawed/proxy/accessor/symbol/sparse graphs fail closed.
- **P4 containment:** output is frozen and contains no value, amount, rounding,
  posting, document or submission authority; standing/static preservation stays green.

## Definition of done

- [x] Intentional red precedes production.
- [x] Focused mutation-sensitive proof is green.
- [x] Standing/static and unchanged database/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Builder evidence — D943

- Intentional red failed before production because the new export did not exist.
- Focused Order310+337 proof passes `10/0` with 236 assertions; the adjacent
  Orders306/308/309/310 set passes `37/0` with 679 assertions.
- Standing proof passes `1154/0` plus 890 expected environment skips with 17,579
  assertions across 2,044 tests/376 files.
- Typecheck, 128 import boundaries, 23 dependency licences, audit0 and diff hygiene
  pass. No database, migration, schema, seed, role, writer or local-runtime artifact
  changed, preserving the approved 59-migration/110-table/referee11/11 lineage.
- Exact implementation candidate: `4f29fd5`. Fresh non-implementing Tier-3 review is
  mandatory before this statutory rate authority is approved.

## Fresh independent Tier-3 review — D944

- Reviewer `/root/order334_fresh_tier2` withholds exact candidate `4f29fd5` on
  permanent-proof sensitivity only; source semantics and all executed gates have no
  product finding.
- The committed proof exact-checks component values only for the first 5% slab. For
  12% and18% it checks only that component basis points sum to the aggregate. A
  reviewer-only semantic mutant using 599+601 basis points for12% and 899+901 for18%
  survives that assertion pattern, although both violate the required equal halves.
- Fresh focused/adjacent proof passes48/0(961), standing1154/0 plus890 expected skips
  (17579;2044 tests/376 files),typecheck,128 boundaries,23 licences,audit0,diff and
  database/runtime/local preservation checks pass. Official CBIC material confirms
  matching central and State/UT halves beside the integrated aggregate.
- Required repair: permanently equality-bind `rateBasisPoints` and `rate` for every
  component of every historical and active slab, including exact 6%+6% and9%+9%, for
  both dual families; rerun all gates and obtain a different fresh Tier-3 rereview.
