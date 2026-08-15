# ORDER 016 — resolve CI application and database ports through Compose

**Phase:** 0 · **Branch:** `phase-0/ci-compose-port-resolution`
**Written by:** Claude (architect role, `claude-opus-5`)
**Date:** 2026-08-15 · **Tier:** 2
**Source:** finding F8 in `handoff/reviews/008-015-phase-0-cumulative.md` · **Decision:** D-81

## Goal

Make every CI step address the service it is actually testing, so no step can pass
against a container belonging to a different Compose project.

## Why now

Order 014 removed the fixed *container name* for PostgreSQL and resolved it through
Compose. The same job still hardcodes a fixed *host and port* in four places, which is
the same assumption wearing different clothes. This is the last thing between Phase 0 and
a CI run that means what it says.

## Finding — demonstrated, not theorised

During review 008-015 a Compose project was brought up with **zero application
containers**:

```
$ docker compose ps --quiet app | wc -l
0
$ curl -s -w 'status=%{http_code}' http://127.0.0.1:3000/health
status=200 body={"status":"ok"}
$ docker ps --format '{{.Names}} {{.Ports}}' | grep 3000
yellow-order-008-app-1 0.0.0.0:3000->3000/tcp
```

The health verification returned a green 200 with the exact expected body, answered by a
container from another project. Run inside that project, the step would have certified an
application that was never started.

GitHub runners are isolated, so CI is not currently reporting falsely. The hazard is
local and pre-merge — precisely the multi-project worktree configuration D-76 endorses —
and it fails toward **false PASS**, which is the direction that costs the most.

## Scope — the only file Codex may change

- `.github/workflows/ci.yml`

Start from the reviewed head plus this order commit. Do not change Compose, scripts,
tests, dependencies, migrations, fixtures, generated snapshots, or documentation.

## The four hardcoded sites

| Line | Current | Belongs to |
|---|---|---|
| 83 | `curl … http://127.0.0.1:3000/health` | container smoke job |
| 180 | `curl … http://127.0.0.1:3000/health` | database job |
| 104–106 | `ADMIN_URL` / `DEPLOYMENT_URL` / `INVARIANT_URL` → `@127.0.0.1:5442` | database job env |
| 191 | `YELLOW_DSN: … host=127.0.0.1 port=5442` | referee step |

## Required change

1. **Resolve the application address from Compose**, not from a literal. Use
   `docker compose port app 3000` and use its `host:port` output for the health probe.
   Same tool Order 014 already chose for the container name — ask Compose, don't assume.
2. **Resolve the PostgreSQL published port the same way** (`docker compose port postgres
   5432`) and build the three database URLs and `YELLOW_DSN` from it.
3. **Empty resolution is a hard failure.** If either `docker compose port` returns empty,
   the step fails with a message naming the service. It must never fall back to a
   default, `|| true`, or an unresolved variable that curl turns into a different target.
4. **Line 83 is a different case — handle it correctly, don't force the pattern.** The
   container smoke job runs `docker run` directly, not Compose, so `docker compose port`
   does not apply there. Either publish to an ephemeral port and read it back with
   `docker port`, or keep a fixed port and add a pre-flight check that the port is free
   and that the container answering it is the one this job started. State which you chose
   and why in the PR body.
5. **Preserve everything else**: the 30-attempt bound, one-second interval, the exact
   body assertion `{"status":"ok"}`, HTTP 200, pinned images, job ordering, and the
   `if: always()` teardown.

## Implementation constraint worth knowing before you start

`ADMIN_URL`, `DEPLOYMENT_URL` and `INVARIANT_URL` are currently **job-level `env:`**,
evaluated before any container exists, so they cannot be derived there. Move them to a
step that runs after the PostgreSQL health wait and export them via `$GITHUB_ENV`, or set
them per-step. Do not try to make job-level `env:` call `docker compose`; it cannot, and
discovering that is not worth a cycle.

## Definition of done

- [ ] `rg -n '127\.0\.0\.1:3000|port=5442|@127\.0\.0\.1:5442' .github/workflows/ci.yml`
      returns no matches in the Compose-based database job
- [ ] Both health probes address a Compose-resolved `host:port`
- [ ] Empty resolution fails the step with a message naming the service
- [ ] **Negative test, and this is the one that matters:** in a project with the `app`
      service *not* started, the health step **fails**. Paste that failing output in the
      PR body. A green run does not demonstrate this fix; a correctly-red one does.
- [ ] Positive test under a nondefault `COMPOSE_PROJECT_NAME` **and** nondefault
      `YELLOW_APP_PORT` / `YELLOW_POSTGRES_PORT`: full database job green end to end
- [ ] `docker compose config --quiet` and `git diff --check` pass
- [ ] Final referee still prints `11 passed, 0 failed of 11`
- [ ] No file outside Scope

## Forbidden in this order

- Reintroducing any fixed container name, host, or port in the Compose-based job
- `|| true`, `continue-on-error`, a bare `sleep`, or relaxing `healthy` to `running` on
  any gate
- Weakening the exact-body assertion to a status-code-only check
- Touching Compose, `setup.sh`, `setup.ps1`, `state.sh`, scripts, tests, fixtures,
  generated snapshots, or documentation
- Editing `migrations/` or `tests/run_invariants.py` — both architect-only (D-69, D-73)
- Changing any domain, tenancy, RLS, occupancy, journal, or fiscal logic
- Opening, approving, or merging any PR

## Deferred review protocol

If implementing this reveals that a fifth site is also position-dependent, or that
`docker compose port` behaves differently on the runner than locally, **stop and write
`handoff/questions/016.md`**. Do not widen scope to fix it in passing — that is how a
two-line correction becomes an unreviewable diff.

## Open questions already answered

> **Q:** Should the fix be env-var defaults (`${YELLOW_APP_PORT:-3000}`) instead of
> asking Compose?
> **A:** No. Defaults restate the assumption rather than removing it — a stale or unset
> variable silently reproduces exactly the bug this order exists to fix. Compose already
> knows the published port; ask it. (D-81)

> **Q:** Does this block the cumulative Phase 0 integration PR?
> **A:** No. Nothing shipped is wrong and GitHub's isolated runners are unaffected. This
> is required before Phase 1 work begins, not before 008–015 merges. (D-81)

> **Q:** Is a green CI run sufficient proof?
> **A:** No. Green proves the happy path, which was already green while the bug existed —
> that is what made F8 invisible. The negative test is the proof. (Review 008-015, F8)

## Review requirement

Tier 2: one architect approval plus a test that would fail if the property broke. The
negative test in the Definition of Done is that test. The builder does not merge.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
