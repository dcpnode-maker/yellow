# Order539 — independent operational-detail review

Reviewer: Astra (`/root/astra_review`), non-implementing independent agent. Date: 2026-09-21.

## First frozen candidate: REJECT before API mutation

Hashes personally verified:

- App.tsx: `312E3B81D1CFEB0289EE8B1374B65616A2E426B8EDD4847B213187709A54FA71`.
- styles.css: `5705B00599EB155E4B4BD0CC1C97D549EADB0685DCB8B99AC7DACE7D00B7CE0C`.
- tests/yellow-reservation-operational-details.test.ts: `9E714515FA63D75499996FD4EC6529C6B0B66DD05F1BF03D9A1BB598D32E67ED`.

Runtime source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

### Blocking findings

1. **Failed/uncertain save discards the requested draft.** The seeding effect depends on `operationalPosting`; returning it to false after a rejected write resets all six inputs to canonical detail. The UI cannot retry the unchanged command as promised. The same effect reseeds during editing on background canonical changes instead of preserving an explicit original snapshot and invalidating/reconfirming stale consent.
2. **Offset-time reconciliation compares incompatible representations.** The existing detail service returns PostgreSQL `timetz::text`, e.g. `15:00:00+03`; the documented input is `15:00:00+03:00`. `refreshedMatches` uses raw strict equality. Thus a successful canonical save can be reported unconfirmed. Equivalent accepted Z/compact-offset forms have the same issue. Match normalized supported values, while preserving the exact intended command and CAS snapshot for retry.
3. **Reconciled-success catch omits board invalidation.** The normal success path invalidates the board, but the uncertain-response success branch does not. Both canonical-success paths must refresh/invalidate the relevant read surface consistently.

### Personally executed proof

```text
bun D:/Yellow/temp/astra-order539-component-proof.ts
  exit0, deliberately reproduces both bugs using the actual extracted component,
  state/effect execution and controlled services; prints frozen App SHA312E3B81...
  - denied note save resets requested note to original;
  - successful documented ETA input with canonical +03 text reports
    not-authoritative error and no saved message.
  No HTTP/browser/database calls.

bun test tests/yellow-reservation-operational-details.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-next-checkout-confirmation.test.ts
  6 passed, 0 failed, 77 assertions.
bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bun run typecheck
  exit0, no diagnostics.
```

The authored source-contract tests do not catch the reproduced behavioral failures. Their green status is not functional acceptance. Existing property-scoped PATCH/Bearer/idempotency delegation, six-field scope, visible bounded notes/code inputs and shared flight controls were inspected; no new endpoint/DML was found in this slice.

**No Order539 live API write, new reservation, modification, database mutation, deployment or implementation edit was performed.** Per the requested reject-before-mutation condition, the dedicated fictional modify/replay/conflict preservation proof is withheld until the source is repaired, frozen and independently rechecked. Root's non-mutating 375px visible editor proof and subsequent target-bound deployment gates also remain; no whole-PMS readiness claim is made.

## Corrected frozen candidate — ACCEPT source and independent API proof

This supersedes the first candidate's rejection for the exact bytes below. Reviewer: Astra (`/root/astra_review`), personally executed, non-implementing. Date: 2026-09-21. **Bounded source/API acceptance; root's specified non-mutating 375px editor proof and later target-bound deployment/postflight remain separate gates.**

Final hashes personally verified before and after proof:

| File | SHA-256 |
| --- | --- |
| App.tsx | `0384614C2709B6016E8720429E3EAAD0C731CCD9CB474CAF55121CD4494D04D3` |
| styles.css | `5705B00599EB155E4B4BD0CC1C97D549EADB0685DCB8B99AC7DACE7D00B7CE0C` |
| tests/yellow-reservation-operational-details.test.ts | `B4F73A9B194CE735083EFB170F0816D8A0F4E989AB49467D0313A053D4F2CB98` |

### Remediation and final source assessment

The editor now freezes its six-field original baseline while editing, preserves requested values after failure, and builds expected/changes plus retry fingerprint from that baseline rather than silently rebasing to a background refresh. Changing a draft clears its separate visible consent. Closing/reopening intentionally discards/reseeds the editor; no reload-persistent retry identity is claimed. Offset representations are normalized for changed-field detection, expected/changes and canonical reconciliation, including the reproduced `+03:00`/PostgreSQL `+03` case. Reconciled success also invalidates the reservation board.

Canonical property-scoped PATCH with Bearer and stable exact-command idempotency remains the only write path. Editor disclosure is limited to the four specified server statuses, six supported fields, 4,000-character notes and 64-character codes; the server still validates identifier/time syntax and CAS. Shared lifecycle/check-in/checkout busy controls and shell/voice supersession remain in place. No new endpoint, domain transition, occupancy method, schema, event, provider operation or financial behavior is added. No remaining blocking finding in the reviewed scope.

