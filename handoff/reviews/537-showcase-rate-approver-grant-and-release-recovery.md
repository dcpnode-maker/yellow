# Order537 independent review — 2026-09-21

Reviewer: non-implementing Codex Astra `/root/astra_review`.

## Verdict: REJECT current recovery/grant guards; no mutation

Reviewed complete grant script `45AE126A524133708204F7CADCA21968D754B73254E7104ADB6473249967874F` and release script `09C0B02F2B1C3140E65690BA2DB10218669F754781ED85DD5C1DD8C9BD4BA175` against Order537, PROJECT.md and retained Order536 evidence.

### Blocking findings

1. **Recovery is not restricted to the retained operation.** Empty Locanda history passes preflight with retained=null and would enter the fresh creation path, contrary to mandatory recovery of the existing Locanda operation. A same-command single draft/pending approval also passes without binding the original model/target/release/approval identities, versions or original draft/request idempotency evidence. The recovery branch does not replay those original commands to establish provenance. Source accepts a substitute history rather than proving the exact reviewed operation.
2. **Grant topology and role authority checks are incomplete.** Reconciliation reads only the selected role's exact two property grants. Other-role grants at these properties, or applicable ancestor grants, are invisible; the absent selected pair can still be created rather than rejecting divergent authorization topology. Likewise the permission query filters down to two expected rate permissions, so extra/unexpected role authority is never compared. Granting the full existing financial-approver role to new properties must verify its complete approved permission surface, not only the presence of two rate permissions. Preserve legitimate pre-existing unrelated grants, but pin/check them rather than treating all unqueried topology as absent.

### Personally executed commands/results

