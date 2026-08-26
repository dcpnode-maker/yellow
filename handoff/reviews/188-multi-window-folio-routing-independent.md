# Order 188 — multi-window folio routing independent Tier-3 review

**Conclusion:** CHANGES-REQUIRED

**Reviewed candidate:** `3ee48f60407055ca754c21567a0456ad4e63e707`

**Reviewer:** independent non-implementing OpenAI Codex agent

## Blocking finding

The mandatory fresh database-acceptance gate is red. Migration `0020` applies and its
schema is exact, but `tests/database-acceptance.integration.test.ts` still defines the
exact migration ledger only through `0019_financial_reversal_authority.sql`. On a
database recreated from zero, the test receives the correct additional `0020` row and
fails its exact equality assertion:

```text
5 pass, 1 fail
Expected migration ledger: 0001..0019
Received migration ledger: 0001..0020
0020 checksum: 137c9aea660aea953b86b8bdb1233af6385ddf73daa01a25bfa3149af416d9f1
```

This is an in-scope migration-acceptance fixture omission. Required repair: append the
exact migration-0020 tuple and committed checksum to `EXPECTED_MIGRATIONS`, then rerun
the complete Order188 proof on a new candidate. Do not weaken exact ledger equality.

## Reviewer-executed evidence

- P0: exact intentional-red predecessor `8e1e98f` failed **12/12** preregistered
  additional-window, lineage, transfer-domain, HTTP and UI assertions. The disposable
  detached worktree was removed afterward.
- Fresh disposable database on loopback `:5442`: migrations `0001`–`0020` applied from
  zero, exact **85 public tables**, schema drift green, migration replay a no-op.
- Referee: **11 passed, 0 failed of 11**, including occupancy races, immutable ledger,
  sealed day, gapless numbering and tenant isolation through tables/views.
- P1–P6 focused proof: **32 passed, 0 failed, 363 assertions**. This personally covered
  exact lineage constraints/index/ACL/owner/search path, pg_temp containment, runtime
  DML authority, raw and forged denial, 20-way gap-free window creation, replay and
  rollback, balanced whole-group routes, original-row immutability, zero-net stay
  truth, repeated routing, 20-way same-group race, publisher rollback, transfer versus
  correction arbitration, sealed/closed/foreign/hostile boundaries and static HTTP/UI
  contracts.
- Standing non-database suite: **258 passed, 501 database-gated skipped, 0 failed,
  3,335 assertions**.
- TypeScript typecheck green; import boundaries green over **68 TypeScript files**;
  licence policy green for **23 installed packages**; `bun audit` reported no
  vulnerabilities.
- Combined operator payload gzip: HTML 19,860 + CSS 17,853 + JavaScript 60,455 =
  **98,168 / 98,304 bytes**, leaving 136 bytes.
- Protected diff for `migrations/0001_init.sql`, `tests/run_invariants.py`,
  `docker-compose.yml` and `bun.lock` is empty. Candidate worktree was clean before
  governance evidence.

## Browser status

A direct transient Bun harness—not a second Docker app stack—ran healthy on loopback
`:3188` against the disposable `:5442` database. The approved sole app on `:3000`
remained listening and untouched. The in-app browser connected and verified the
signed-out candidate DOM, including the five appearances and three detail choices.

The authenticated P7 matrix did not execute because action-time confirmation to enter
the local review credential was not supplied. No password, token or other credential
was typed, transmitted or inspected. No authenticated workflow, screenshot,
structural-distinction, 200% reflow, forced-colour, reduced-motion, keyboard/pointer or
runtime-error claim is made. After the P8 defect was found, the browser tab was closed,
viewport reset, and the transient `:3188` process stopped; `:3000` remained bound.

## Re-review gate

Candidate `3ee48f6` is not approved and is not eligible for local replacement,
promotion, merge, push, deployment, production or Phase-wide completion. A corrected
candidate requires a fresh non-implementing Tier-3 review that reruns P1–P8, including
the fresh database-acceptance suite and the complete authenticated browser matrix.
