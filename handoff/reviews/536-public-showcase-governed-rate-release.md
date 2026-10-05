# Order536 independent review — 2026-09-21

Reviewer: non-implementing Codex Astra `/root/astra_review`.

## Verdict: REJECT pending canonical command repair; no apply

Read Order536, PROJECT.md, D-250/D-267 and runtime CONTRACTS sections8–15; inspected the complete provisioner, authoring compiler, operator JSON serializer/reconstruction and relevant publication boundaries. Existing APIs retain scope/property checks, immutable release references, exact preview/content approval binding and separate requester/decider-publisher. Hypothetical preview availability is not operational sellability proof; canonical live offers remain the later gate.

### Personally reproduced blocker

Initial script SHA-256 `6AA6FF5C4C3AAED1C4E76386E1B58AA18E6A5DFD3EF84A2F50962FBC9737714F` used raw JSON.stringify equality despite recursively key-sorted HTTP DTOs. Implementer repaired object-key ordering during review.

Revised SHA-256 `EFB39EAAD8958B6903169066AD5441F97302DA1C71B55F7B1571787066B32514` still fails the **actual authoring-compiler/HTTP-serializer roundtrip for LONDON**. London command arrays list KING,DLX,STE; the canonical compiler orders target/evaluator rule arrays by key, yielding DLX,KING,STE. The reviewed `same()` normalizes object keys but preserves arrays, so reconstructed authoringCommand differs. Locanda passes because its input rule order already matches normalization.

Consequently the current script can publish Locanda, create London's immutable draft trio, then abort at London's reconstructed-command guard. Do not run it against the target. Build and compare the ordinary canonical authoring output (retaining exact bigint-to-decimal HTTP conversion); do not apply arbitrary array sorting that could erase meaningful order in other fields. Add executable roundtrip tests for both complete scenario commands, not only string-presence tests.

## Personally executed commands/results

