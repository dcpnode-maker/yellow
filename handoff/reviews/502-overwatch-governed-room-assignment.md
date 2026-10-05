# Order502 independent governed room-assignment review

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; not the implementer.

**Verdict: ACCEPT the bounded source slice at the final hashes below.** Personally executed fresh PostgreSQL/service/adapter proof, separate authenticated HTTP preservation/denial proof, and controlled current-component proof. No remaining blocking finding in this slice after implementer corrections. No public release, browser/mobile E2E, whole-repository referee or wider orchestration approval is implied.

## Frozen source

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `91D386A504A432682CC5859AE2F9A717ED2F2ECD74E3EA54576F6FCD9DCD86F8` |
| frontend/yellow/src/styles.css | `317F10920BF6F9DCDD46A7D0E02E8AA43AA8D661777DF1DCDC21DAA14B14C220` |
| tests/yellow-voice-routing.test.ts | `3B4431F72D02E2A90F515C7FADED2D9D264EA08A37C5BF8F382877BD4B03903D` |

Read PROJECT.md, Order502, relevant current frontend, canonical operator adapter, reservation segment service and tests. Used code-review and Yellow Postgres/entity patterns to check same-transaction occupancy/evidence, canonical availability authority, command reuse and tenant containment.

## Findings and final control assessment

1. Initial source retained only selected room ID/key and rebuilt the CAS body from separately refreshed detail. A changed period/type/segment could therefore reuse a key with different input or retain consent for changed evidence. It also allowed an existing candidate while its query was refetching. Reviewer reported this before acceptance. Implementer now freezes the full body on explicit confirmation, compares it to current segment/type/period/room, binds the retry key to the serialized full body, and rejects `isFetching`. Independent executable component checks pass stale-period refusal, identical body/key retry and changed-body reconfirmation/new key. This was a source-review finding; no fabricated initial failing test is claimed.
2. Reviewer initially questioned omission of a candidate expected-state envelope. Inspection corrected that concern: the **HTTP** candidates response intentionally exposes only `{candidates}`, although the internal domain result has additional state. Deriving initial CAS evidence from authoritative reservation detail is correct for the existing contract. No API expansion was requested or made.
3. Order502's cache boundary is explicit in final source: candidate fetch uses **cache:no-store**; query uses **staleTime:0, gcTime:0, refetchOnMount:"always"**. No persistent/HTTP availability cache or automatic choice is added. Active-screen data and the ephemeral confirmed retry snapshot remain necessary; they are not a second availability authority. Candidate refetch makes assignment unavailable until completion.

Final source uses only existing GET `/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment/candidates` and POST `/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment`, with bearer session and the stable supplied key. The exact body has segmentId, due_in/booked expected statuses, expectedUnitTypeId, null expectedSellableUnitId, exact expectedPeriod, and the explicitly selected server candidate sellableUnitId. It adds no price, occupancy, room-condition or check-in authority.

Preparation exists only for one unassigned booked segment on a due_in reservation. No candidate is automatically selected, sorted into a recommendation or calculated in the browser. Separate visible room confirmation is required. Missing/removed candidate, errors, fetching, absent consent, changed CAS evidence, already-assigned/non-due-in/multiple-segment state cannot submit. Changing selection clears confirmation/draft. Both success and denial refetch detail, readiness and candidates; denial clears consent/draft without fabricating success. Success clears selection/consent/draft and leaves check-in/folio as distinct actions. No direct DML or automatic follow-on action was introduced.

## Personally executed frontend proof

```powershell
bun test tests/yellow-voice-routing.test.ts tests/yellow-reservation-command-surface.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order502-room-assignment-review-20260920/component-proof.ts
```

Final result: **23 pass / 0 fail / 137 assertions**, no skips; both typechecks exit **0**; independent component/helper harness exits **0**. Before the cache-policy additions, the same focused suite passed 23/0/134; final approval is tied to the final hashes and rerun, not that earlier run.

The reviewer harness extracts/transpiles the actual Overwatch component/helpers and executes controlled hooks/query/network dependencies. Personally proved server-only options/no automatic selection; distinct consent; candidate refetch/error/removal; stale detail period; non-due-in/already-assigned/non-booked/multiple segments; exact initial body; all three refetches on denial/success; no false denial success; same-body/key reconfirmed retry; changed evidence/selection requires renewed consent and a new key; success clears selection; no check-in/folio/onCompleted invocation; exact endpoint/body/bearer/key and no-store/query cache settings.

Harness SHA256 `E36C0328846198501AB0BD97C5380477BED4B2FA0B909211B80C1DA510466B63`. This is **controlled component-function proof, not React DOM/browser/mobile E2E**.

