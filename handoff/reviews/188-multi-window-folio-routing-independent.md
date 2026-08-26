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

---

## Re-review — repaired candidate `0713b7b`

**Conclusion:** STATIC/FINANCIAL-APPROVED · AUTHENTICATED-P7-BROWSER-PENDING

**Exact candidate:** `0713b7b58e37df58416b9a083f5d2d1e14fbad7f`

The only product delta after the rejection is the exact version-20 filename and
checksum tuple appended to the existing exact migration ledger fixture. The migration
file itself hashes to
`137c9aea660aea953b86b8bdb1233af6385ddf73daa01a25bfa3149af416d9f1`, matching the
new tuple. No migration, schema, runtime, domain, HTTP, UI, seed, dependency or
protected file changed.

The reviewer personally rebuilt `yellow_test` from zero and reran the rejected gate:
schema drift matched, database acceptance passed **6/6 with 13 assertions**, and a
second migration invocation was an exact no-op. Fresh P1–P6 proof passed **30/30 with
353 assertions**, including every Order188 financial, authority, concurrency, hostile
and rollback case. A separately rebuilt fixture database contained exactly 85 public
tables and the protected referee passed **11/11**.

The reviewer also reran the standing suite (**258 passed, 501 database-gated skipped,
0 failed, 3,335 assertions**), typecheck, 68-file import boundaries, 23-package licence
policy and dependency audit. The operator assets are byte-unchanged at combined gzip
**98,168 / 98,304 bytes**. The repaired range passes `git diff --check`; exact diff
from the rejected governance head contains only
`tests/database-acceptance.integration.test.ts`.

Authenticated P7 remains unexecuted because action-time confirmation to type the local
review credential is still absent. No credential was entered or inspected, no
transient browser harness was started, port `:3188` is unbound, and the approved sole
`:3000` app remains listening and untouched. Consequently this verdict approves the
schema, financial behavior, authority, concurrency, static contracts and all
non-credential gates, but does not approve local replacement, promotion, merge, push,
deployment, production, Phase-wide completion or the required authenticated browser
matrix. Full Order188 approval still requires P7 on this exact candidate.

---

## Authenticated P7 retry — browser unavailable

**Conclusion:** P7-PENDING · NO PRODUCT FINDING · NO PROMOTION APPROVAL

After the founder explicitly authorized action-time entry of the existing local-only
review credential, the reviewer started one direct transient Bun harness on loopback
`:3188` against the disposable review database. Health returned the exact
`{"status":"ok"}` response, while the independently approved app remained the sole
listener on `:3000` and was not restarted, replaced or inspected.

Before any credential entry, the previously selected in-app browser binding became
unavailable. The reviewer followed the browser and bootstrap troubleshooting
instructions; fresh target selection reported no browser available, and the one
permitted browser inventory returned an empty list. Browser policy forbids substituting
an unrelated browser-control surface or source-code workaround. Therefore no password,
token or other credential was read, typed or transmitted, and no authenticated DOM,
workflow, screenshot, transition, viewport, zoom, forced-colour, reduced-motion,
keyboard/pointer, target-size, overflow, console or request-error claim is made.

The transient process was then stopped cleanly. Port `:3188` is unbound and `:3000`
remains bound by its original process. The STATIC/FINANCIAL approval at `0713b7b`
stands; full Order188 approval and every promotion/integration action remain blocked
on a browser-capable independent execution of authenticated P7 on that exact product.
