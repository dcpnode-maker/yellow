# RESPONSE TO QUESTION 007 — architect decisions A–E

**Answering:** `handoff/questions/007.md`
**By:** Claude, architect role · **Date:** 2026-08-14
**Companion:** `handoff/reviews/001-006-phase-0-stack.md`

## Status summary — read first

| Decision | Tier | Status |
|---|---|---|
| **A** — 13 context slugs | 2 | **DECIDED** (D-67). Grounded in the schema, not opinion. |
| **B** — migration tracking model | 3 | **POSITION STATED. NOT DECIDED.** Needs second-vendor challenge. |
| **C** — launch seed tenancy | 3 | **POSITION STATED. NOT DECIDED.** Needs second-vendor challenge. |
| **D** — CI database / RLS / drift | 3 | **POSITION STATED. NOT DECIDED.** Needs second-vendor challenge. |
| **E** — Forgejo, Cloudflare Tunnel | — | **DECIDED** (D-68). Founder actions, not agent actions. |

`handoff/ROSTER.md` requires **two reviewers from different vendors plus executable
proof** for Tier 3. One architect session cannot satisfy that by writing more
confidently. B, C and D below are deliberately written as **attackable positions** —
specific enough that a second reviewer can disagree with something concrete — not as
decisions. No order may be written from them until that review happens.

The reason is in this project's own history, recorded in D-59: the view-RLS leak was
missed by two independent paper reviews and caught by a fixture that ran. Migrations,
seed tenancy, and RLS smoke tests are the same class of thing.

---

## Decision A — the 13 bounded contexts · **DECIDED**

**Your proposed slugs are correct. All thirteen. Adopt them as listed.**

This is not deference — the schema settles it. `migrations/0001_init.sql` numbers its
contexts explicitly in the section headers:

| Schema section | Header | Context № |
|---|---|---|
| §1 | IDENTITY & TENANCY | 1 |
| §2 | KERNEL PRIMITIVES | **none** |
| §3 | PARTY / CRM | 8 |
| §4 | INVENTORY & AVAILABILITY | 2 |
| §5 | RATES, POLICIES, PACKAGES | 3 |
| §6 | RESERVATIONS & GROUPS | 4, 9 |
| §7 | FINANCIALS | 7 |
| §8 | HOUSEKEEPING & STAY OPS | 5, 6 |
| §9 | DISTRIBUTION | 10 |
| §10 | TAX, FISCAL, STATUTORY, DATA PROTECTION | 11, 12 |
| §11 | REPORTING PROJECTIONS | 13 |

Contexts 1–13 are fully enumerated, and your slug list is exactly that sequence in
order. Canonical:

```
1 identity   2 inventory   3 rates      4 reservations   5 stay-operations
6 housekeeping   7 financials   8 crm    9 groups        10 distribution
11 tax-fiscal    12 statutory-privacy    13 reporting
```

**This also resolves the "12 vs 13" confusion that prompted the question.** The
research catalogue's 12 folds Contexts 11 and 12 together, exactly as schema §10 does
in one SQL section. The schema's *context numbering* is authoritative; its *section
grouping* is a file-layout convenience. They were never in conflict.

**§2 KERNEL PRIMITIVES carries no context number, and that is deliberate.** The
extension registry, `fact_log`, `outbox`, `document` and `task` are platform, not a
bounded context. Question 007 did not ask about this, but Order 008 would have had to
guess, so it is decided here:

- The kernel lives at **`src/kernel/`**, sibling to `src/contexts/`. It is **not** a
  14th context and must never be added to the list.
- **Any context may import `src/kernel/`. The kernel may import no context.** That
  acyclic rule is what stops the kernel becoming a junk drawer that every context
  reaches into and that reaches back.
- Contexts 5/6 ↔ stay-operations/housekeeping: the schema header lists housekeeping
  first, BUILD-PLAN Phase 6 lists stay ops first. The numbering is cosmetic and has no
  behavioural consequence. Fixed as 5 = `stay-operations`, 6 = `housekeeping`, recorded
  so it stops being re-litigated.

**A.2 — `index.ts` only.** No shared boundary types in the layout order. Branded
`TenantId` / `Money` / `BusinessDate` / `Period` belong to the kernel, which is Phase 1.
An empty `index.ts` per context, thirteen of them, and nothing else.

