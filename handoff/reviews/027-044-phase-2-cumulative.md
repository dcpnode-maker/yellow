# REVIEW 027–044 — Phase 2, cumulative exit gate

**Range:** Orders 027–044 · **Reviewed at:** `6bfd2c5`
**Reviewed by:** Claude Opus 5 (architect role) · **Date:** 2026-08-22
**Verdict:** **APPROVED WITH ONE CHANGE REQUIRED (F10)**

Phase 2 was reviewed as a single gate. The handover's §7 defined only two gates
(019–026, 027–036) because Orders 037–044 did not exist when it was written; the
founder directed that 027–044 be taken as one Phase-2 gate rather than inventing a
third boundary. Executed under D-84 — every proof re-run first-hand.

## Battery

Same isolated db-only project as Review 019–026, app never started:
`RESULT: 11 passed, 0 failed of 11`.

## Pre-registered proofs — reviewer-executed

| Order | Tier | Proofs | Result |
|---|---|---|---|
| 027 constitution assessment | 2 | documentation deliverable, no executable proof | n/a |
| 028 inventory configuration | 3 | P1–P6 | **6 pass, 0 fail** |
| 029 hold-expiry hardening | 3 | P1–P3 | **2 pass, 0 fail** |
| 030 audited cart holds | 3 | P1–P8 | **9 pass, 0 fail** |
| 031 truth availability | 3 | P1–P8 | **7 pass, 0 fail** |
| 032 rate configuration | 2 | P1–P7 | **7 pass, 0 fail** |
| 033 exact bigint prices | 3 | P1–P7 | **7 pass, 0 fail** |
| 034 price supersession | 3 | P1–P6 | **6 pass, 0 fail** |
| 035 restriction config | 2 | P1–P6 | **6 pass, 0 fail** |
| 036 restriction evaluation | 3 | P1–P5 | **5 pass, 0 fail**, 78 expects |
| 037 + 039 OOO/OOS lifecycle | 3 | P1–P7 | **7 pass, 0 fail** |
| 038 OOS sellability policy | 2 | P1–P6 | **6 pass, 0 fail** |
| 040 blocks → availability | 3 | P1–P6 | **6 pass, 0 fail** |
| 042 operator workbench | 3 | P1–P7 | **7 pass, 0 fail**, 76 expects |

**81 proofs, 0 failures.**

## Whole-tree self-check

| Check | Result |
|---|---|
| `bun run typecheck` | pass |
| `bun run boundaries` | pass — 36 files scanned |
| `bun run license-check` | pass — 23 packages |
| `bun run schema:check` | **`Schema matches tests/schema/expected.sql`** — no drift |
| `bun test` (full suite, every gate enabled) | **194 tests / 31 files, 194 pass** |

### One reviewer error, recorded so it is not mistaken for a defect

My first full-suite run reported `193 pass, 1 fail` —
`fresh deployment database acceptance > contains only the exact canonical demo tenant
and property`. That was **my** invocation error, not a build defect. I had pointed
`YELLOW_DATABASE_ACCEPTANCE_URL` at `yellow_test`, which the fixture seed and ~30 other
suites write to (`tenants=2, org_nodes=4`); the test asserts a *fresh deployment*
contains exactly one tenant and one property. CI provisions a dedicated
`yellow_ci_deployment` database for it (`.github/workflows/ci.yml:292-297`). Re-run
against `yellow_dev` (`tenants=1, org_nodes=1`): **4 pass, 0 fail**. True result is
194/194. This is the D-88 precondition/assertion distinction, and it is exactly the
shape of D-160 — an environmental cause producing a truthful red.

## What's right — specifically

**The proof D-149 recorded as failing genuinely passes now.** Order 037 P7 —
twenty concurrent OOO opens — was red at 16.08 s with at least one raw non-domain
rejection from repeated `space_occupancy` deadlocks. After Order 039's deadlock
classification it returns **exactly one PostgreSQL winner in 74 ms**. I re-ran the
failing proof rather than accepting the correction on description.

**Order 031's performance proof was not weakened to get green.** D-141 records it at
1770.39 ms against a fixed 1000 ms ceiling, and the response was to optimize rather
than to raise the limit. On this machine: `options=500 max_ms=93.39`, inside budget
with an order of magnitude to spare. The assertion is still the original one.

**Money never becomes a JavaScript number.** `src/contexts/rates/pricing.ts` types every
monetary field as `bigint`, reads `amount_minor` as `string` at the SQL boundary, and
`requireAmount` rejects anything that is not a non-negative `bigint` within
`MAX_BIGINT`. D-135 is implemented as written, and D-146's arbitrary-precision JSON
trap is the reason the boundary is typed this way.

**The occupancy choke point is intact.** No `INSERT INTO space_occupancy` exists
anywhere in `src/`; the only writers are two `record_occupancy(` call sites
(`holds.ts:204`, `operational-blocks.ts:190`). TC-12.4 proves direct insert is refused
with `42501`, and Order 030 P8 re-proves it through the application path.

**Loopback hardening is real at both layers.** All three Compose services publish on
`127.0.0.1:` explicitly, and `src/server.ts:runtimeHostname()` refuses a non-loopback
`HOST` when the workbench is enabled unless `YELLOW_OPERATOR_ALLOW_NON_LOOPBACK=1`,
with `maxRequestBodySize` cut from Bun's 128 MiB default to 16 KiB. D-155 and D-158
are implemented as written.

