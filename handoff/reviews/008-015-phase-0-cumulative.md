# REVIEW 008–015 — Phase 0 cumulative stack

**Answers:** `handoff/questions/009-phase-0-cumulative-review-request.md` (at `63eca4a`)
**Range reviewed:** `b602af9..7e7b19b` — 27 commits, 80 files, +11868/−268
**Reviewed by:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-15
**Verdict:** **APPROVED WITH FOLLOW-UP.** Merge permitted — see the D-84 note below.
*(Originally issued as "reviewer 1 of 2, do not merge yet"; unblocked 2026-08-15.)*

The technical work is sound and every builder claim reproduced first-hand. This stack
touches Tier-3 surfaces (RLS assertions, the migration runner), which under **D-84**
requires one architect-role reviewer plus proof the reviewer executed themselves — the
bar this review meets. Codex built it and still cannot review or merge it.

One new finding (**F8**) is a false-PASS hazard in CI. It does not block this merge —
it is not in what ships and GitHub's isolated runners are unaffected — but it needs
Order 016 before Phase 1 work starts.

---

## How this was verified

Every command below was run first-hand in WSL2 Ubuntu-24.04 against a **nondefault
Compose project** (`yellow-review-009`, postgres on host port 5455) so it could not
accidentally inherit state from the running `yellow-order-008` stack. Bun 1.3.14,
Python 3.12 with psycopg2 2.9.12, Docker 29.7.2. Nothing here is a pasted result.

The review branch is `phase-0/review-009-cumulative` at `7e7b19b`.

---

## Builder claims — every one reproduced

| Claim | Reproduced | My observed value |
|---|---|---|
| Immutable baseline SHA-256 unchanged | ✅ | `fe2a9fc9…b30923` at **both** `b602af9` and `7e7b19b` |
| No commit touches `migrations/` | ✅ | `git log b602af9..7e7b19b -- migrations/` → empty |
| Migration integration suite 12/12 | ✅ | 12 pass, 0 fail, 61 expects, 47.8s |
| Seed integration suite 9/9 + no-op rerun | ✅ | 9 pass, 0 fail; rerun `status=no-op` |
| Database acceptance 4/4 | ✅ | 4 pass, 0 fail |
| Normalized snapshot stable across dumps | ✅ | two consecutive dumps byte-identical |
| Snapshot SHA-256 `3524262…E0EBA7` | ✅ | `352426240d04ec…dee0eba7`, and it **matches the committed `tests/schema/expected.sql`** — three-way match |
| Drift check passes | ✅ | `Schema matches tests/schema/expected.sql` |
| 81 public tables explained | ✅ | 81 total, 80 excluding `schema_migration` |
| Two nondefault Compose projects coexist | ✅ | `yellow-review-009` (5455) + `yellow-order-008` (5442) both healthy |
| `down` without `-v` leaves the other healthy | ✅ | all three order-008 containers healthy; both pgdata volumes survived |
| Exact health body `{"status":"ok"}` | ✅ | verbatim |
| 37 runnable Bun tests, licence gate, audit, typecheck, boundaries | ✅ | 37 pass / 29 skip / 0 fail; licence gate **23 packages**; audit clean; `tsc --noEmit` clean; boundaries OK, 14 files |
| Final referee `11 passed, 0 failed of 11` | ✅ | on a database built by the **new runner**, not legacy `setup.sh` |

The referee's own output is now self-describing, which is worth noting because it is
what makes the RLS claim auditable rather than assertable:

```
PASS  TC-13.1  table RLS: A sees 16, B sees 0  A=16 B=0 tenant_tables=73 rls=73 policies=73
PASS  TC-13.4  view RLS: each tenant sees only itself  A:2rows B:1rows views=2 security_invoker=2
RESULT: 11 passed, 0 failed of 11
```

---

## Prior findings F1–F7 — all closed, each proven independently