Runtime cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
bun test tests/yellow-public-showcase-rate-releases.test.ts
bun run typecheck
bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ESNext --module Preserve --moduleResolution Bundler --lib ESNext,DOM --types bun --skipLibCheck tools/provision-public-showcase-rate-releases.ts
bun tools/provision-public-showcase-rate-releases.ts
bun D:/Yellow/temp/astra-order536-source-proof.ts
```

- Initial static tests2pass/0fail/21assertions; revised static tests2pass/0fail/23assertions.
- Root typecheck exit0, but its tsconfig excludes tools; therefore explicit standalone strict tool check was also personally run, exit0. An initial standalone invocation without `--ignoreConfig` failed TS5112; corrected invocation above passed.
- Actual dry preflight exit0: properties2/unitTypes6/existingReleases0. This is API preflight only, not an all-history DB census.
- Reviewer-owned pure proof imports the actual canonical authoring compiler through the rates public module and extracts the actual operator HTTP serializer. Revised result: LOCANDA roundtrip and changed guest-bound rejection pass; LONDON canonical comparison fails, with differences localized to target/evaluator rule-array positions. No HTTP/database access in this proof.

The first pure-proof invocation raced the initial object-key repair, so it did not constitute frozen-byte evidence for the old defect; the final London failure is attributable to EFB39... . No `--apply` was performed. No protected approver environment/credentials were loaded, no approval/draft/release/price/reservation write occurred, and no provider or deployment was invoked. The required all-history extension/approval/fact/outbox/idempotency census was not reached because the deterministic source defect blocks safe execution.

Other preflight claims remain bounded: current-price inspection checks the two-adult tier rather than every Order535 row field; a later approved execution must personally verify complete raw six-row evidence and all-history release census before any write. No rate-release activation, four-eyes operational proof, canonical offer success, Order533 reservation replay or375px completion is claimed.

## Second repair and partial governed execution — current verdict BLOCKED

Script SHA-256 `4BD445E989F340A0EBB30051440B3FF25182C8AB6330CF024B1BFAA296036A80` orders London source units DLX,KING,STE, matching compiler normalization without general array sorting. Reviewer personally reran actual compiler/serializer proof: both complete commands pass and changed guest-bound semantics reject. Focused tests2pass/0fail/24assertions, explicit strict standalone tool typecheck exit0, dry preflight2properties/6unitTypes/0releases. Earlier review sections remain historical findings, not claims that these corrected comparison defects persist.

### Preflight actually established

`bun D:/Yellow/temp/astra-order536-census.ts before` performed tenant/property/plan-scoped `BEGIN READ ONLY` history census: each plan had extensions0, approvals0, facts0, outbox0 and known Order536 idempotency keys0. `bun D:/Yellow/temp/astra-order535-live-evidence.ts after` reconfirmed all six complete raw price rows plus exact actor-bound payload/fact/outbox/idempotency evidence. Tenant counts were reservation651/occupancy230/journal0.

`bun D:/Yellow/temp/astra-order536-run-protected.ts` loaded only the two required environment entries privately from the authorized protected env source, authenticated both users and verified distinct subjects/same tenant. No secret/token was printed. **This proved identity separation, not property authorization; that distinction caused the later blocker.**

### Actual single apply and retained partial state

```powershell
bun D:/Yellow/temp/astra-order536-run-protected.ts --apply
bun D:/Yellow/temp/astra-order536-census.ts after
bun D:/Yellow/temp/astra-order536-run-protected.ts --inspect-approver
```

The first attempted command launch used a mistyped nonexistent cwd and never started a process. Corrected launch personally ran exactly one governed `bun tools/provision-public-showcase-rate-releases.ts --apply` child with protected env inherited in memory. It exited1 at `approver approvals is not an array`.

Before that failure, Locanda draft creation and identical-key/body replay passed; the reconstructed command and three-cell simulation passed; approval request and identical replay passed; requester inbox canDecide=false/canPublish=false and actual self-decision HTTP409 passed. **No decision by the distinct approver, requester publish denial, fresh approver simulation, publication or publication replay was reached.** London was not started.

Read-only postflight, after correcting the review helper to parse multiline PostgreSQL JSON, established:

- Locanda: exactly3 version1 property-bound draft extensions (model,target,release), exactly1 pending undecided approval, exactly4 facts (model.drafted,target.drafted,release.drafted,release.approval_requested), exactly1 approval.requested outbox event, exactly2 completed Order536 idempotency rows. No active release.
- London: zero corresponding history/evidence/idempotency rows.
- Reservation651/occupancy230/journal0 unchanged. Count preservation is not a whole-table content fingerprint.

No drafts/approval were deleted, changed directly or recreated after the failure. The immutable Locanda draft trio and pending approval are the material retained writes; the failed batch was not atomic or rolled back in full.

### Root cause and remaining required repair

The follow-up protected login hit HTTP429, so the failed inbox's exact HTTP status was not independently captured. A tenant-scoped read-only org-subtree join then verified active approver count1 but **zero matching user_role property grants for both target properties**. Do not state403 was observed; lack of applicable grants was independently proven by DB evidence.

The provisioner's preflight checks only requester access, then authenticates the approver; it does not verify the approver's property authorization before creating requester-owned immutable state. Authentication of a different user is not enough. This is a remaining fail-before-first-write defect and an actual target prerequisite, so full workflow acceptance is withheld. Do not silently assign permission or reuse requester authority. Any grant change requires an explicitly governed scope and review; recovery must identify/reuse the exact retained draft/approval and evidence with deterministic keys, not rerun the empty-history/first-response assumptions or create new copies.

No active publication means Order533 remains blocked; no reservation commit, reservation replay, occupancy claim or375px completion was attempted. No provider/OTA or deployment action occurred. The controlled pure checks and identity login are not substitutes for operational four-eyes publication proof.
