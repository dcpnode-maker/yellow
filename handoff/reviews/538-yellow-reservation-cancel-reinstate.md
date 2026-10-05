# Order538 — independent reservation lifecycle review

Reviewer: Astra (`/root/astra_review`), non-implementing independent agent. Date: 2026-09-21.

## Interim verdict: BLOCKED, no lifecycle API writes authorized yet

This is an intermediate review while the implementer repairs findings, not a frozen-source release acceptance. Source is the designated `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source` candidate. No implementation edits, deployment, database write, reservation creation, cancellation, or reinstatement have been performed by this reviewer for Order538.

Initial review found missing failure-path canonical refresh, success wording that ignored a resolved TanStack refetch error, incomplete cross-action/navigation locking, and missing reservation identity keys. Subsequent source and personally executed extracted-component proof verified detail/readiness refresh plus board invalidation on uncertain failure, absence of false authoritative success on refetch error, cancellation-first check-in disablement, and both keyed reservation render sites.

The same controlled proof reproduced a remaining reverse-order concurrency defect: with check-in already in flight, Confirm cancellation remained enabled and invoked its canonical helper. The nested pointer-only busy shield also did not constitute keyboard/shell navigation locking. These findings were returned to the implementer. Files changed again during evidence collection; the interim results below must not be attributed to later hashes or represented as final verification.

## Personally executed interim commands

All commands ran from the designated runtime source unless an absolute path is shown.

```text
bun D:/Yellow/temp/astra-order538-component-proof.ts
  4 prior-remediation checks passed; reverse check-in→cancel race reproduced.
  Controlled extracted actual component and hooks/services only; no HTTP/DB calls.

bun test tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-stateful-neon-bloom.test.ts tests/yellow-next-public-surface.test.ts
  37 passed, 1 failed, 260 assertions.
  Failure: checkout test line30 expected the old exact guard without lifecyclePosting.

bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bun run typecheck
  exit0, no diagnostics.
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order538-r1-build-20260921
  exit0, 469 modules; index-BfO08Kq6.js / index-DOWRDcCr.css.
```

## Remaining reviewer gates

Wait for an explicit source freeze, re-inspect the complete locking remediation, rerun controlled behavior/relevant suite/strict frontend and root types/build, then bind final SHA-256 hashes. Only if those source gates pass, run the reviewer-owned canonical API proof on one distinct fictional future reservation, with identical cancel/reinstate retries and tenant-scoped read-only database snapshots proving exact lifecycle/occupancy/fact/outbox/idempotency changes and unchanged financial structures. Root must separately provide the non-mutating 375px visible-flow proof specified by the order. No whole-PMS readiness or deployment approval is implied.

The prepared reviewer harness `D:/Yellow/temp/astra-order538-api-proof.ts` compiles (`bun build ... --target bun --outdir D:/Yellow/temp/astra-order538-proof-compile`) but has NOT been executed. It requires explicit `--apply` and has no deployment/provider workflow.

## First frozen candidate — REJECT before mutation

Implementer-declared frozen App SHA-256: `8C4B93DCB93BFE07125B25D298B27F610E6A26169EAD960E96B443339F47CF44`; stylesheet `1F559F8935EFBF37411100794248002BD867B75F76546C51C0BF9C7A704BCDA5`; lifecycle test `E6D734040386C12FD4F9464F06D40B9F21BB262F7B56D84036F1E2CE384BC168`.

Personally reran the six-file suite listed above: **38 passed, 0 failed, 278 assertions**. Stale checkout oracle is repaired. Source now guards lifecycle submission against check-in/checkout posting and captures shell clicks/submits on all seven shell render branches. Both workspace sites relay lifecycle busy state.

Remaining blocking finding: DOM click/submit capture does not govern an already-running speech callback or an async Yellow command. `ask` checks only message/thinking, not lifecycle busy, before resolving a named guest/reservation and replacing `assistantCard`. Its awaited reservation-index read has the same gap. Replacing the inline reservation unmounts it and its cleanup clears shell busy even though the command is still in flight.

