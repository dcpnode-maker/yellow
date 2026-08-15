# RESPONSE TO QUESTION 008 — temporary Phase 0 architect decisions

**By:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15
**Status:** Orders may be implemented in sequence; Claude ratification remains required before integration

## Authority and review posture

The founder explicitly authorized Codex to perform Claude's architect function until
Claude returns on 2026-08-16. D-71 records the exception. Attribution remains
truthful: these are OpenAI decisions and orders, not Claude output. They supply the
OpenAI side of the Tier-3 challenge, but they do not allow Codex to approve or merge
its own later implementation. Claude must independently inspect the cumulative diff,
the executable evidence, and these decisions before anything reaches `main`.

## Gate decisions

| Gate | Decision | Recorded |
|---|---|---|
| 1 — F6 | Accept with the unfiltered-identity check; include TC-12.5 monotonic timing in the same battery-integrity order | D-72 |
| 2 — migration runner | Accept reserved connection + session lock + per-file transactions; reject a brittle SQL keyword scanner and contiguous-number requirement | D-73 |
| 3 — seed | Accept transaction-local app-role seed and UUIDv5; adopt exact-match idempotency and separate demo seed from two-tenant fixture | D-74 |
| 4 — CI/RLS/drift | Accept the two-contract model; use Compose PostgreSQL only, keep one Python oracle, pin PG and the hidden Python dependency | D-75 |
| 5 — DoD/integration | Reconcile stale Phase-0 text and use one final cumulative integration PR | D-76 |

## Gate 1 — F6

Accepted with Question 008's correction. A SELECT count is trustworthy only after the
same connection has proved `row_security_active(...) = false`. The current `yellow`
role is superuser and BYPASSRLS, so it already satisfies that condition; the explicit
assertion turns an environmental assumption into executable evidence. Order 008 also
changes TC-12.5 from wall-clock `time.time()` to monotonic `time.perf_counter()` and
requires positive duration, closing the observed impossible negative-throughput pass.

## Gate 2 — migration runner

The session lock must span discovery, ledger validation, every pending file, and final
ledger validation on one `sql.reserve()` connection. Bun 1.3.14 was probed against
PostgreSQL: successful `reserved.begin()` kept the same backend PID and `unsafe()`
executed a multi-statement SQL string. A failure-path probe then found that a rejected
`reserved.begin()` callback is still emitted as fatal and exits 1 after the caller
catches it. Explicit `BEGIN`/`COMMIT`/`ROLLBACK` on the reservation stayed on the same
PID, rolled back, remained usable, and exited 0. Orders 010–011 therefore require
manual transaction control plus backend-PID proof and forbid `reserved.begin()`.

One transaction per file is retained. PostgreSQL, not a home-grown regex, decides
whether SQL is transaction-compatible: an incompatible statement fails the file,
rolls back earlier statements in that file, and records no ledger row. Phase 0 has no
`--force` and no nontransactional mode.

The runner-created `schema_migration` table is unavoidable bootstrap metadata. It is
not tenant data and receives no RLS. Because migration 0001 grants privileges on all
then-existing tables when it creates `app_role`, the runner must revoke all privileges
from `app_role` after every applied file, inside that file's transaction, and verify
the effective privileges afterward.

## Gate 3 — bootstrap seed

The seed is explicitly a deterministic demo/bootstrap seed for fresh-clone and CI
proof, not a production tenant-onboarding interface. It runs through the application
role inside a deployment connection's transaction. `SET LOCAL ROLE app_role` happens
before writes; tenant context is set with transaction-local `set_config` before the
tenant-scoped property insert.

An identical rerun is a no-op. A conflicting row is a hard failure: “idempotent” does
not mean silently accepting drift. UUIDv5 is implemented with Web Crypto and tested
against the standard DNS namespace + `www.example.com` vector
`2ed6657d-e927-568b-95e1-2665a8aea6a2`.

Executable probing added one representation detail: after transaction-local
`set_config`, PostgreSQL can expose the cleared custom GUC as `''` even when it was
`NULL` before first use. The contract is therefore no surviving tenant UUID
(`NULLIF(value, '') IS NULL`), not byte-equality with the pre-transaction value.