| # | Was | Now | My proof |
|---|---|---|---|
| **F1** | headers on matched routes only | fixed | `.onAfterHandle` + `.onError`. Probed live: `GET /health` 200 → 6/6; `GET /nope` 404 → **6/6**; `GET /a/b/c` 404 → 6/6; `POST /health` 404 → 6/6; `DELETE /health` 404 → 6/6. CSP intact on the 404. |
| **F2** | compiler unpinned, outside the gate | fixed | `typescript@7.0.2` in devDependencies, `typecheck: tsc --noEmit`. Licence gate now reports **23 packages, up from 21** — exactly the rising count F2 asked for as proof the compiler is inside the gate. |
| **F3** | test files enumerated by name | fixed | `include: ["src/**/*.ts","scripts/**/*.ts","tests/**/*.ts"]` |
| **F4** | UTF-8 BOM on `docker-compose.yml` | fixed | BOM scan across every tracked file: zero hits. CI enforces it as step 1. |
| **F5** | `OR` evaluated as `AND` | fixed | `parseOr` now builds an `{kind:"or"}` node instead of requiring both operands |
| **F6** | battery silently weakened | fixed, **better than specified** | see below |
| **F7** | `DECISIONS.log` untracked | holds | `git ls-tree 7e7b19b DECISIONS.log` → tracked at head |

---

## F6 — I was wrong on the mechanism, and the builder caught it

This is the most important thing in this review, so it goes above the new finding.

D-72 corrects D-69 on two points. **Both corrections are right, and I verified them.**

**1. My FORCE RLS claim was false.** I wrote that adding `FORCE ROW LEVEL SECURITY` to
`space_occupancy` would make the cleanup DELETE silently affect zero rows. Observed:

```
rolname | rolsuper | rolbypassrls
yellow  | t        | t
```

`yellow` is superuser **and** `BYPASSRLS`. FORCE RLS subjects the *table owner* to
policies; it does not touch superusers or `BYPASSRLS` roles. The scenario I described
cannot occur for this role. D-69's governance conclusion stands; its stated mechanism
was wrong and is now corrected in the record.

**2. My proposed fix was itself unsound.** I recommended asserting `count(*) == 0` after
the DELETE. D-72 rejects that, correctly: if RLS *were* filtering the connection, the
DELETE would remove zero rows **and** the verification SELECT would see zero rows, so the
assertion would pass while the dorm was still full. My fix would have produced exactly
the false confidence F6 was written to prevent.

What Codex built instead proves the *precondition* — that the connection is genuinely
not subject to RLS and genuinely holds DELETE — before deleting, and only then checks the
postcondition:

```python
cur.execute("SELECT row_security_active('public.space_occupancy'::regclass)")
cur.execute("SELECT has_table_privilege(current_user, 'public.space_occupancy', 'DELETE')")
if rls_active or not can_delete:
    raise RuntimeError("TC-12.3 harness configuration invalid: ...")
```

That is the correct shape and it is stronger than what Order 008 was asked to deliver.
**F6 closed. D-72 ratified.**

Two smaller strengthenings in the same commit, both correct and both unrequested:

- **TC-12.5** moved from `time.time()` to `time.perf_counter()` with a `dt > 0` guard.
  Wall clock can step backwards under NTP; a monotonic clock cannot. Right call.
- **TC-13.4 had a latent hole.** The old assertion was `count(DISTINCT tenant_id) == 1`
  for each tenant — which passes if tenant A sees *only tenant B's rows*, because that is
  still one distinct tenant. It now enumerates the actual values and requires
  `all(t == T_A)`. Given that the view-RLS leak is this project's one empirically proven
  breach (D-11), an assertion that could pass while leaking was worth removing.

**One tension to record so it is not re-litigated.** These harness failures `raise` rather
than emitting a `FAIL` line, which sits against D-52's preference for clean FAIL output
over stack traces. I judge the raise correct here and D-52 unthreatened: D-52 is about
*worker-thread* connection failures during a test; this is a top-level harness-validity
check, and an invalid harness must not be reported as a test result at all. No change
requested.

---

## F8 — CI can pass its health check against a container from another project · **new**

Order 014 replaced a fixed container name with `docker compose ps --quiet postgres`.
That fix is correct and I reproduced it: under `COMPOSE_PROJECT_NAME=yellow-review-009`
the wait resolved `/yellow-review-009-postgres-1` in 3 seconds.

But the same job still hardcodes host and port in three other places:

```
ci.yml:83   curl ... http://127.0.0.1:3000/health
ci.yml:180  curl ... http://127.0.0.1:3000/health
ci.yml:191  YELLOW_DSN: ... host=127.0.0.1 port=5442
ci.yml:104-106  ADMIN/DEPLOYMENT/INVARIANT_URL ... @127.0.0.1:5442
```

**Demonstrated, not theorised.** My review project had *zero* app containers:

```
$ docker compose ps --quiet app | wc -l
0
$ curl -s -w 'status=%{http_code}' http://127.0.0.1:3000/health
status=200 body={"status":"ok"}
$ docker ps --format '{{.Names}} {{.Ports}}' | grep 3000
yellow-order-008-app-1 0.0.0.0:3000->3000/tcp
```

