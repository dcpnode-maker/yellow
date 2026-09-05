# Order 295 independent Tier-3 review

**Current result:** APPROVED for exact candidate
`45b5ceba5d231f64eeabc0e1a5edc8932fb59ef0`

## Initial review

**Reviewer:** fresh non-implementing Codex Tier-3 agent
**Candidate:** `fe6cb55fc1f2d1135a0f0d1b7f928dca0250024c`
**Base:** `92f2036d6153069897ddcbf13a1456b89fd08fb3`
**Result:** CHANGES REQUIRED

## Finding

The candidate has no committed Order295 live PostgreSQL integration test. Its focused
test uses a mocked transaction, so it cannot prove the real schema, RLS, runtime role,
tenant concealment or zero-effect behavior required by the admitted order. Add a real
Order289+294 chain exercised through `yellow_runtime` / `app_role`, then submit a new
exact candidate for fresh executable review.

## Reviewer-executed evidence

- focused/adjacent: 14 passed, 0 failed, 159 assertions;
- standing: 1,028 passed, 871 expected database skips, 0 failed, 15,770 assertions;
- typecheck, 118 import boundaries, 23-package licence policy, audit 0 and diff green;
- independent source and official CGST sections 25/29/30 plus Rule21A inspection found
  no additional product defect;
- Docker Linux engine/required PostgreSQL16.15 was unavailable; host PostgreSQL17 was
  not accepted as substitute proof.

No approval or downstream authority is granted.

## Fresh executable re-review

**Reviewer:** `order295_fresh_live_review`, fresh non-implementing Codex Tier-3 agent
**Candidate:** `45b5ceba5d231f64eeabc0e1a5edc8932fb59ef0`
**Base:** `92f2036d6153069897ddcbf13a1456b89fd08fb3`
**Result:** APPROVED — no finding

The candidate is an exact descendant of the independently approved Order294 base.
Source and test blobs in the later evidence-only branch head were verified byte-identical
to the candidate before execution. The one tenant-leading SELECT revalidates the full
Order289 active-status envelope and full Order294 time-of-supply envelope, requires both
caller-selected hashes to match the independently recomputed hashes, and requires exact
`statusAsOf === timeOfSupplyDate`. It performs no write, lock, latest/nearest selection,
clock or network operation. Official CBIC CGST Act sections 25, 29 and 30 and Rule 21A
were independently inspected; treating a governed exact-date active snapshot as evidence
without inferring a validity interval is consistent with the date-effective statutory
states and the deliberately narrower Order295 boundary.

### Reviewer-executed evidence

- protected credentials were injected in-process and never printed; the canonical
  `./setup.sh --db-only` path against isolated PostgreSQL 16.15 applied all 58 migrations,
  produced exactly 110 tables, and passed the referee `11/11`;
- after that clean rebuild, the real two-tenant Order289+294 chain passed `6/6` with
  69 assertions through `yellow_runtime` -> `app_role` and transaction-local
  `app.tenant_id`;
- live proof covered exact success/hash replay, recursively frozen tenant-hidden output,
  tenant-A/B concealment, both selected predecessor-hash attacks, crossed identities,
  invalid date equality, duplicate storage identity and unchanged registration,
  attribution, fact, event, document, submission, journal, posting and idempotency counts;
- standing suite: 1,028 passed, 875 expected database skips, 0 failed, 15,770 assertions
  across 1,903 tests / 335 files;
- TypeScript, 118 import boundaries, 23-package licence policy, dependency audit (zero
  vulnerabilities), exact ancestry, scope, `git diff --check` and clean worktree passed.

Approval is limited to the migration-free, SELECT-only
`active_at_time_of_supply` evidence composer. It grants no registration interval,
rate, slab, exemption, ITC, section-14, levy, tax, document, journal, posting, IRP,
submission, API, UI, local promotion, merge, deploy, phase-complete or
application-complete authority.
