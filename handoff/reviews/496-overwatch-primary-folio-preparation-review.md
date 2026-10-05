# Order496 independent primary-folio preparation review

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; did not implement this change.

**Verdict: ACCEPT the bounded source slice at the hashes below.** The stale-status issue found during review was corrected by the implementer and independently re-executed. Fresh PostgreSQL service, authenticated API, preservation and controlled-component proofs pass. This is not a deployed-target, rendered-browser/mobile, full Order492 or whole-repository referee approval.

## Frozen source and inspection

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `AA63A7B1902D1EF744D66DABD497EBC6254EB662B22949592FB1B59275109295` |
| frontend/yellow/src/styles.css | `2FB22D28334EF38E53E15353A04D4EF2626461A1E4D53DCCA0F8ACBDC13A7F5A` |
| tests/yellow-voice-routing.test.ts | `1764C1814038088B2B0AE0639E408DAB4F512E4E051B646C67FDC0F6A0AD0987` |

Read PROJECT.md, Order496 and relevant financial/API source and tests. Used code-review and Yellow Postgres/entity patterns to verify reuse of the existing account-owned folio, tenant-local transaction, immutable financial boundaries and same-transaction evidence.

- `openPrimaryFolio()` calls only **POST `/api/v1/properties/:property/reservations/:reservation/primary-folio`**, `body: "{}"`, JSON content type, bearer session and the supplied idempotency key. Non-OK responses throw; it invents no account, folio number, amount, posting, actor, tenant or property authority in its body.
- The action renders only for current **due_in** detail, null authoritative primaryFolioId, satisfied identity gate, clean/inspected room, and exactly one blocker equal to `primary_folio_not_open`. Loading/query errors hide the action.
- Reviewer initially found the absent explicit due_in guard: a disabled readiness query could retain an earlier cached sole-folio blocker after detail reported another status. Implementer added the current detail-status check and a regression. The independent component proof now verifies reserved/in_house/due_out/cancelled/checked_out all hide preparation even with the old blocker data.
- Folio consent is distinct from check-in consent, with its own pending flag and stable per-mount idempotency ref. The component is keyed by reservation identity. It cannot call the folio helper before consent or while pending; an unchanged retry after denial uses the same key and requires renewed consent.
- Both success and denial await reservation-detail plus readiness refetch and clear folio consent. No optimistic folio/account/ledger state is constructed. New authoritative check-in readiness does not check the separate check-in consent or call check-in.
- The existing backend adapter checks exact open scope/property grant, UUIDs, empty body and key; it passes verified authority through the middleware-owned transaction to FolioService. Existing service/account/series/fact/outbox/idempotency semantics are reused unchanged. No direct client DML, posting, payment, invoice, room-condition or check-in effect is added by preparation.
- CSS adds the visibly bounded preparation panel; actual viewport rendering is not asserted.

## Personally executed frontend proof

```powershell
bun test tests/yellow-next-finance-workspace.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order496-primary-folio-review-20260920/component-proof.ts
```

Results: **18 pass / 0 fail / 97 assertions**, no skips; both typechecks exit **0**; reviewer-authored component/helper harness exits **0**.

The harness extracts/transpiles the actual current OverwatchCheckInJourney/helper and executes controlled hooks/query responses. It verifies sole-blocker/identity/room/primary-folio/status/error hostility, separate unchecked confirmations, denial/no false success, both refetches, reconfirmed same-key retry, successful refresh, check-in remaining unchecked/disabled after readiness becomes ready, and exact helper endpoint/body/bearer/key. It calls no real financial or check-in endpoint. This is **controlled component-function testing, not React DOM or browser E2E**.

Harness: `D:/Yellow/temp/astra-order496-primary-folio-review-20260920/component-proof.ts`, SHA256 `F3B1D37C9118A2A18B83F4C39649779243D5500CB12879E281797EF7B07E8C08`.

## Personally executed fresh PostgreSQL proof