Personally executed `bun D:/Yellow/temp/astra-order538-voice-flight-proof.ts` against the actual extracted `ask` function with controlled scope. Both (a) callback invoked while lifecycle busy and (b) pre-existing index read completing during lifecycle busy replaced the assistant card exactly once. No browser/HTTP/DB calls were made by this harness. Entry and post-await continuation must honor a synchronous shared flight boundary.

Additional UI issue: the extracted component still rendered Confirm cancellation enabled while check-in was held in flight; the updated lifecycle handler now refuses it, but rendered form controls were not yet aligned with that shared busy condition. The controlled component run stops at this assertion; it must not be reported as a fully passing regression run. Prior four refresh/error/key checks passed.

Verdict for this frozen candidate: **REJECT/BLOCK**. No Order538 live reservation, occupancy, or database mutations were performed. Await remediation and a fresh exact-byte proof before invoking the prepared API harness.

## Second frozen candidate — ACCEPT source and independent lifecycle proof

This section supersedes the earlier source rejection for the exact hashes below. Reviewer: Astra (`/root/astra_review`), personally executed, non-implementing. **Bounded acceptance of source and canonical API/DB proof; public promotion still requires the order's root-executed non-mutating 375px visible-flow evidence. No deployment performed or authorized by this record.**

Hashes independently re-read after execution, unchanged from the second freeze:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `804050931AC5E8F7A9B78DC4F972487B225AEF37E4DDE347321673B63AE68477` |
| frontend/yellow/src/styles.css | `1F559F8935EFBF37411100794248002BD867B75F76546C51C0BF9C7A704BCDA5` |
| tests/yellow-reservation-lifecycle-actions.test.ts | `DFF7A069C48DF91FBD9B1C3B0F112A1B798B0FE28E02B9B728F3206FCA87A8D5` |
| tests/yellow-voice-routing.test.ts | `2533B537ADF9DA1D49C5B7477C260B77368C68B7B7E6F76CDB68C9263EF17BA5` |
| tests/yellow-next-checkout-confirmation.test.ts | `C7BB8CF5792B98A45CE4353AEC68EE5F3E37541213265B367677941395B89CAF` |

### Final source findings

Eligible controls use canonical detail status: reserved/due_in cancel; cancelled/no_show reinstate. Cancellation reason is visibly bounded to 500 characters, trimmed, required and reset to unchecked consent on editing. Choosing either action clears prior consent. Both reservation workspace sites are keyed by reservation UUID, preventing cross-record state carryover. Lifecycle requests use only the existing property-scoped `/cancel` and `/reinstate` endpoints, Bearer session, exact reason/empty-object bodies and an unchanged-command fingerprint-bound idempotency key. The key survives uncertain response retries within the current workspace mount.

Cross-action handlers and rendered controls now refuse/disable cancellation while check-in/checkout is in flight and vice versa. A synchronous shell busy ref is set before dispatch, shell captures click/submit, and a stable busy callback invalidates the assistant operation generation. Voice/async command entry and continuations check this boundary; the reproduced card-replacement bypass is closed. Canonical refresh failures do not produce an authoritative success message. Success/uncertain reconciliation requires the refreshed expected status; failure refreshes detail/readiness and invalidates the reservation board. No new domain transition, authorization bypass, DML, occupancy implementation, financial semantics, provider operation, migration or endpoint was introduced.

Mobile CSS has wrapping/minimum-height lifecycle controls and a full-width narrow-screen submit. This is source inspection, not an independent mobile browser claim. Browser refresh/tab closure cannot be prevented absolutely and the in-memory retry key is not persisted across a full page reload; no reload-persistent exactly-once UI claim is made.

### Final personally executed commands/results

