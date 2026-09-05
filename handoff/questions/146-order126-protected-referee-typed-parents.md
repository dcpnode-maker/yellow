# Question 146 — Strict occupancy parents conflict with the protected referee

**Status:** RESOLVED — D-371 selects option 1
**Order:** 126 · occupancy caller tenant binding
**Branch:** `phase-5/occupancy-caller-tenant-binding`
**Current question head:** `0a7eac4acc0c0a6763402a2f3442ded3e9a9cf63`
**Related decisions:** D-362, D-363, D-364, D-371
**Protected file:** `tests/run_invariants.py`

## Confirmed contradiction

Order 126 requires `record_occupancy` to reject every `segment` slot unless an exact
same-tenant reservation segment and reservation already exist and match the requested
property, sellable mapping and period. The owner maintenance path is deliberately not
exempt. D-363 simultaneously requires the protected invariant referee to remain
byte-identical and pass its existing TC-12 races.

The referee cannot satisfy both requirements:

- `record()` at lines 36–51 opens an owner connection and calls
  `record_occupancy(..., uuid.uuid4(), 'segment', ...)` without creating a matching
  reservation or reservation-segment parent.
- TC-12.1 sends 50 such fabricated segment ids and requires exactly one winner.
- TC-12.2 sends one exclusive and six positional fabricated segment ids and requires
  the modes never coexist.
- TC-12.3 sends 40 fabricated segment ids and requires exactly six winners.
- TC-12.5 generates further fabricated segment ids for throughput and requires at
  least one committed claim.

With the strict Order-126 migration, every call must fail typed-parent validation
before PostgreSQL reaches the exclusion/capacity arbiter. The expected results become
zero winners and zero throughput. The dynamic UUIDs cannot be repaired in the static
seed fixture. This was confirmed by direct inspection of the protected file; no
referee or migration edit was made.

## Requested ruling

Choose one explicit compatibility policy before Order 126 resumes after independently
approved Order 129:

1. Authorize a separate Tier-3 prerequisite order that updates only the referee
   harness/fixture to create exact authoritative reservation and segment parents for
   every generated claim, while preserving the same 50→1 exclusive, private-vs-bed,
   40→6 positional, choke-point and throughput meanings. Recompute the protected hash
   and update its manifest under independent review.
2. Authorize a narrowly defined owner-maintenance bypass in the production occupancy
   function and prove that no runtime/deploy/app/public path can reach it.
3. Revise the strict typed-parent contract.

Recommended: **option 1**. The referee should exercise the production authorization
contract rather than rely on fabricated parents. Option 2 creates a privileged
production escape hatch, and option 3 would weaken the exact sealed-finding fix.

If option 1 is selected, the prerequisite order must preserve every existing referee
assertion and concurrency size, pre-register an exact old-harness red against the
strict migration, prove the new harness fails when parent validation or occupancy
arbitration is weakened, keep all non-occupancy referee behavior byte-equivalent where
possible, and receive independent Tier-3 review before Order 126 can claim pristine
11/11.

Until resolved, Order 126 remains blocked. Its strict uncommitted migration and focused
6/6 proof remain preserved; neither may be relaxed to make the referee pass.

## Founder ruling

On 2026-08-25 the founder explicitly selected option 1. D-371 authorizes only the
separate Order-130 fixture/referee repair with preserved race strength and independent
Tier-3 review. It rejects an owner bypass and any weakening of strict typed-parent
validation. Order 126 remains blocked until Order 130 is independently approved.

## RESOLVED

Resolved by D-371 selecting option 1 and authorizing the bounded Order 130 repair.