## Changes required

### F10 — `state.ps1` reports success after failing to produce a report

**`state.ps1:11-70`** · Severity: moderate · Surface: D-58 ground truth

`state.ps1` wraps its whole report in `try { … } finally { … }` with **no `catch`**,
and then, after the block, unconditionally executes:

```powershell
$global:LASTEXITCODE = 0
```

A terminating error inside the `try` — a `CommandNotFoundException` from a missing
native probe is one — aborts the entire report, runs `finally`, and then falls through
to that line. The caller receives **exit 0 with no state**.

**Reproduced by execution**, not by reading. On this machine `git` is absent from the
Windows PATH (it exists only inside WSL):

```
> powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...\state.ps1
YELLOW state · Compose project yellow-review
git : The term 'git' is not recognized ... At state.ps1:14 char:15
=== EXITCODE ===
0
```

The header line printed. `Git:`, `Open work:`, `Open orders:`, `Service …:` and
`Phase:` never printed. Exit code 0.

**Why it matters.** D-58 makes this the first thing every session reads, and Order 044
existed specifically to make that report accurate. The handover's own words about the
stale phase line — "a wrong one is worse than none" — apply with more force to a
*silent* one that also claims success. `state.sh` does not have this failure mode: it
guards every git call with `|| true` and degrades to a partial-but-labelled report.

**What to do instead.** Order 041 and D-152 are correct that an *optional native probe*
(`docker info` against an absent daemon) must not leak its status. The defect is that
the reset was applied to the whole script rather than to that probe. Set a
`$reportComplete = $true` as the final statement inside `try`, add a `catch` that writes
the failure to stderr and exits non-zero, and gate `$global:LASTEXITCODE = 0` on
`$reportComplete`.

**Note on D-89.** The handover carried forward that the Windows surface "cannot be
reviewer-executed on any machine this project owns". That is true of the *GitHub
windows-state runner job*, and `git.exe` is indeed absent here, so `state.sh`'s
`git.exe`/`wslpath` fallback is unreachable dead code on this machine and has never
executed. But `state.ps1` itself **is** locally executable via
`powershell.exe -ExecutionPolicy Bypass -File`, and doing so is what found F10. D-89
should be narrowed to the CI job rather than the whole Windows surface.

## Observations — not blocking

1. **`docker-compose.yml:12`** sets `YELLOW_OPERATOR_ALLOW_NON_LOOPBACK: "1"`
   unconditionally for the `app` service, so D-155's application-layer loopback guard
   is inert on the shipped Compose path. The container must bind `0.0.0.0` to be
   reachable through Docker's port mapping, so this is defensible — but it means the
   host binding `127.0.0.1:${YELLOW_APP_PORT}` is the *only* remaining control. If that
   binding is ever widened, nothing at the application layer objects. Worth a comment in
   the compose file naming the host binding as the load-bearing control.
2. **`handoff/ARCHITECT-HANDOVER.md` is stale at the reviewed tip.** It is byte-identical
   to its state at `a113ca8` and still records the debt as "Orders 019–036" and
   "D-95 → D-141 (47)". The tree carries Orders 019–044 and D-95 → D-160 (66). Order 044
   was titled "make handoff state review-accurate" and correctly fixed `state.sh` under
   D-159, but left the handover's §1 table and §4 scope untouched. §4's order of attack
   is still sound; only its bounds are wrong.
3. **`DECISIONS.log` numbering is not resolvable below D-63.** Numbered entries begin at
   D-63; everything earlier is unnumbered dated prose. Orders and decisions nonetheless
   cite "D-10", "D-14", "D-16", "D-49", "D-58" — Order 019 rests its central requirement
   on D-10 — and those citations cannot be resolved by searching the file. Backfilling
   the numbers would make the most-cited decisions in the project traceable.
4. **`state.sh` prints an empty branch field in a detached worktree**
   (`Git:  · 6bfd2c5 · clean`). A reviewer worktree is the normal detached case, so
   printing `(detached)` would read better. Cosmetic.

## Invariant check (reviewer asserts each)

- [x] tenant_id leads every new index — the only new indexes in range are on
      `consumer_cursor`/`consumer_processed`, deploy-owned non-tenant metadata, proved
      RLS-free and revoked from `app_role`/`PUBLIC` by Order 022's first test
- [x] money is bigint minor units — `pricing.ts` bigint throughout, `requireAmount` guard
- [x] no UPDATE on insert-only tables — no UPDATE/DELETE on `fact_log` in `src/`
- [x] occupancy writes go through the choke point only — two `record_occupancy(` sites,
      no direct INSERT; TC-12.4 `42501`
- [x] every cross-context effect emits an outbox event in the same transaction —
      037 P6 and 038 P4 both roll every artifact back on publisher failure
- [x] any new view carries `security_invoker = true` — no new views in range;
      TC-13.4 `views=2 security_invoker=2`
- [x] state transitions exist in STATE-MACHINES.md — updated in range (+28 lines)

## Merge posture

I am not merging this. Per D-115 and the founder's direction, this review lands on
`review/architect-019-044`, unmerged, for the founder to act on. My recommendation is
that F10 be fixed in a bounded order before Phases 1 and 2 integrate to `main`; nothing
else in the range blocks integration.