```text
bun D:/Yellow/temp/astra-order538-component-proof.ts
  exit0: five groups passed (uncertain refresh, cancellation-first lock,
  refetch-error truthfulness, keyed sites, reverse check-in-first lock).
bun D:/Yellow/temp/astra-order538-voice-flight-proof.ts
  exit0: callback during busy => 0 card replacements;
  pre-existing read resolving during busy => 0 replacements;
  superseded read resolving after busy clears => 0 replacements.

bun test tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-stateful-neon-bloom.test.ts tests/yellow-next-public-surface.test.ts
  exit0: 38 passed, 0 failed, 281 assertions across six files.
bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bun run typecheck
  exit0, no diagnostics.
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order538-r2-build-20260921
  exit0, 469 modules; index-ByoVwt7f.js / index-DOWRDcCr.css.

bun D:/Yellow/temp/astra-order538-api-proof.ts --apply
  exit0: dedicated canonical create/cancel/reinstate and both exact replays passed.
```

Reviewer-owned harness hashes:

- API proof: `«REDACTED-SECRET»`.
- Component proof: `556DF175C2A11C7FA93578ED8FDE9192D5476C9559CCA8877E836D42301BFCED`.
- Voice-flight proof: `2708A39C597F477D088FE1F18DC6FAA1E19E390AD3EACB3B3394C2FACA58744E`.

### Canonical live proof and exact bounded effects

The authorized loopback synthetic API was used with a demo Bearer session held only in memory, an existing canonical synthetic Party, fresh governed L1BR availability and a distinct future stay. No contact data or credentials were printed. New reviewer reservation: `8edb126f-bded-460e-a5bf-22038251c5eb`; its sole segment: `cafb2259-be19-4f4b-8570-ba96c3609690`; stay `2026-09-28T12:00:00.000Z` through `2026-09-29T08:00:00.000Z`.

1. Canonical `/api/v1/reservations:commit`: HTTP201, reserved, one claim. No existing arrival was edited.
2. Property-scoped cancellation: HTTP200; reservation/segment cancelled, cancellation evidence present, zero remaining claims. Identical body/key retry: HTTP200, `idempotency-replayed=true`, identical response and complete target reservation/segment/occupancy/fact/outbox/idempotency snapshots unchanged.
3. Property-scoped reinstatement with `{}`: HTTP200; reserved/booked, one claim for the original segment, space and period. Identical body/key retry: HTTP200, replay true, identical response and complete target snapshots unchanged.
4. Full final reservation and segment rows equal their immediately-post-create snapshots. Original occupancy was released only through the canonical lifecycle and a fresh claim made through canonical reinstatement; the occupancy row identity is not falsely claimed immutable through release/reclaim.
5. Exactly one actor-bound reservation.confirmed, reservation.cancelled and reservation.reinstated fact/event each; event property and fact request_id/event correlation binding checked. Exactly two occupancy.recorded and one occupancy.released fact/event each. Three completed idempotency rows for the three distinct command keys, not one per retry.
6. Tenant-scoped read-only PostgreSQL evidence used `BEGIN READ ONLY` and `set_config('app.tenant_id', ..., true)` via the running synthetic Postgres container. No direct database mutation command was executed. Outbox snapshot comparison excludes only sanctioned `published_at` advancement.

| Tenant-scoped count | Before new proof stay | After reinstatement/replay |
| --- | ---: | ---: |
| reservation | 652 | 653 |
| reservation_segment | 652 | 653 |
| space_occupancy | 231 | 232 |
| journal | 0 | 0 |
| posting_line | 0 | 0 |
| payment_operation | 0 | 0 |
| document | 0 | 0 |

Full tenant-scoped row-content fingerprints for journal/posting_line/payment_operation/document were equal before and after, not merely their counts. Target complete snapshots prove retry preservation; this is not a historical all-table no-delta assertion. The newly created fictional future reservation remains reserved as the intentional proof artifact. No cleanup cancellation was requested/performed.

