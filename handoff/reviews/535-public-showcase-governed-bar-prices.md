# Order535 independent review — 2026-09-21

Reviewer: Codex Astra `/root/astra_review`, non-implementer.

## Verdict: REJECT current provisioner; application withheld

Reviewed runtime `tools/provision-public-showcase-rate-prices.ts`, SHA-256 `0D029C5A77DC00D7443760A8507EF243D84938060BB7D57F8E5EC5CEE5FF89DF`, against Order535 and PROJECT.md. No `--apply` execution, rate write, reservation commit, provider call or deployment occurred in this review.

### Blocking findings

1. **Full-range fail-closed preflight is absent.** All six current-price queries ask only for 2026-09-21. Canonical `findCurrent` filters both that individual date and weekday, sorts newest first and returns one row. A conflicting later-date/other-weekday row is invisible. The schema deliberately has no rate-price overlap exclusion, so an inserted year-long price can shadow an existing price; a database conflict is not a safety backstop. Order535 requires any different overlapping row to stop the batch before its first write. A latest-only point lookup cannot certify every historical current overlapping row even when repeated for every date.
2. **Exact replay accepts noncanonical pricing.** `isExact` checks only occupancy, ignoring the API's `extraAdultMinor` and `extraChildren`; it also omits returned property identity/supersession checks. An exact occupancy map with extra-adult/child charges is accepted and skipped as existing. This violates the exact-current-row gate.
3. **Price-unit wording is inconsistent.** The order describes 750/850 etc as minor-unit values; the script sends 75000/85000 etc. Resolve the governed scenario definition explicitly before an immutable write. The reviewer must not select a 100x commercial interpretation silently.

### Personally executed evidence