Created an entirely new reviewer-owned PostgreSQL **16.15** cluster at `D:/Yellow/temp/astra-order496-primary-folio-review-20260920/data`, listening only on **127.0.0.1:55519**, database `yellow_astra496_folio`. No public/implementer database, app or tunnel was used. Random role credentials remained in-process; local disposable-cluster authentication was trust. Setup roles follow the documented deployment/owner/runtime/registrar attributes. The normal runMigrations runner applied and validated **all 95 migrations** on the fresh database; final ledger count/min/max is **95/1/95**.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order496-primary-folio-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres process: -D <above> -h 127.0.0.1 -p 55519
bun D:/Yellow/temp/astra-order496-primary-folio-review-20260920/bootstrap.ts
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55519/yellow_astra496_folio'
$env:YELLOW_FINANCIAL_FOLIOS_URL='postgres://yellow_runtime@127.0.0.1:55519/yellow_astra496_folio'
$env:YELLOW_REQUIRE_FINANCIAL_FOLIOS='1'
bun test tests/financial-folios.integration.test.ts tests/operator-primary-folio.integration.test.ts --timeout 120000
bun D:/Yellow/temp/astra-order496-primary-folio-review-20260920/api-proof.ts
```

Existing financial/adapter suites: **18 pass / 0 fail / 207 assertions**, no skips, 3.64 seconds. Covers exact account dimensions, minimized actor/property-bound fact/outbox, existing-window no-op, twenty different-key contenders converging on one effect, exact replay/changed-input conflict, actual after-outbox rollback with number reuse, malformed authority, foreign property/tenant, ineligible statuses, missing/ambiguous/fiscal series, duplicate/non-open accounts/corrupt window, RLS and excluded financial counts. The adapter file contains mocked-domain tests; it is not misrepresented as real HTTP, which is provided separately below.

### Separate independent real authenticated HTTP proof

Reviewer harness `api-proof.ts`, SHA256 `C41F12A19464DB04DB0E847347EAF806CE66397A4D0AB443AD56072FC9272499`, uses real createApp/OperatorHttpApi/FolioService/BearerTenantResolver and a **yellow_runtime connection**, not a deployment connection for commands. Synthetic setup only uses the deployment role. Independently checked session_user yellow_runtime and SET LOCAL ROLE app_role. Tokens are genuinely signed with an ephemeral signer and verified through normal bearer middleware; this is not a local-password-login proof.

Result: **PASS**, exit 0:

1. Missing scope, ungranted foreign property, foreign tenant and nonempty authority-bearing body return **403/403/403/400**. Full sorted-row fingerprints of **all 129 public tables** are unchanged after denials.
2. Exact empty-body canonical POST returns **201** with one primary open folio/account and exactly one minimized **folio.opened fact and outbox event** bound to target/actor/property/correlation. Response does not expose account/party/email. Reservation remains **due_in**.
3. Only **account, folio, fact_log, outbox, api_idempotency, document_series** change. Non-fiscal folio series advances **1→2**. All other **123 public-table full-row fingerprints** remain identical: no journal/posting/payment/instrument/document/occupancy/reservation/room state effect.
4. **Twenty identical HTTP retries** return 201, identical response bytes and `idempotency-replayed: true`; every public-table fingerprint remains exactly identical to the first post-command snapshot. This proves one effect, not just matching counts.
5. New key against the existing folio returns **200/changed:false**; only api_idempotency changes. Foreign-tenant app_role reads of the account and folio return no rows.

The fingerprint proof covers before/after data rows of all public tables, not sequences/system catalogs. The expected non-fiscal folio-number advance and idempotency row are intentionally allowed and must not be mislabeled as an entirely write-free action. No charge or check-in was executed in this independent API harness.

## Limits and cleanup

Stable retry identity is in-memory for the mounted reservation action, not durable across page reload/unmount. Server remains final authority if data changes after the displayed readiness snapshot. Full browser/mobile rendering, public target behavior, whole-repository CI and the 11-invariant referee were not executed here and are not claimed. The existing browser tool unavailability is not used to relabel controlled component tests as browser proof.

Stopped only this owned cluster with `pg_ctl.exe -D D:/Yellow/temp/astra-order496-primary-folio-review-20260920/data -m fast -w stop` (exit 0). Retained proof scripts/data remain local. No implementation source edits or public mutations were made by the reviewer. `bash ./state.sh` remains unavailable because the installed WSL relay lacks `/bin/bash`; no passed ritual/referee result is inferred.