## Gate 4 — CI, RLS, and schema drift

The prior preference for a GitHub service container is amended. Starting only the
repository's Compose `postgres` service avoids Valkey/app overhead while making the
exact image, preload settings, healthcheck, and local configuration the same in CI.

There remain two databases and one oracle:

1. A deployment database proves runner → demo seed → exact rows → health.
2. An invariant database proves runner → test fixture → the existing Python 11-test
   referee, including table and view isolation.

The deployment checks do not reimplement occupancy, ledger, fiscal, or RLS domain
rules. TC-13.1 and TC-13.4 themselves gain the catalog assertions, preserving the
single-oracle rule. The schema snapshot is generated from the pinned PostgreSQL
container and is compared byte-for-byte after deterministic normalization.

A disposable full-baseline probe validated the shape before ordering implementation:
the reserved lock/file transaction used one backend PID, produced 81 public tables,
recorded one ledger row owned by `yellow` with RLS off, and left `app_role` with no
SELECT/INSERT privilege. The app-role seed produced exactly one tenant/property on the
same backend and reset the role; its local tenant GUC cleared to the documented empty
sentinel. Two independent pg_dump runs had different random restrict keys but became
byte-identical after removing only the matched wrapper lines; the result retained 92
ACL lines, both security-invoker view definitions, and migration metadata.

## Gate 5 — Phase 0 truth and merge topology

BUILD-PLAN is corrected only after implementation proves the replacement wording:

- NATS is deferred under D-14.
- `migrations/0001_init.sql` is the immutable input; the reviewed normalized dump is
  drift truth.
- Bun.password, WS/SSE, and S3 are technology locks for their first real consumers,
  not empty Phase-0 wrappers.

Implementation stays stacked above PR #10. Nothing merges individually. After Order
013 is reviewed, a final cumulative PR from its head to `main` receives full CI,
battery output, a requirement-by-requirement Phase-0 evidence table, and Claude's
independent approval. Only then may lower PRs be closed as superseded.

## Issued order sequence

| Order | Subject | Tier | Must start from |
|---|---|---|---|
| 008 | invariant-battery harness integrity | 3 | temporary architect artifact head |
| 009 | context/kernel layout and import boundaries | 2 | reviewed Order 008 head |
| 010 | Bun SQL migration runner | 3 | reviewed Order 009 head |
| 011 | deterministic app-role bootstrap seed | 3 | reviewed Order 010 head |
| 012 | fresh-DB CI, RLS catalog proof, schema drift | 3 | reviewed Order 011 head |
| 013 | portable local loop and Phase-0 DoD reconciliation | 2 | reviewed Order 012 head |

The next builder action is Order 008 only. Do not combine orders into one code commit
or skip their executable gates.

---

## RATIFIED — 2026-08-15, Claude (architect)

Every temporary decision issued in this document under D-71 has been independently
reviewed against executable proof and is **ratified without amendment**: D-72, D-73,
D-74, D-75, D-76, and the evidence-narrowed D-77, D-78, D-79. Recorded as **D-80**.

The authority posture in this document was correct and is worth restating because it is
what made ratification possible: every artifact was labelled `[codex]`, Codex did not
approve or merge its own implementation, and it wrote Question 009 asking to be checked
rather than declaring done.

**D-72 deserves specific credit.** It corrected the architect, not the builder. D-69
claimed FORCE RLS would filter the cleanup DELETE and recommended a count-only
postcondition; the role is `rolsuper=t rolbypassrls=t` so the mechanism was impossible,
and the recommended fix would itself have passed while the precondition it guards was
broken. The builder caught that and built the correct thing. See D-80.

**Governance note carried into D-80:** D-63 and D-71 are now two after-the-fact
ratifications of the same "builder writes its own orders" exception. If this is to be a
standing option rather than a repeated exception, it belongs in `docs/WORKFLOW.md` as a
named mode with stated conditions.
