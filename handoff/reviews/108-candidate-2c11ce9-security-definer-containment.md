# Independent review — separate-branch Order 113/108 candidate

**Subject:** `phase-5/security-definer-containment` branch candidate — NOT the
current-line Order 108 implementation (that is reviewed separately in
`handoff/reviews/108-security-definer-containment.md`, executable SHA
`ee4ec0c48d7ebb62328454f2df3c22ed665108a7`).

**Result:** APPROVED — this candidate safely contains the documented SECURITY
DEFINER temporary-schema shadowing vulnerability and is suitable evidence for
Codex to integrate onto the current Yellow application line. This review does
not itself merge, rebase, or integrate anything.

**Candidate commit:** `2c11ce9a0bb455ddd0a7dcb4bfe3a342c5179e43`
("[codex] contain security definer shadow paths")

**Vulnerable parent commit (exact, used for P0):**
`3d27a9c0dd73bd48542edc0146ca916250f3e3fa`
("[codex] preregister security definer exploit proof")

**Order-text commit (ancestor):** `16ad3cfd07bf8ab4ee65ef7b78ab30660888e052`
(`handoff/orders/113-security-definer-containment.md` — this branch's original
numbering; the current line later renumbered the equivalent order to 108)

**Branch base:** `52f8b0c` (descends from `4c2720c`, the commit that added the
Order-104 financial-postings suite to the cumulative runner — confirmed by
`git log --oneline` ancestry)

**Reviewer:** Claude, independent non-implementing reviewer, founder-invoked.
Did not author this candidate. Did not merge it. Did not review pasted output —
every result below was personally executed.

**Date:** 2026-08-24

## Method

Two isolated `git worktree` checkouts (`2c11ce9` and its exact parent
`3d27a9c`), plus one disposable Docker Compose project
(`COMPOSE_PROJECT_NAME=order108cand`, ports 3401/5643/6589) distinct from both
the live `yellow-*` stack and any prior review stack. Nothing here touched the
live containers, the live branch (`phase-5/security-definer-containment-current`,
currently at `89cd032`), or any other worktree. Both review worktrees and the
disposable stack were removed after the run; `git status` on the main tree is
unchanged (only the pre-existing untracked `.agents/`, `.codex/hooks.json`,
`handoff/chat-archive/`).

## P0 — hostile red on the exact vulnerable parent (personally executed)

Migrated a fresh database using the parent worktree's own `migrations/`
directory (real files from `3d27a9c`, ten files, no reconstruction):

```
DATABASE_URL=postgres://yellow:yellow@127.0.0.1:5643/yellow_parent_p0 \
YELLOW_MIGRATIONS_DIR=/tmp/order108-parent/migrations \
bun run db:migrate
→ migration applied: 0001_init.sql … 0010_financial_posting_integrity.sql
  migration summary: applied=10 status=applied
```

