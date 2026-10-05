# Independent review — PMS-CRS-20260930 staff offer search

**Date:** 2026-09-30
**Reviewer:** `/root/yellow_design`, independent non-implementer
**Requested reviewer configuration:** GPT-6.1 / ultra; assigned by the coordinator. Runtime model identity is not independently attested by a tool; the coordinator's model identity is not inferred.
**Basis:** `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`
**Branch:** `phase-7/pms-crs-staff-offer-search-20260930`
**Verdict:** APPROVED for the frozen, bounded staff CRS query behavior and source handoff below. RELEASE GATES REMAIN RED. This is not an all-green PR, full PMS/CRS completion, laptop integration, merge or deployment approval.

The reviewer changed no production source, tests, configuration, schema or proof assertions. This record is the reviewer's only repository edit. A read-only child reviewer assisted with hostile-stream analysis; the reviewer personally reproduced the material failure and executed the final acceptance proofs.

## Scope and architecture

The route in `src/app.ts` adds only three lines under the existing operator tenant wrapper with route-local `parse: "none"`. `src/http/operator.ts` adds one import and the new method, preserving the constructor, existing single-property endpoint, parser, serializer and grant query. `src/http/crs-search.ts` introduces the raw-body reader and serial orchestration. Context imports use public indexes. No domain, index export, migration, permission, event, occupancy, reservation, financial, payment or frontend change was found.

The facade requires the existing availability scope before reading the body. It accepts exactly one to four distinct UUID property searches, delegates each canonical payload to the existing parser, snapshots requests before asynchronous grant loading, and snapshots authorized property identity/name/timezone before offer calls. Every selected property must belong to the live grant result before any offer call occurs. Unknown, foreign and ungranted IDs produce the same generic forbidden response. Serial offer evaluation retains one tenant transaction and the unchanged canonical serializer. Later failures return no partial property batch.

Property-specific offset-aware instants, property-local dates, policy/publication/availability/quote evidence and decimal money strings remain with the existing offer engine. There is no currency aggregation or new availability promise. Four searches retain the existing per-property 1,000-pair ceiling; this bounds candidate work rather than end-to-end latency. The 10-second deadline applies to body reading, not offer-service execution.

## Findings resolved before this verdict

1. **Body reader deadline could be bypassed by synchronous empty chunks.** The reviewer personally supplied 100,000 zero-byte chunks followed by valid `{}`, using the internal 1 ms deadline. The original reader accepted `{}` after approximately 64 ms while the timer never fired. The assisted reviewer also observed an unbounded producer require an external kill. Empty chunks accumulated without consuming the byte budget, and microtasks starved the timer.

   The coordinator repaired only the helper: monotonic deadline checks before and after every read, including completion; discard empty chunks; reject more than 1,024 consecutive no-progress reads; retain nonblocking cancellation. The reviewer reran the original finite probe: generic 400 rejection in approximately 2 ms. Permanent unit regressions now cover the finite hostile producer and a supported empty fragment. Independent final probes also rejected a default-deadline endless empty producer by the no-progress bound, without retaining its chunks or awaiting a producer's never-settling cancellation.

2. **Mutable granted-property references could influence later searches.** Static inspection identified this seam before execution. The builder replaced retained grant rows with frozen local identity/name/timezone snapshots. A personal post-repair probe mutated a later grant ID during the first awaited offer call; the subsequent search still used the original authorized property. No claim is made that the reviewer executed the pre-repair version of this finding.

3. **The no-write proof needed deployment/runtime target binding.** Initial integration code checked each URL's disposable name and runtime role but did not explicitly prove both connections inspected the same database. The final proof compares normalized host/effective port/database before connection, then actual database name/OID, server address/port and postmaster start before seeding. Runtime authority is checked before fixtures. The reviewer inspected this refinement and executed both its positive and negative modes.

## Personally executed proof