## Personally executed fresh database and adapter proof

Created wholly new reviewer-owned PostgreSQL **16.15** cluster at `D:/Yellow/temp/astra-order502-room-assignment-review-20260920/data`, loopback **127.0.0.1:55520**, database `yellow_astra502_assignment`. Local disposable-cluster auth is trust; owner/runtime/registrar role attributes follow the documented authority model, with random passwords generated only in-process. No public or implementer database was used.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order502-room-assignment-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres process: -D <above> -h 127.0.0.1 -p 55520
bun D:/Yellow/temp/astra-order502-room-assignment-review-20260920/bootstrap.ts
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55520/yellow_astra502_assignment'
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55520/yellow_astra502_assignment'
$env:YELLOW_REQUIRE_DUE_IN_ROOM_ASSIGNMENT='1'
bun test tests/due-in-room-assignment.integration.test.ts tests/operator-due-in-room-assignment.integration.test.ts --timeout 120000
bun D:/Yellow/temp/astra-order502-room-assignment-review-20260920/api-proof.ts
```

Normal migration runner applied and validated **1–95**; final ledger **95/1/95**. Verified real session_user **yellow_runtime** and SET LOCAL ROLE **app_role**. Existing service/adapter suite: **11 pass / 0 fail / 64 assertions**, no skips, 1.53 seconds. Includes authoritative candidate mapping, atomic assignment/occupancy/evidence/replay, twenty same-segment contenders, last-room race, hostile direct DML/capability/actor denial, publication-failure rollback then retry, and strict HTTP adapter shape/scope/property/key. The adapter test file itself uses a mocked domain; the real HTTP proof below is separate. This 11-test suite is **not** the 11-invariant referee.

### Reviewer-owned authenticated HTTP and preservation proof

`api-proof.ts` SHA256 **`E6C095AC92C93E7ADDAF7DDC9DA5BE936053E35E174CADFB7866C33BAC2116D4`**. Uses real createApp/OperatorHttpApi/ReservationSegmentService, genuine ephemeral signed JWTs verified by BearerTenantResolver, and yellow_runtime/app_role command transactions. Deployment authority is used only for isolated fictional fixture setup and fingerprint verification, never as command authority. No real contact information or public login is used.

Result: **PASS**, exit 0:

- Candidate GET **200**, **Cache-Control:no-store**, exact eligible room identity. Full fingerprints of all **129 public tables** remain unchanged.
- Missing scope **403**, ungranted property **404**, foreign tenant **404**, extra-field body **400**, stale expected period **409**. All 129 full sorted-row fingerprints unchanged after all denials.
- Canonical assignment **200**, one occupancy claim, reservation still **due_in**, segment still **booked**. Exactly `occupancy.recorded` and `reservation.modified` fact/outbox chains, with expected actor/property/correlation bindings.
- Only **reservation_segment, space_occupancy, fact_log, outbox, api_idempotency** change. All other **124 public-table full-row fingerprints** are identical: no housekeeping condition, room, account, folio, journal/posting, payment, document or reservation-state change.
- **Twenty identical HTTP retries** return the exact original body with replay header true and preserve every post-success table fingerprint. Changed same-key body and already-assigned new-key request both return **409**, with zero further table changes. Foreign app_role occupancy read returns no rows.

Initial reviewer harness used a future-only segment period and correctly received **404** on candidates; inspection confirmed the existing canonical candidate requires `segment.period @> transaction_timestamp()`. Reviewer corrected only the fictional fixture to a currently active period and used distinct tenant IDs/slugs for the rerun; no source/domain change or failed assertion waiver. Prior fixture rows remain in the disposable cluster and are covered unchanged by the final all-table snapshots. Fingerprints cover data rows, not PostgreSQL sequences/system catalogs.

## Limits and cleanup

Retry/consent state is ephemeral to the mounted reservation component, not durable unknown-outcome recovery across reload/unmount. Current server admission remains authoritative if supply changes after candidate read. A future-only unassigned due-in can legitimately receive candidate denial until its segment is current; no readiness/availability bypass is added. Full browser/mobile rendering and public release need their own evidence.

Stopped only the owned cluster using `pg_ctl.exe -D D:/Yellow/temp/astra-order502-room-assignment-review-20260920/data -m fast -w stop`, successful server-stopped result. Proof scripts/data remain local. No implementation edits, public/real operation, deployment, migration/seed on a public target, check-in or financial action was performed. `bash ./state.sh` failed because the WSL relay lacks `/bin/bash`; no ritual, whole-suite or referee success is inferred.