The health verification returned a green 200 with the exact expected body, answered by a
container belonging to a **different Compose project**. Had that step run in my project,
it would have certified an application that was never started.

**Why it matters even though CI is currently fine.** GitHub runners are isolated, port
3000 is free, and the step genuinely tests its own app there — CI today is not lying.
The hazard is local and pre-merge: D-76 explicitly endorses Compose project isolation
with configurable host ports for worktrees, which is precisely the configuration where
this misfires. And it fails in the dangerous direction — a false PASS, not a false FAIL.

**Severity: follow-up, not blocking.** Nothing shipped is wrong; the defect is in the
verification harness's portability. Blocking a 27-commit, fully-reproduced stack on it
would be disproportionate. But it should be **Order 016**, before Phase 1 work begins,
because a health check that can pass without the thing under test is the same category
of defect as F1 and F6: a gate agreeing with the bug.

**Suggested shape:** derive both from the same env the Compose file already reads —
`YELLOW_APP_PORT`/`YELLOW_POSTGRES_PORT`, defaulting to 3000/5442 — or resolve the
published port from `docker compose port app 3000`. The second is preferable: it asks
Compose, which is the fix Order 014 already chose for the container name.

---

## Per-order verdict

| Order | Concern | Head | Verdict |
|---|---|---|---|
| 008 | invariant-battery preconditions | `3e37e0d` | **APPROVED** — exceeds the order |
| 009 | context layout / import boundaries | `19f871c` | **APPROVED** — 14 files scanned, gate green |
| 010 | Bun SQL migration runner | `56f55fa` | **APPROVED** — 12/12 incl. lock release on kill, rollback, collision |
| 011 | deterministic app-role seed | `d662fae` | **APPROVED** — 9/9, rerun exact no-op |
| 012 | fresh-database CI and schema drift | `9720953` | **APPROVED** — 4/4, snapshot three-way match |
| 013 | portable setup/state and DoD reconciliation | `c5104d7` | **APPROVED** |
| 014 | Compose-resolved CI database health | `a421e6b` | **APPROVED as scoped** — correct, incomplete; see F8 |
| 015 | Windows walkthrough Compose command | `7e7b19b` | **APPROVED** — `docker compose exec`, 81 explained inline |

## Review-focus items from Question 009

1. **CI-equivalent path + battery re-run** — done, all green, on a nondefault project.
2. **Tier-3 surfaces reviewed first** — referee correction, runner semantics, RLS
   catalog+behaviour, generated snapshot. All verified. See F6 and the claims table.
3. **`0001_init.sql` byte-identical; no predicate weakened** — SHA identical at both ends
   of the range; no commit touches `migrations/`; the referee's domain assertions were
   *strengthened*, never relaxed, and TC-12.1/12.2/12.4/5.4/5.6/7.1/8.2 are unchanged.
4. **Nondefault `COMPOSE_PROJECT_NAME` health wait** — reproduced; resolves through
   Compose. But see **F8** for what the same job still hardcodes.
5. **Runner/seed failure paths** — covered by the 12 and 9 passing integration tests:
   transaction rollback with preserved SQLSTATE, session-lock release when a child runner
   is killed, exact-collision hard-fail, credential redaction in CLI output, and
   role/tenant-context reset. Reproduced, not read.
6. **Onboarding paths** — **checked, and I found nothing wrong.** README explains
   "80 baseline + `schema_migration` = 81"; START-HERE-WINDOWS expects 81; `setup.sh` and
   `setup.ps1` both invoke `migrate.ts` + `seed.ts` and assert 81 with the explanation in
   the failure text. `USAGE.md`'s "80 tables" describes `migrations/0001_init.sql` itself,
   which is correct — the 81st table is added by the runner, not the file. Recorded so it
   is not re-flagged.
7. **Are 014 and 015 sufficient?** 015 yes. 014 correct but incomplete — **F8**, Order 016.

---

## Governance — D-71 ratified, with the pattern named

D-71 is the founder authorising Codex to write orders while I was unavailable. That is
the founder's call to make and I ratify it. Codex did the three things that make such an
exception survivable: it labelled every artifact `[codex]`, it did not approve or merge
its own work, and it wrote Question 009 asking to be checked rather than declaring done.