All commands used pinned Bun 1.3.14. Synthetic PostgreSQL proof used only coordinator-owned disposable PostgreSQL 18 databases. Neither credentials nor private runner configuration were read or printed.

| Proof | Actual result |
| --- | --- |
| `PATH=/workspace/yellow-toolchain:$PATH bun test tests/pms-crs-20260930-staff-search.test.ts tests/pms-crs-20260930-staff-search.http.test.ts` | 27 passed, 0 failed; 163 assertions; final fixture revision |
| `python3 /workspace/yellow-coordination/run-proof.py tests/pms-crs-20260930-staff-search.integration.test.ts` | 6 passed, 0 failed; 66 assertions; no database skips |
| Same required runner with `--missing-runtime`, `--missing-deploy`, `--owner-runtime`, `--mismatched-target` | Each exited 1 with the expected generic authority/setup error; no accepted skip |
| `PATH=/workspace/yellow-toolchain:$PATH bun test tests/operator-calendar-validation.test.ts` | 4 passed, 0 failed; 16 assertions |
| `PATH=/workspace/yellow-toolchain:$PATH bun run typecheck` | Exit 0 after fixture-only typed-array correction |
| `PATH=/workspace/yellow-toolchain:$PATH bun run boundaries` | Exit 0; 205 TypeScript files; no violations |
| `git diff --check` | Exit 0 |

Mounted HTTP tests use the real app/operator parser and serializer with controlled identity/database ports; they are contract proofs, not PostgreSQL authority proof. The separate real PostgreSQL suite uses the real offer engine, runtime `yellow_runtime` login and transaction-local `app_role`. It proves two tenants, two selected properties, ancestor and exact grants, denied peer/foreign/unknown/mixed requests, unsigned/unscoped requests, actor/tenant claim mismatch and post-token grant revocation. Every denied authorization batch makes zero offer calls.

Canonical batch results equal the existing single-property facade's entire serialized results in the same real tenant transaction. This preserves transaction-time quote and availability hashes rather than deleting volatile evidence to manufacture equality. One seeded property has bookable published USD offers and policy/availability/quote evidence; the Kathmandu/NPR peer has no candidate pairs. The proof establishes empty-peer parity and labels, not a second bookable currency/timezone valuation scenario.

One reused runtime backend alternates tenants and sees only its own property. Full public-table row fingerprints and public-sequence state fingerprints remain equal before/after successful, denied, malformed and domain-invalid searches. Deployment and runtime are bound to the same live database before these fingerprints are meaningful.

Additional personally executed inline probes, without source/test edits, verified hostile empty-chunk work bounds, stalled reads, request abort, nonblocking cancellation, byte-fragmented Japanese/emoji UTF-8, lying Content-Length, exact 64 KiB acceptance and 64 KiB + 1 rejection. The final repaired-reader probe reported eight checks passed. Earlier independent probes also verified case-insensitive UUID duplicate handling, frozen grant identity and preservation of a decimal amount beyond JavaScript's safe integer range; these are facade/serialization checks, not financial valuation proof.

## Actual open gates and inherited limitations