### Personally executed source verification

From the designated runtime source:

```text
bun D:/Yellow/temp/astra-order539-component-proof.ts
  exit0; actual extracted component, controlled state/effects/services:
  - failed save preserves draft;
  - retry retains exact baseline/body/key despite concurrent canonical refresh;
  - documented offset input reconciles PostgreSQL +03 representation;
  - uncertain committed response reconciles and invalidates board.
  Also asserts Close editor and Cancel reservation disabled during save.
  No HTTP/DB calls in this harness.

bun test tests/yellow-reservation-operational-details.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-stateful-neon-bloom.test.ts tests/yellow-next-public-surface.test.ts
  40 passed, 0 failed, 313 assertions across seven files; exit0.
bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bun run typecheck
  exit0, no diagnostics.
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order539-reviewed-build-20260921
  exit0, 469 modules; index-D4N5m_-e.js / index-Be680vX5.css.

bun build D:/Yellow/temp/astra-order539-api-proof.ts --target bun --outdir D:/Yellow/temp/astra-order539-proof-compile
  exit0.
bun D:/Yellow/temp/astra-order539-api-proof.ts --apply
  exit0; canonical live proof described below.
```

Reviewer-owned harness SHA-256:

- Component: `C00FE34BE87B1BB0E1C01DC38D163B341AB94CEA3192A64F03529E702F1A8CD5`.
- API/DB: `1A1B1B34E8D0E404B1D5EC22B37A182C576322D733771F80CF0993EF5B3B82C4`.

### Dedicated fictional API proof — PASS

Used the expressly authorized loopback synthetic API with demo Bearer token held only in process memory, existing canonical synthetic Party and fresh governed L1BR availability. Created a new future fictional reservation solely for this order; no existing arrival was modified.

- Reservation: `f57f1c1d-5b50-4e3e-90e0-b04340dbb01e`.
- Segment: `448c6b05-e98b-4708-9e48-a82a8b24f6a2`.
- Stay: `2026-09-26T12:00:00.000Z` to `2026-09-27T08:00:00.000Z`.

After canonical creation (HTTP201, one occupancy claim), captured the preservation baseline. Submitted exactly notes, ETA, ETD, marketCode, sourceCode and originCode with their exact original expected values to the existing property-scoped PATCH. First modification HTTP200; identical body/key replay HTTP200 and `idempotency-replayed=true`, byte-equivalent parsed response and complete target reservation/segment/occupancy/fact/outbox/idempotency evidence unchanged.

Then submitted deliberately wrong expected evidence under a distinct conflict key: HTTP409, complete evidence unchanged. Submitted changed body under the already-used modification key: HTTP409, complete evidence unchanged. No successful or incomplete extra idempotency record remained for the rejected conflict command.

Exact read-only database assertions:

- Only the six permitted reservation columns changed; all other columns of the full reservation row are equal to baseline.
- Complete target segment and occupancy rows unchanged, including claim identity/space/period.
- Exactly one additional `reservation.modified` fact and one matching outbox event, actor-bound to the current authenticated actor, exact property/reservation and shared fact request_id/event correlation/HTTP correlation.
- Fact/event diff objects match and contain exactly the six expected field keys, with exact normalized before/after values.
- Exactly one additional completed `reservation.modify` idempotency row, matching SHA-256 of the command key and response_status200.
- Whole-tenant full row-content fingerprints for `space_occupancy`, `reservation_segment`, `journal`, `posting_line`, `payment_operation` and `document` equal their post-create/pre-modify baselines across modification, replay and both conflicts.
- All DB evidence used `BEGIN READ ONLY` and transaction-local `set_config('app.tenant_id', ..., true)` via the running synthetic Postgres container. No direct database mutation command was executed. Outbox snapshot comparison excludes only sanctioned `published_at` advancement.

| Tenant count | Before dedicated creation | After creation, edit, retries/conflicts |
| --- | ---: | ---: |
| reservation | 653 | 654 |
| reservation_segment | 653 | 654 |
| space_occupancy | 232 | 233 |
| journal | 0 | 0 |
| posting_line | 0 | 0 |
| payment_operation | 0 | 0 |
| document | 0 | 0 |

The single added reservation/segment/claim are from the authorized dedicated creation, not from operational modification. The synthetic reservation remains reserved with the fictional operational fields as a retained proof artifact. No contact values, secrets or credentials were printed. No provider/OTA, deployment, implementation edit, migration or cleanup mutation was performed.

Limits: this proves the bounded operational command and preservation contract, not all PMS editing, all-table historical preservation or deployment readiness. The reviewer had no independent browser surface; root must supply the order's non-mutating 375px visible editor/review proof before promotion. No 11/11 referee result is claimed for this UI-only review.