**A.3 — the import-boundary test.** A static test over `src/contexts/**/*.ts` using
`Bun.Glob`, zero dependencies. It fails when any import specifier resolves into
another context at a path deeper than that context's `index.ts` — i.e.
`../inventory/repo` fails, `../inventory` passes. Include a positive fixture (a
deliberately illegal import proven to fail) so the test is shown to be capable of
failing, not merely observed passing. A guard that has never failed is a guard nobody
has verified.

This is Tier 2 and unblocked. It is **not** Order 007 only because F1 in the review is
more urgent; expect it as Order 008.

---

## Decision B — migration tracking · **POSITION, NOT DECISION**

Your proposal — raw SQL over `Bun.sql`, lexical ordering, one transaction per
migration, checksums, advisory lock — is sound and consistent with D-16 (Bun-native).
My positions, offered for the second reviewer to attack:

1. **`schema_migration` table: yes.** A migration runner without durable state is not
   a migration runner. This is the approval AGENTS.md requires.
2. **Platform metadata, exempt from tenant RLS**, owned by the migration role, not the
   application role. **The application role gets no write grant on it** — if the app
   can write its own migration history, the history is not evidence.
3. **One transaction per file, not one for the whole pending set.** A half-applied set
   with an accurate ledger of what applied is recoverable. An all-or-nothing set that
   fails on file 7 of 9 in a way Postgres cannot roll back — any statement that cannot
   run in a transaction block — leaves state no ledger describes. Prefer recoverable
   over atomic here. *This is the position I most expect a second reviewer to contest,
   and it is the one worth contesting.*
4. **Checksum: SHA-256 of the file bytes, before any normalization.** Normalizing
   before hashing means a whitespace-only edit to an applied migration passes silently
   — which defeats the purpose.
5. **Mismatch hard-fails always, and hardest on the baseline.** `0001_init.sql` is the
   one file where a mismatch means an immutability rule was broken. No override flag.
   Not `--force`. If a baseline checksum ever mismatches, that is an incident.
6. **Advisory lock: one fixed 64-bit key**, derived from a literal string constant
   written in the source with a comment, never computed from a hostname, database name,
   or anything environment-dependent. Two runners must collide by construction.
7. **`migrations/0001_init.sql` stays byte-for-byte untouched.** Confirmed.

Your five proposed proofs are the right five. Add a sixth: **a migration containing a
statement Postgres cannot run inside a transaction block** — the runner must fail
loudly and record nothing, rather than partially applying. That case is what decides
whether position 3 above is right, and it is exactly the kind of thing that is cheap
to test now and expensive to discover in Phase 5.

---

## Decision C — launch seed · **POSITION, NOT DECISION**

1. **Deterministic UUIDv5** from a fixed namespace + a literal name string, both in
   source. Not `gen_random_uuid()`, not a hardcoded literal typed by hand. A seed you
   cannot re-derive is a fixture you cannot reason about.
2. **Seed runs as the application role, not the owner.** A seed that runs as owner
   proves nothing about RLS — it bypasses the very thing Phase 0 must demonstrate.
   This is the decision most likely to be quietly reversed the first time the seed
   fails; it must not be.
3. `SELECT set_config('app.tenant_id', $1, true)` inside the seed transaction, per
   invariant 5. Transaction-local `true`, never session `SET`.
4. **Idempotent no-op on repeat**, not update, not hard failure. Developers re-run
   seeds constantly; a seed that fails the second time gets `|| true`-d within a week,
   and a seed that updates silently overwrites local work.
5. **TypeScript using `Bun.sql`**, not a numbered SQL file. Seed data is not schema —
   putting it in `migrations/` makes it immutable and checksummed, which is wrong for
   something meant to evolve.
6. **Minimum proof:** two tenants, not one. Tenant A's context reads zero rows of
   tenant B **through tables and through views**, and the view test asserts
   `security_invoker = true` is actually set rather than assuming it. One tenant proves
   nothing about isolation — that is precisely how the leak in D-11 survived review.

---

## Decision D — CI database, RLS smoke, schema drift · **POSITION, NOT DECISION**

1. **PostgreSQL 16 service container, not the Compose stack.** CI needs the database,
   not Valkey and not the app image; the container-smoke job already covers Compose's
   concerns. But the service **must** carry the same `shared_preload_libraries`
   settings as `docker-compose.yml`, or CI is testing a different Postgres than
   developers run.
2. **Yes — CI exercises the application migration runner, never `psql -f`.** Your
   proposed answer is right. A CI path that loads schema differently from production
   tests a schema nobody deploys.
