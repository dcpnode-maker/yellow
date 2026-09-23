# Orders 362 / 361 / 360 / 353 exact-scope snapshot proof — fresh Tier-3 review

**Verdict:** WITHHOLD

**Reviewer:** `/root/order362_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact subject:** unchanged production `b6aaa1f`; proof candidate `b89d422` plus
fixture hardening `a90d3a6`; governance `cd392b4`

## Blocking finding

Three independent mutants each survived a fresh 63-migration complete authority
suite at **14/0 (608)**:

1. removing both ordinal comparisons survived because the reordered fixture also
   swapped business dates and was rejected by the date guard;
2. removing `value <= 0n` survived because the zero-night fixture retained total
   1,500,000 and was rejected by the sum guard; and
3. changing candidate `set_config(..., true)` to session-level `false` survived,
   including the colliding-UUID case, so transaction-local context was not proved.

These directly fail D1023's mutation-sensitive ordinal, positive-night and
transaction-local RLS requirements. Broad gates cannot substitute for them.

## Fresh baseline and other gates

- Exact catalogue: `63/116/106/15/2`.
- Unmodified authority suite: **14/0 (608)**.
- runtime-DML: **5/0 (120)**.
- SECURITY-DEFINER: **3/0 (192)**.
- Acceptance after canonical seed: **23/0 (65)**; the unseeded 22/1 run is excluded.
- Migration integration passed its first 23 cases and was stopped after the decisive
  mutants; no completion claim is made.

Standing, schema, seeds and referee were not repeated because the mutation finding
already blocks disposition.

## Required repair

Add isolated permanent cases that corrupt only ordinal authority; persist a zero
night while adjusting total so other guards remain satisfied; and detect leaked
session-level tenant context after transaction completion while retaining the
colliding same-UUID fixture. A different fresh Tier-3 reviewer must kill all three
mutants and rerun the complete Order362 gate matrix.

Unique review database/container/network/volume and worktrees were removed. Stable
port3000, `.yellow`, candidate, merge, push and deployment were untouched.