- **Existing offer regression remains RED.** The reviewer personally ran `/workspace/yellow-toolchain/bun /workspace/yellow-coordination/run-legacy-offers.ts`, then the same command with `--baseline`, sequentially. Each creates/migrates/seeds a fresh synthetic database and removes it. Both candidate and pristine tracked e06 baseline exited 1: **1 passed, 5 failed, 16 assertions**. The baseline HEAD was personally verified as e06 and its tracked diff was empty. P1 expects five candidates but the current review seed provides two; P2 expects two DLX results but receives one; P3 expects three STD results but receives one; its early assertion leaves a restriction that affects P4; P5 expects ten exact reads but receives four. Matching failures establish an inherited gate failure, not a passing regression. No assertions, domain behavior or seed data were weakened for this slice.
- **License gate remains RED.** Personal `bun run license-check` exited 1: `tslib@2.8.1` declares `0BSD`, rejected by the existing policy. Checker, package manifest and lockfile have no candidate diff. The coordinator separately reproduced the committed checker's failure. This order grants no legal-policy or dependency change; no green release claim is supported.
- The coordinator executed the **unmodified canonical** `./setup.sh --db-only` on an owned isolated Compose project with pinned images and obtained **11 passed, 0 failed of 11**, exit 0. The reviewer inspected `/workspace/yellow-coordination/setup-db-only.log`: actual execution applied 100 migrations and found 130 tables despite stale migrations 1–99 prose. This is coordinator-executed referee evidence, not claimed as the reviewer's personal command. No setup/schema assertion was changed.
- Existing bearer verification and property-grant lookup do not perform a new request-time active-user status join. Live grant removal is proved; disabling an actor after token issuance is not a capability introduced or proved here. The contract now correctly says authenticated actor. An active-status hardening slice would need its own scope.
- The full standing suite and legacy workbench release closure are not asserted. The coordinator's broader focused run was 41 passed, 0 failed, 360 assertions; that reported run is distinguished from the reviewer's commands above.
- `state.sh`/project-status retain older lifecycle/order metadata. This record's exact basis and the human's dated order govern this isolated work. The laptop's protected dirty files remain separate integration authority. The newer published MCP/tooling and PostgreSQL-version documentation discrepancies were observed during source inventory; this order neither resolves them nor relies on added MCPs.

## Frozen reviewed source

The following SHA-256 values were personally captured after final proof and recaptured after the legacy baseline comparison. Later production or test changes require fresh review and relevant proof.

```text
89cd679498fd3aa0f2271c85e5ef79c1e0d9af847355bed2fcc533944aeefcf1  src/http/crs-search.ts
2f7c545585189f206276a90163d60133c8f5c98acf4a9a149876da83ee04d590  src/app.ts
1a703a8b40e3e6a45573b7ba9ea48e51d85103f7b63eef9b4ec4798710093dc9  src/http/operator.ts
252340e6a09864174644f4a4b8ff61a3f75b38b3f2024931f768c8a043baefe8  tests/pms-crs-20260930-staff-search.test.ts
68e71a4c2758ace6060ef2db0c5fa3d0046be33b23445c30260c5f5f027facaf  tests/pms-crs-20260930-staff-search.http.test.ts
e48d6906da077022c9aa619ec28657dd372e6581c49ae3cec0aea7af2170d6c7  tests/pms-crs-20260930-staff-search.integration.test.ts
5455c41027efe39b9dc930aba2effc7f0d53ac415b76bedc7de69fb325acf201  docs/CONTRACTS.md
```

Only the dated order/review and allowed contract/decision/ledger additions accompany the frozen product/test files. Governance updates do not authorize broader source work. The protected app/operator hunks must be compared and applied against the laptop's supplied current source rather than overwriting its dirty files; the resulting laptop candidate needs its own integration/proof reconciliation. There is no real guest/payment access, CompSet work, publication, push, merge or deployment in this review.

## Retained packaging check limitation

The earlier unstaged `git diff --check` commands passed for tracked changes but excluded the then-untracked new order and review records. The first complete staged comparison during packaging detected their Markdown hard-break trailing spaces. The initial local commit `ab18c1da64e774c3816e1db754e6b2b58f7175cf` is retained; the reviewer removed only this record's trailing spaces and the coordinator separately trimmed the order for a formatting follow-up. Earlier unstaged checks are not evidence that the new records were whitespace-clean. Production/test files and their reviewed hashes are unchanged; the release blockers and limited verdict remain in force.

After both records were trimmed, the reviewer personally executed `git diff --check e06e400a57485cc10a8a35c21dcb1e01b5a667d1`: exit 0, no diagnostics. This complete basis comparison includes the newly tracked records. A separate trailing-whitespace search found no matches in either dated record, and the production/test SHA-256 manifest still matched every reviewed value.