3. **The Python battery stays the referee. Do not add a parallel Bun smoke test.**
   Two RLS oracles that can disagree is worse than one that must pass. PROJECT.md
   names `tests/run_invariants.py` as *the* referee; adding a second creates exactly
   the "second source of truth" the never-do list forbids. If the battery is awkward
   to run in CI, fix the running, not the count.
4. **Schema drift compares a normalized `pg_dump --schema-only --no-owner --no-acl
   --no-comments`**, with a documented normalization step: strip `SET`/`SELECT
   pg_catalog.set_config` preamble, sort nothing (ordering is itself signal), and
   diff against a committed snapshot regenerated only by an approved order.
5. **Compare: tables, columns, types, constraints, indexes, functions, triggers,
   views, and policies.** Grants and comments are excluded from the *drift* diff and
   asserted separately by the battery — mixing ACL noise into a schema diff is how
   drift checks become permanently red and then permanently ignored.
6. **Yes — exercise both roles.** Owner and application. The owner path proves the
   data exists; the application path proves RLS hides it. Testing only the application
   role cannot distinguish "isolation works" from "the seed silently did nothing" —
   and those two look identical in a passing test.

Your five proposed proofs are correct and sufficient. Keep all five.

---

## Decision E — Forgejo mirror and Cloudflare Tunnel · **DECIDED (D-68)**

- **Forgejo mirror → category 2.** Required before first deployment, **not** part of
  repository Phase 0 DoD. `docs/DEPENDENCIES.md` calls it *"insurance for ~₹0"*, and
  insurance against GitHub is worth little while there is nothing deployed to lose.
- **Cloudflare Tunnel → category 3.** Deferred until the OCI hosts exist. There is no
  host to tunnel to.
- **Both are founder actions, not agent actions.** They require account creation and
  credentials. Your closing line in Question 007 — *"No agent should create accounts,
  expose ports, or invent target infrastructure"* — is correct and is now doctrine.

**Consequence, stated plainly: Phase 0 can be marked complete without either.** The
Phase 0 DoD is the repository proving the loop. Neither of these is in that loop.

---

## Revised order sequence

| Order | Subject | Tier | Blocked by |
|---|---|---|---|
| **007** | Phase 0 stack corrections (F1–F5) | 1 | Nothing — **written, ready to build** |
| 008 | 13 context dirs + import-boundary test | 2 | Order 007 merged |
| 009 | `Bun.sql` migration runner | 3 | **Decision B second-vendor review** |
| 010 | Idempotent launch seed | 3 | **Decision C second-vendor review** + 009 |
| 011 | Fresh-DB migrate/seed/RLS/drift CI | 3 | **Decision D second-vendor review** + 010 |
| — | Forgejo, Cloudflare Tunnel | — | Founder-provided targets; **not Phase 0** |

Your proposed sequence was right; it has shifted by one and gained explicit blockers.

## What is needed next, in order

1. Someone with a shell runs `./setup.sh --db-only` on the Order 001–006 branches and
   confirms `11 passed, 0 failed of 11`. **This review could not run it** — see the
   *Evidence limits* section of the review file.
2. Codex builds Order 007.
3. An independent reviewer challenges Decisions B, C and D — specifically position B.3
   (per-file vs all-or-nothing transactions), C.2 (seed runs as application role), and
   D.3 (no second RLS oracle). Those three are where I expect to be wrong.

---

## RESOLVED — 2026-08-15, Claude (architect)

The three items this document deliberately left as **POSITION, NOT DECISION** have all
been converted and discharged:

| Was | Became | Implemented | Reviewed |
|---|---|---|---|
| Decision B — migration tracking | **D-73**, narrowed by **D-77** | Order 010 (`56f55fa`) | 12/12 reproduced |
| Decision C — launch seed | **D-74**, narrowed by **D-78** | Order 011 (`d662fae`) | 9/9 reproduced, rerun no-op |
| Decision D — CI, RLS, drift | **D-75**, narrowed by **D-79** | Order 012 (`9720953`) | 4/4 + snapshot three-way match |

Each was challenged from a different vendor (Question 008, gates 2–4) before becoming a
decision, and each was then reviewed against executable proof in review 008-015. D-77,
D-78 and D-79 exist because the executable evidence contradicted the original
assumption — which is the outcome this document was holding out for.

**One caveat carried forward, unchanged:** this document's own reading of D-59 — that
Tier 3 needs two reviewers from different vendors — is why the cumulative stack is
still not merged. See the *Merge conditions* section of review 008-015. That is a
founder decision, not an architect one.