Runtime cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
Get-FileHash tools/provision-public-showcase-rate-prices.ts
bun tools/provision-public-showcase-rate-prices.ts
bun D:/Yellow/temp/astra-order535-preflight-proof.ts
```

Actual dry preflight: exit0, `mode=preflight; planned=6; exactExisting=0`. This authenticates through automatic demo entry and performs read requests only; no token or credential was emitted. It proves absence at the queried first date, not absence across the range.

Reviewer-owned controlled proof: exit0. Actual script helpers accepted an API-shaped matching occupancy map with `extraAdultMinor` and `extraChildren` additions. Actual transpiled script, supplied a controlled fetch implementation, queried only the first date six times and reached its first would-be POST despite a later-date conflicting fixture. The transport throws before that controlled POST can complete. No real HTTP/DB writes are involved; this is executable control-flow evidence, not a live conflict injection.

Read source evidence: `src/contexts/rates/pricing.ts` findCurrent and create; `src/http/operator.ts` ratePriceJson/currentRatePrice/createRatePrice; `migrations/0001_init.sql` rate_price definition (read only). Existing API retains property grants/scopes, actor-bound idempotency, pricing service, and same-transaction rate_price.created fact/outbox. Script uses decimal integer strings and deterministic per-row keys; it has no raw DML/provider calls. These good boundaries do not repair the preflight omissions. Skipping an existing exact row is not itself a personally verified idempotency replay.

Session `bash ./state.sh` failed because WSL `/bin/bash` is absent; no referee pass is claimed. Entity/PostgreSQL and code-review skills guided canonical-service and immutable-row checks.

### Required next proof

Clarify units; inspect all six complete overlapping current-row sets before any write and enforce full normalized expected pricing/identity. Use an explicitly authorized read-only overlap census if no suitable complete API exists; do not invent a new mutation path. Account for concurrent configuration changes rather than describing a stale snapshot as atomic. Re-review corrected bytes, then personally apply via the canonical API and verify each row, actor-bound fact/outbox, deterministic idempotency replay and bookable priced availability. Only then proceed to the separate Order533 future reservation/create-replay and mobile proof. No whole-PMS acceptance is granted.

## Revised source and personally executed application — 2026-09-21

**Current verdict: six-row governed insertion/replay accepted; overall Order535 objective remains BLOCKED because bookable availability still fails.** The earlier rejection applies to the earlier hash, not this revised execution.

Reviewer remains non-implementing Codex Astra `/root/astra_review`. Revised script SHA-256 `7DE95B0134058FDAC352B62DBD5260349E6E9DC24081C6931628C9FA45AD9047` was verified before/after application. Static test SHA-256 `144F0233A00CDB8EBE5DD94C28277A9642AD76E448A9FAD0FD0846EA9BD5178B`.

The revised order explicitly fixes the major/minor distinction. Script now checks 366 dates for every pair before writing, rejects partial coverage/multiple IDs and requires exact complete DTO pricing. Read-only all-history census is separately mandatory, correctly acknowledging latest-only API limitations. This is a bounded operational execution, not an atomic all-six publication command or general concurrency-proof bulk writer. The script alone still does not check returned property/supersededBy; the reviewer verified those through authenticated property-bound API replay and raw scoped evidence below. No blind rerun against changed history is approved.

### Personally executed commands/results

All Bun commands ran in the runtime source directory. Reviewer-owned files are under `D:/Yellow/temp/`.

```powershell
bun test tests/yellow-public-showcase-rate-prices.test.ts
bun D:/Yellow/temp/astra-order535-revised-proof.ts
bun D:/Yellow/temp/astra-order535-live-evidence.ts before
bun tools/provision-public-showcase-rate-prices.ts
bun tools/provision-public-showcase-rate-prices.ts --apply
bun D:/Yellow/temp/astra-order535-live-evidence.ts after
bun D:/Yellow/temp/astra-order535-replay-proof.ts
bun D:/Yellow/temp/astra-order535-live-evidence.ts after
bun D:/Yellow/temp/astra-order533-api-proof.ts
$env:REVIEW_PROPERTY='01e4e102-c54f-5205-9542-d84d103084f8'
bun D:/Yellow/temp/astra-order533-api-proof.ts
```

- Static: **2 pass, 0 fail, 14 assertions**.
- Reviewer controlled actual-script proof: added adult/child/unknown pricing and mask changes reject; final-date conflict, partial coverage and multiple IDs reject with zero controlled write calls; clean path performs exactly2196 reads before its first controlled write. No real transport in this hostility harness.
- Actual dry preflight: exit0, planned6/exactExisting0/currentDateChecks2196.
- Read-only preflight: each property has exactly1 target plan/3 target unit types; all-history target rows0 and overlapping unsuperseded rows0. Transaction-local tenant context is established separately per property, inside `BEGIN READ ONLY`.
- **Exactly one actual `--apply` run.** Six rate-price commands succeeded, and all six exact current-price API postflight checks passed. Then the command exited1 at `LOCANDA still has no canonical bookable priced offer`. This is a partial operational outcome, not a rolled-back batch or an all-green result.
- Subsequent actual identical-body/key replay for each of the six commands: HTTP201, `idempotency-replayed=true`, same row ID, exact DTO/property, supersededBy=null. The script's skip-existing behavior was not substituted for this HTTP replay proof.
- After initial write and after replay: exactly3 all-history/unsuperseded overlapping rows per property, one per target unit. Exact raw pricing JSON contains only the prescribed `occ` tiers; exact range `[2026-09-21,2027-09-22)`, mask127. Each row has exactly1 rate_price.created fact,1 outbox event and1 completed matching-key idempotency record. Further read-only checks bind both actors to the current demo session subject, property to the expected target, fact request_id to outbox correlation_id, and full fact/outbox payloads to exact expected shapes/values. Tokens stayed in process memory; outputs expose only codes/counts/booleans.
- Tenant reservation651 / occupancy230 / journal0 counts were identical before, after insertion and after replay. This is a count-level preservation observation, **not a complete protected-table content fingerprint or proof against arbitrary concurrent unrelated updates**.

The database helper invokes read-only psql through:

```text
docker exec -i yellow-public-demo-postgres-1 sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -At -v ON_ERROR_STOP=1'
```

SQL is piped privately; no credential/environment values or profile/contact values are printed. No direct DML or database correction was performed. Six immutable scenario price rows and their governed evidence are the material changes; they were not deleted or superseded after the later availability failure.

### Remaining blocker / Order533 handoff

Fresh authenticated availability searches for both current showcase properties returned HTTP200 but bookable0/options0, evaluated_pairs0, publication_unavailable1 with three inventory candidates. Health and automatic demo entry remained200. Missing published-release semantics are independent of merely having BAR rate_price rows: offer source resolves a canonical quote and classifies missing published evidence as publication_unavailable. Do not infer that successful price insertion activated a rate release.

No reservation commit was sent, no occupancy was claimed, and no complete375px reservation flow was executed. A separately governed correction/publication prerequisite is needed before Order533's distinct future commit/replay/occupancy proof. No provider/channel push, public app rebuild/deploy, whole-PMS acceptance or Order535 completion is claimed.