The pattern is still worth naming, because this is its second occurrence — D-63 ratified
the same thing for Orders 001–006 and set the rule "if no architect is available, the
builder writes `handoff/questions/NNN.md` and **waits**." D-71 overrode that rule by
founder direction rather than amending it. Two ratifications-after-the-fact make a
precedent. If the founder wants this to be a standing option rather than a repeated
exception, it should be written into `docs/WORKFLOW.md` as a named mode with its
conditions, so the next occurrence is following a rule instead of overriding one.

**Ratified:** D-71, D-72, D-73, D-74, D-75, D-76, D-77, D-78, D-79. No amendments.
D-72's correction of my D-69 is accepted in full and verified above.

D-77, D-78 and D-79 deserve specific credit: each records a decision *narrowed by
executable evidence* that contradicted the original assumption — Bun's `reserved.begin`
failure semantics, PostgreSQL's cleared-GUC representation, and pg_dump's random
`\restrict` token. That is the house standard working exactly as PROJECT.md describes it.

---

## ⚠ SUPERSEDED — merge is unblocked (2026-08-15, D-84)

The section below described a block that **no longer applies.** The founder amended D-59:
Tier 3 now requires **one architect-role reviewer plus proof the reviewer ran themselves**,
not two reviewers from different vendors. `handoff/ROSTER.md` is updated.

This review satisfies the amended bar: every claim in it was executed first-hand, not
pasted. **Verdict is therefore APPROVED, and the cumulative Phase 0 integration PR may
proceed** per D-76. Codex still must not open, approve or merge it.

The original section is kept verbatim below rather than deleted, because the reasoning
that led to the block is what D-84 had to answer, and a review that quietly rewrites its
own conclusion is not evidence. The architect recommended against the amendment; the
founder overruled; D-84 records both and the residual risk.

---

## Merge conditions — why this is not approved to merge *(superseded by D-84)*

Per D-59 and `handoff/ROSTER.md`, Tier 3 is a property of the change, not the author, and
requires **two reviewers from different vendors plus executable proof**. This stack is
squarely Tier 3: it rewrites the RLS assertions in the canonical referee and introduces
the migration runner that every future phase's schema will pass through.

- Executable proof: **satisfied** — everything above was run, not read.
- Reviewer 1 (vendor: Anthropic/Claude): **this review**.
- Reviewer 2 (different vendor): **does not exist.** Codex is the builder and is
  disqualified from reviewing its own implementation under D-60.

So the correct state is: technically approved by the reviewer who exists, and blocked on
a roster gap rather than on a defect. The founder has three options, and this is a
founder decision, not mine to make:

1. Add a third vendor to `handoff/ROSTER.md` and have it review the Tier-3 surfaces.
   Cleanest, and D-60 already describes adding an agent as a config entry.
2. The founder personally acts as reviewer 2 for this stack, recorded as such.
3. Amend D-59 to allow a single-vendor Tier-3 review under stated conditions. I would
   argue against this: the cross-vendor rule is the one control that was bought with a
   real incident — the view-RLS leak that two same-vendor paper reviews both missed, and
   which is the exact surface this stack modifies.

Nothing else blocks. When reviewer 2 signs off, open the single cumulative integration PR
per D-76 with the order/commit table, CI links and the 11/11 output. **I have not merged
anything and have opened no PR.** Codex must not approve or merge it either.

## Required before Phase 1

- **Order 016** — F8. Resolve the app port and the referee DSN through Compose rather
  than hardcoding `127.0.0.1:3000` and `port=5442`.

## Not defects — recorded so they are not re-litigated

- Harness-validity failures `raise` instead of printing `FAIL`. Correct; D-52 governs
  worker-thread failures during a test, not an invalid harness. See above.
- `USAGE.md` says the baseline is 80 tables. Accurate — that is the file, not the
  migrated database.
- The CI health-wait loop uses `set -euo pipefail` with `health="$(docker inspect …)"`,
  so a service with no healthcheck block would abort the loop rather than retry. The
  Compose `postgres` service defines one, so this cannot fire today. Noted, not changed.
- `psycopg2-binary==2.9.12` as a pinned CI-only LGPL test dependency (D-75) — reproduced
  as installed and working; correct not to ship it in the application image.

---

## Reviewer's note

The single most valuable thing in this cycle was not a fix. It was D-72 telling me my
own finding's reasoning was wrong, with a concrete reason and an executable check that
proves it. My F6 recommendation, had it been implemented as written, would have produced
a test that passes while the precondition it guards is broken — the precise failure mode
I raised F6 to prevent. The builder caught it, said so in the record, and built the
correct thing instead.

A review loop where correction only flows one direction is not a review loop. This one
flowed both ways, and the artifact is better for it.