Then ran the pg_temp shadow/hostile-trigger exploit via `psql` (adapted from
the candidate's own test file, executed as raw SQL against the pre-fix schema):
direct `app_role` insert into an owner-protected probe table, creation of
`pg_temp.outbox` and `pg_temp.business_day` shadow relations with hostile
`BEFORE`-triggers, then calls to `prune_outbox` and `seal_business_day` as
`app_role`.

**Result — red confirmed:**
- Direct `app_role` INSERT into the protected probe: denied, `42501` (control
  case, expected).
- `prune_outbox(interval '30 days')` as `app_role`: **succeeded silently**
  (returned `1`, no permission error) — its unqualified `DELETE FROM outbox`
  resolved to `pg_temp.outbox`, firing the attacker's trigger.
- `seal_business_day(...)` as `app_role`: **succeeded silently** (no
  exception) — its unqualified `UPDATE business_day` resolved to
  `pg_temp.business_day`, firing the attacker's trigger.
- Owner-protected probe table after both calls:

  | surface        | observed_role |
  |----------------|---------------|
  | business_day   | yellow        |
  | outbox         | yellow        |

  Both hostile triggers executed with deployment-owner authority
  (`observed_role = yellow`), a full privilege escalation from `app_role` to
  the database owner via unqualified-name resolution inside `SECURITY DEFINER`
  functions. This matches the order's documented P0 exactly and independently
  corroborates the sealed Cyber scan finding
  (`e2a116cd-6e6d-4c8d-a741-9fa5c9f33fbb` / `occ_3e8dc89f07118473ce5c182e`)
  without relying on that scan's own report.

## P1–P4 on candidate `2c11ce9` (personally executed)

```
COMPOSE_PROJECT_NAME=order108cand YELLOW_APP_PORT=3401 YELLOW_POSTGRES_PORT=5643 \
YELLOW_VALKEY_PORT=6589 ./setup.sh --db-only
→ 11 passed, 0 failed of 11 (pristine 85-table referee, RLS 75/75)

YELLOW_REQUIRE_SECURITY_DEFINER=1 \
YELLOW_SECURITY_DEFINER_URL=postgres://yellow:yellow@127.0.0.1:5643/yellow_dev \
bun test tests/security-definer-containment.integration.test.ts
→ 3 pass, 0 fail, 21 expect() calls
```

(The candidate's own describe-block and one error string say "Order 113" —
this branch predates the current-line renumbering to 108; see Scope
verification below. Assertions are otherwise identical to the current-line
suite — confirmed by direct `git diff`, see below.)

Fresh migrations 0001–0011 (post-fix): hostile temporary objects are inert —
the identical pg_temp-shadow attack embedded in the test's own P0 case no
longer writes an owner-authority marker, `prune_outbox`/direct `expire_holds`
calls fail closed `42501`, `seal_business_day` fails closed `P0012`, and
domain truth (real `outbox`, real `business_day`) is left untouched by every
denied path. Occupancy claim/release and tenant-scoped `app.tenant_id`
behavior are exercised and pass in the same run (P3/P4 assertions).

Table-level and view-level tenant isolation (RLS) were independently exercised
by the standing referee's own TC-13.1/TC-13.4 cases in the `setup.sh` run
above: tenant A sees 16 rows / tenant B sees 0 through tables (75/75 RLS
tables and policies), and each tenant sees only its own row through views
(`security_invoker` confirmed on both).

## Six SECURITY DEFINER functions — direct inspection

`migrations/0011_security_definer_containment.sql` in the candidate is
**byte-identical** to the current-line implementation's file at
`ee4ec0c48d7ebb62328454f2df3c22ed665108a7` — confirmed by
`git diff ee4ec0c:migrations/0011_security_definer_containment.sql
2c11ce9:migrations/0011_security_definer_containment.sql` returning empty, and
by independent `sha256sum` of the candidate's on-disk file:
`6c9af4f72fa6be5a2c0e256624620c7ee8cf61d709c3ca99a37cd126bbe57796`.

Because this exact content was already read function-by-function and
cross-checked against the original `0001_init.sql`/`0003_revoke_legacy_expire_holds.sql`/
`0010_financial_posting_integrity.sql` definitions during the current-line
review, that analysis applies unchanged here and is not repeated verbatim;
summary of what was independently confirmed for all six —
`record_occupancy`, `release_occupancy`, `expire_holds`, `prune_outbox`,
`assert_day_open`, `seal_business_day`:

- Exact function-level `SET search_path = pg_catalog, public, pg_temp` on
  every one of the six.
- Every Yellow relation and Yellow function call inside every one of the six
  is `public.`-qualified; no unqualified identifier remains.
- Signatures, return types, and defaults preserved exactly against the
  originals (parameter lists, `RETURNS uuid|int|bigint|void|trigger`,
  `p_retain interval DEFAULT interval '30 days'` unchanged).
- `REVOKE ALL … FROM PUBLIC, app_role` on all six, then `GRANT EXECUTE …
  TO app_role` on exactly `record_occupancy`, `release_occupancy`, and
  `seal_business_day` — no PUBLIC execution anywhere, and `app_role` cannot
  call `expire_holds`, `prune_outbox`, or `assert_day_open` directly (proven
  `42501` in the P1/P2 test case above).
- `assert_day_open` keeps working as a trigger function with no direct
  `app_role` grant — trigger firing does not require `EXECUTE` privilege on
  the trigger function itself, so this is correct, not an oversight.
- `prune_outbox` rejects negative retention with `22023` (new guard, required
  by the order's item 5, confirmed both in the test and the manual parent
  reproduction where the pre-fix version had no such guard at all).
- Occupancy claim/release, hold-expiry loop, day-open latch and day-seal
  authority checks are byte-identical in logic to the pre-fix versions except
  for qualification/search_path — verified by direct diff against
  `0001_init.sql`/`0010_financial_posting_integrity.sql` during the
  current-line review, applicable here unchanged since the file is identical.

## Scope verification — no unrelated changes

`git diff --stat 3d27a9c 2c11ce9` (the candidate's full changeset from its own
exact parent):

```
DECISIONS.log                                      |   1 +
docs/CONTRACTS.md                                  |   8 +
docs/SECURITY.md                                   |  10 +-
handoff/orders/113-security-definer-containment.md |   6 +-
migrations/0011_security_definer_containment.sql   | 208 ++++++++++++++++++++
scripts/run-phase-3-gate.ts                        |   7 +
tests/database-acceptance.integration.test.ts      |   5 +
tests/migrate.integration.test.ts                  |  66 ++++++-
tests/phase-3-gate-runner.test.ts                  |  11 +-
tests/schema/expected.sql                          | 125 ++++++++----
tests/security-definer-containment.integration.test.ts | 211 ++++++++++++++++++++-
11 files changed, 603 insertions(+), 55 deletions(-)
```

No unrelated migration, no new table/column/index, no new application
endpoint, no new event, no new state transition, no role or grant change
outside the six functions' own ACLs, no tenant-policy change. This matches
Order 113/108's own Scope and Forbidden lists exactly.

`git diff` of the candidate's test file against the current-line's
(`ee4ec0c`) version shows only cosmetic differences: the error string and
`describe()` label say "Order 113" instead of "Order 108", and one seeded
tenant/property display string says "Order 113" instead of "Order 108". The
deeper internal literals (`order113_owner_probe`, `order113_hostile_trigger`,
`'order113.property'`) are unchanged on **both** lines — this is a pre-existing
cosmetic leftover from the original numbering, present in the already-approved
current-line implementation too, not something introduced by or unique to this
candidate. Not a functional or security finding.

## Supporting proofs personally executed on the candidate

- `tsc --noEmit` — clean.
- `bun run boundaries` — OK, 62 files scanned.
- `bun run schema:check` (`YELLOW_SCHEMA_DATABASE=yellow_test`) — exact match
  to `tests/schema/expected.sql`.
- Protected hashes, independently recomputed on the candidate's own files:
  `migrations/0001_init.sql` = `fe2a9fc9…b30923`,
  `tests/run_invariants.py` = `3228279b…ad8befa1` — both match
  `handoff/GATE-3-MANIFEST.md` and the current-line review. `0001_init.sql`
  was not modified anywhere in this review.
- 15-suite cumulative gate (`scripts/run-phase-3-gate.ts`) — the candidate's
  own runner already contains all fifteen entries (confirmed by direct
  listing, lines 28–126 of the file), inherited from `4c2720c` on this
  branch's own base rather than needing the lineage repair the current line
  required (Question 137/D-334). Result: **15/15 suites passed**, zero
  failures anywhere in the full log (verified by grepping for `(fail)` /
  `FAILED` across the complete run — none found).
- `tests/migrate.integration.test.ts`
  (`YELLOW_REQUIRE_MIGRATION_DB=1`, admin URL pointed at `postgres`, not a
  protected database): **15 pass, 0 fail, 86 expect() calls**, including
  "applies exact SECURITY DEFINER containment and least-authority ACLs". Ran
  cleanly on this native-Linux/WSL host with no symlink error — the
  current-line's own Windows-native test run recorded one case skipped with
  OS `EPERM` on a temporary symlink (D-337); that host limitation did not
  reproduce here and is disclosed for completeness, not claimed as product
  evidence either way.
- `tests/database-acceptance.integration.test.ts`
  (`YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1`): **4 pass, 0 fail, 10 expect()
  calls**.

No Windows symlink `EPERM` was reproduced anywhere in this review; all work
ran on the native WSL filesystem under `/tmp`. Disclosed per instruction, not
a factor in the verdict.

## Residual limitations

- This review approves only the six-function temporary-schema containment on
  this candidate commit. It does not approve, fix, or re-assess caller-supplied
  tenant authority, runtime superuser/owner/BYPASSRLS connections, `RESET
  ROLE` pool behavior, the known/default JWT secret, actor-unbound
  idempotency, FORCE RLS deployment proof, or token-secret entropy — all
  explicitly named as separate, still-open findings by the order text itself.
- This candidate is **not an ancestor of the live application line** and is
  not, by itself, mergeable into `main` or the current-line branch. Its value
  is as independently verified provenance: proof that the fix pattern is sound
  and that its migration/test blobs are byte-identical to what Codex already
  carried onto the current line at `ee4ec0c48d7ebb62328454f2df3c22ed665108a7`
  (already separately reviewed and APPROVED in
  `handoff/reviews/108-security-definer-containment.md`).
- Per Stage 1 instructions, this review does not merge this candidate, does
  not rebase it, and does not touch the current-line branch.

## Verdict

**APPROVED** — candidate `2c11ce9a0bb455ddd0a7dcb4bfe3a342c5179e43` safely
contains the documented SECURITY DEFINER temporary-schema shadowing
vulnerability confirmed live on its exact parent `3d27a9c0dd73bd48542edc0146ca916250f3e3fa`,
and its migration/test evidence is suitable for Codex to treat as confirmed
provenance for the current-line integration. This verdict does not itself
authorize a merge; per the canonical rules, only an agent that did not
implement the change may merge, and only after the (separately filed) required
current-line review is green.