Remaining limits: root's required 375px non-mutating visible lifecycle proof and later target-bound deployment/postflight; no independent browser session was available to this reviewer. No 11/11 referee run is claimed for this UI review, no whole-PMS readiness claim, and no public UI deployment occurred.

## Final mobile-containment CSS addendum — ACCEPT preserved

The final App hash is unchanged at `804050931AC5E8F7A9B78DC4F972487B225AEF37E4DDE347321673B63AE68477`; therefore the accepted lifecycle behavior and reviewer-personal API/DB proof above remain bound to the candidate. Final stylesheet hash independently verified: `42F3FFA85FA5D2027866F61CCA37635889682C4C960E27375F1D319F04ABA2D8`.

Reviewed the requested narrow containment repair: zero minimum width on reservation workspace/grid/hero child/detail card, `overflow-wrap:anywhere` on the long confirmation heading/detail card, and `main` using `minmax(0,1fr)` below 980px. These allow long identifiers and intrinsic grid contents to shrink/wrap; they do not hide overflow, truncate evidence, modify action eligibility, shrink the existing 44px minimum touch target, or alter command/confirmation logic. Compared the previous reviewer-built CSS leaf rules against the new build: differences are confined to these containment declarations. No new blocking source finding.

Personally executed again:

```text
bun test tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-checkout-confirmation.test.ts
  6 passed, 0 failed, 75 assertions; exit0.
bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order538-mobile-final-build-20260921
  exit0, 469 modules.
```

New independent build artifacts:

- `index-Z2ZQ_DfT.css`: SHA-256 `108D0625FCB4921E9628D9D994AC60B2F311E3ADE01B124F3CE6FF67983882C6`.
- `index-D3175D-W.js`: SHA-256 `1CB1CF2EC81B4C7F12C9E50A9FA16D7307D9C79968C6294DF7EC413C3F4DA633`.

Root separately reports personally repeating the order-required non-mutating preview flow at actual 375×812 after this repair: viewport width375; document scroll width360; shell344; lifecycle card x26–334; confirmation button x62.6–297.4 with top-hit target true; no image/canvas/background image. This satisfies receipt of the root-owned visible-flow evidence requested by the order, but it is attributed to root—not represented as reviewer-executed browser evidence. The independent reviewer had no browser surface and did not reproduce those geometry measurements.

**Final bounded verdict: ACCEPT, preserved after CSS repair.** No API/DB mutations were repeated for the stylesheet review. Source acceptance and the dedicated fictional lifecycle proof do not constitute deployment or target-bound postflight, and do not claim whole-PMS readiness.

## Root public promotion and postflight

After the independent ACCEPT, root promoted the exact accepted App and final
containment CSS to the sole `yellow-public-demo-app-1` service on loopback port
3010. Loopback health and entry returned HTTP 200 with
`index-Z2ZQ_DfT.css` and `index-D3175D-W.js`; the same hashes were returned by
the active Cloudflare tunnel at
`https://editing-alto-artists-quilt.trycloudflare.com`.

Root repeated the complete non-mutating lifecycle preparation on the public URL
at 375×812: opened the dedicated fictional reservation, selected cancellation,
entered a non-sensitive test reason and checked the explicit confirmation, but
did not invoke the final cancellation button. Public geometry remained bounded:
document scroll width 360, shell width 344, lifecycle card x26–334 and final
button x62.6–297.4; the button was the top hit target. The page contained zero
Yellow images/canvases and body `background-image` was `none`. A reload cleared
the unsubmitted form and returned canonical status `reserved` with cancellation
still eligible, proving no lifecycle change was submitted. The temporary port
3011 preview was stopped and removed; the app, Postgres, Valkey and tunnel are
the only retained Yellow public-demo containers and all were healthy at
postflight. Quick-tunnel uptime remains unguaranteed.