Runtime cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
bun test tests/yellow-public-showcase-rate-approver.test.ts tests/yellow-public-showcase-rate-releases.test.ts
bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ESNext --module Preserve --moduleResolution Bundler --lib ESNext,DOM --types bun --skipLibCheck tools/reconcile-public-showcase-rate-approver.ts tools/provision-public-showcase-rate-releases.ts
bun D:/Yellow/temp/astra-order537-recovery-proof.ts
bun tools/provision-public-showcase-rate-releases.ts
```

- Focused source contracts:4pass/0fail/37assertions.
- Explicit strict tool typecheck:exit0/no diagnostics.
- Reviewer actual-preflight controlled proof:exit0, reproduces empty Locanda accepted as fresh and a non-original single draft/pending-approval fixture accepted without original idempotency evidence. Controlled fetch only; no actual transport or DB writes. This proves missing preflight checks, not that the unchanged backend would authorize arbitrary identifiers.
- Actual API dry preflight:exit0, properties2/unitTypes6/retainedReleases1. It confirms the currently exposed summary, not complete topology or original-operation binding.

Good boundaries retained: one transaction/advisory lock, transaction-local tenant setting, row locks, explicit two-row insert, no ON CONFLICT concealment, partial selected-pair refusal, canonical API-only publication and approver-access checks for both properties before requester mutation. These do not eliminate the identified fail-closed gaps. No grant reconciler execution, protected deploy URL loading, new approval decision, release activation, provider/OTA, deployment, reservation commit or375px completion occurred in this review. The prior Locanda drafts/pending approval remain untouched.

Require corrected exact topology/permission and retained-provenance checks plus reviewer-personal hostile executable proofs before grant/application. Then capture full before/after grant delta and protected-table fingerprints, execute exact no-op replay, and resume only the verified existing operation with original keys. Order533 remains blocked until canonical live offers and independent reservation replay evidence exist.

## Repaired source review — execution prerequisite blocked

Re-reviewed grant `35D28847381EAC6E0060EC2F9EDA871D0B048B1A7914DB95F135541B5A277828` and recovery `FB78B3840FB4A6CA0E2B2C48E9EC9D8F23BB1296D1D2918442CAD5226534B9E2`. Grant checks the complete canonical seed-derived permission set and all approver grants against exact initial/final topologies. Recovery rejects empty Locanda and pins model/target/release/approval/requester identity, then requires original-key draft/request replay before decision. Prior reported guard defects are repaired for these bytes; this is not yet operational acceptance.

Personally reran focused4pass/0fail/42assertions and explicit strict tools TypeScript with `--target ES2024 --lib ES2024,DOM`, exit0. Reviewer-owned `astra-order537-grant-controlled.ts` executes the actual reconciliation logic with a fake transaction: added permission, other-role and partial grants reject without INSERT; clean invokes exactly one two-row INSERT; exact replay invokes none. `astra-order537-recovery-proof.ts` now confirms empty/non-original Locanda rejection. Actual authoring compiler/serializer roundtrips pass both properties. Actual dry preflight reports2properties/6unitTypes/1retainedRelease. Fresh read-only release census remains3Locanda drafts/1pending approval/4facts/1event/2idempotency, London0.

Prepared reviewer-owned `D:/Yellow/temp/astra-order537-grant-live-proof.ts` to capture every public-table content fingerprint, exact added/deleted user_role rows and no-op replay. Invocation with `--apply` **stopped at protected-env-read before DB connection or grant child** because designated `D:/Yellow/runtime/yellow-public-demo.env` is readable but has no `YELLOW_DEPLOY_DATABASE_URL` assignment. One diagnostic retry identified the stage; a read-only PowerShell boolean check confirmed neither exact nor whitespace/export assignment exists. No values were printed. Authorized existing credential source or explicit in-memory construction mapping is required; none was guessed. No grants or release recovery have executed in this continuation.

## Final operational review — ACCEPT bounded Order537 recovery

Reviewer personally completed the repaired frozen scripts above after the coordinator explicitly authorized in-memory construction of the existing loopback deployment URL from the designated protected password/port/database fields. The URL and secret were not printed or persisted; child process environment was used only for the authorized local command. Frozen grant35D288... and releaseFB78B384... hashes were rechecked unchanged after execution.

### Grant command, exact delta and no-op replay

```powershell
bun D:/Yellow/temp/astra-order537-grant-live-proof.ts --apply
```

This wrapper captures complete row-content fingerprints (count plus deterministic digest of sorted full JSON rows) for **all129 public tables**, holds snapshots in reviewer process memory, and invokes the exact grant script with `--apply`.

- First actual grant child: `created=2; unchanged=false`.
- Before/after row comparison: exactly two new user_role rows, the prescribed tenant/approver/role and two target property scopes; zero removed rows. Exactly one table fingerprint changed: user_role. All128 other public tables retained their full fingerprints.
- Second child is the required exact replay: `created=0; unchanged=true`. All129 public-table fingerprints and grant rows unchanged against first postflight. Approver has exactly4 same-role scope rows, retaining the two pre-existing scopes.

These fingerprints establish the grant-only execution window, not a blanket no-delta claim across subsequent intentionally mutating release/reservation operations. The earlier missing-env wrapper attempts never launched a grant child; they are not additional applied grant runs.

### Release recovery and four-eyes execution

```powershell
bun D:/Yellow/temp/astra-order536-run-protected.ts --apply
bun D:/Yellow/temp/astra-order536-census.ts after
bun D:/Yellow/temp/astra-order533-api-proof.ts
```

Before recovery, read-only checks confirmed the original completed draft/request idempotency entries remain unexpired and point to pinned release/approval. The initial diagnostic query used an incorrect draft operation label and returned0; rereading source corrected it to `operator.rates.release.draft`, yielding exactly1 valid draft record and1 valid request record before invoking recovery. No mutation occurred on the mistaken query.

The wrapper now lets the actual helper authenticate the approver once and verify BOTH property builder/inbox surfaces before requester mutations. One resumable `--apply` child succeeded, exit0: properties2/activeReleases2/offerCounts LOCANDA3,LONDON3. It reused Locanda's pinned draft/approval through exact original-key/body replay, then executed distinct-approver decision/replay, requester publish409 denial, fresh approver simulation, publish/replay. London followed the complete fresh flow including requester self-decision409. The original Locanda self-decision409 was personally established during Order536; the retained branch does not re-run that denial.

Read-only all-history postflight, per property/plan:

- Exactly one model draft v1, one target draft v1 and one **active latest release v1**; no additional release versions or duplicate retained Locanda trio.
- Exactly one approved approval, requested by the pinned requester and decided by the distinct pinned approver.
- Exactly6 facts: model.drafted, target.drafted, release.drafted, release.approval_requested, release.approval_decided and release.published, one each.
- Exactly3 outbox rows: approval.requested, approval.decided and extension.activated, one each.
- Exactly4 completed successful-operation idempotency records; denied actions did not create extra persisted entries.
- Additional relational proof returned activeLatestV1=2, exactApprovedActors=2, publisherFactEventBinding=2: publication fact/outbox actors equal the approval decider, exact property matches stored release, fact approval ID and content/preview hashes match approval payload, fact request_id matches event correlation_id, and activation payload exactly names release type/key/version and three preview cells.

Each property's canonical future availability returned one bookable priced promise=false/commit-arbitrated offer per configured room type at the fixed amount. Requester-priced API read independently confirmed Locanda3 options, publication_unavailable0 and evaluated_pairs3. Before the separate Order533 proof, reservation651/segment651/occupancy230/journal0 were unchanged by release recovery. No provider/OTA, policy, inventory, financial or frontend deployment operation was performed.

## Order533 independent create/replay and remaining UI limit

`bun D:/Yellow/temp/astra-order533-commit-replay-proof.ts` personally created exactly one fictional future reservation using canonical existing Party selection, live L1BR offer and existing reservations:commit API. First201/replayed=false; identical command/key retry201/replayed=true with identical complete response. Read-only DB proof confirmed one reservation, segment, primary guest, occupancy row, actor-bound reservation.confirmed fact/outbox and completed idempotency record. Detailed identifiers and counts are recorded in Review533. No second reservation or occupancy claim was created by replay.

The required375px visible creation flow remains unavailable: browser-act core workflow reports no configured browsers/no API key; CUA inventory independently returns apps[]/browsers[]. Browser skill forbids silently creating an unapproved browser environment. No mobile screenshot or complete visual-flow result is fabricated. **Order537 grant/release recovery is accepted; whole-PMS or frontend release acceptance is not implied.**
