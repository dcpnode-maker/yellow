# BOOKING-20261001 — Independent guest invitation review

Reviewed 2026-10-01 by `/root/guest_booking_security_review`, an independent nonimplementer. No feature, migration, or test source was edited by this reviewer. Basis: `444072ffdff2b7745345d88f71b603c17e11ace6` plus the 23 reviewed files bound by the receipt below.

**Conclusion:** the bounded invitation authority and booking source pass independent review and the personally executed owned PostgreSQL proof. Complete release/PR acceptance remains pending the separate broad-suite host-fixture failure. No laptop admission, publication, serving migration, deployment, public exposure, or full phase/product completion is approved by this review.

## Personally executed evidence

- Registered runner, after the parent's `104READY` and exclusive fixture handoff: `python3 /workspace/yellow-coordination/guest-booking-proof-20261001/run_guest_booking_proof.py` — **11 pass, 0 fail, 95 assertions**, 6.98 seconds, PostgreSQL 18, `yellow_runtime` entering transaction-local `app_role` on the owned synthetic `yellow_guest_booking_proof` database.
- The runner's `--missing-runtime`, `--owner-runtime`, and `--mismatched-target` modes each refused admission with exit 1 before fixture setup. These expected negative results are not ordinary-suite success counts.
- Guest token/domain/HTTP and mounted-route suites plus build-readiness and setup catalogue oracles — **39 pass, 0 fail, 452 assertions**. This includes the real staff and guest signers rejecting each other's tokens with the same configured secret.
- Typecheck passed. The direct pinned import-boundary runner passed **212 files**. An initial `bun run boundaries` attempt failed because `bun` was absent from the script's PATH; the explicit pinned Bun invocation corrected that environment issue without changing source.
- A separate reviewer-only synthetic late-idempotent-replay probe advances the settlement clock beyond the session lifetime and observes rejection with status 401. The permanent native late-I/O tests additionally prove quote/session and hold/quote expiry with unchanged durable fixture counts.

Personal native receipt: `/workspace/yellow-coordination/guest-booking-proof-20261001/native-integration-20261001T192319027455Z.json`; matching log SHA-256 `f142f726c50ae1cf7df56511eeebfa037f423973c82e0c16712c7aabb89ed43b`. Integration test SHA-256: `5be2a19cdf88e3d8349be24a03a7c5672e42f8d4a20e28f66b31f4f42fd97546`.

Initial reviewed file hashes and results, preserved unchanged: `/workspace/yellow-coordination/guest-booking-proof-20261001/independent-review-receipt-initial.json`, SHA-256 `17e88f5977213f2d98770e1f6470d1399b30cf0d0351abea625a19636a26ac06`. Migration 0104 SHA-256: `4c41dc4765ecbfe705999c5d5980ea482579403bdc681e468669fd3021c6be4a`.

## Reviewed authority and state behavior

The five fixed issuer permissions are checked live for the exact tenant/property/actor. The owner function checks the runtime session, selected internal role, owner identity, and transaction-local tenant setting. All authority relations are schema-qualified; its search path is fixed. Execution is granted only to `app_role`; native role/tenant/foreign reference probes and a populated temporary-relation spoof fail with SQLSTATE 42501.

Authority rows, the active Party, and selected plan/policies are locked through transaction settlement. The native revocation race proves grant deletion waits for an in-flight quote and disables the next command. The migration adds one owner assertion and no table or runtime table-DML grants. The integrator's separate migration ACL receipt reports unchanged runtime table privileges; the strict schema snapshot adds only 69 function/ACL lines. This reviewer inspected those artifacts but did not personally rerun migration application or canonical setup. The integrator's `SETUP104_RECEIPT.json` and setup log report the canonical referee 11/11.

Session, quote, and hold bearers use a purpose-separated derived HMAC key, strict expiry, bounded JSON, and immutable authenticated session objects. Guest requests cannot supply tenant/property/Party/channel/actor authority. Allowed plans are locked in sorted order before offer selection, and returned option/issue IDs are checked against the invitation allowlist. Fresh PostgreSQL wall-clock checks cover blocking I/O, mutations and successful replay settlement.

Hold creation re-quotes under the existing publication lock, compares financial/policy/release evidence and uses the complete calculated-tax gate. Canonical 600-second holds require at least 600 seconds of invitation lifetime remaining; otherwise staff must issue a fresh invitation. Hold-token authority expires no later than the actual hold and session. Session-derived hold and commit keys enforce exact replay and changed-choice conflict. Native proof exercises one successful commit, exact hold/commit replay, cross-session/tampered tokens, price/release/policy drift, incomplete tax, expired database hold, last-unit arbitration and outbox-failure rollback. Occupancy uses the existing choke points; tax lineage, reservations, facts, outbox and command records settle in one tenant transaction.

Mounted public routes use the distinct guest bearer boundary and bounded raw JSON parsing. Issuance uses the existing staff tenant boundary. Error bodies remain generic, responses are no-store, bearer authority is absent from URLs/audit events, and response-size failure rolls back writes. Server composition supplies the canonical rate/availability, hold, attribution and commit dependencies.

## Findings resolved during review

The integrator corrected stale transaction-clock expiry, the plan-code allowlist race, and a missing tax-persistence constructor dependency. Native execution also exposed and corrected the nonexistent `cart_hold` read, unsupported shortened canonical hold duration, invalid audit-envelope extras, and fixture assumptions/cleanup. Original failed attempts remain retained under the owned proof directory; no failed assertion was waived by this reviewer.

## Proof and completion boundary

The native suite uses real PostgreSQL authority/RLS, rate configuration and quote evaluation, hold/occupancy, tax persistence/lineage, reservation commit, command replay and transactional audit/outbox. Availability, publication and tax-jurisdiction inputs are controlled synthetic ports. This proves the bounded command composition and state effects, not a deployed guest journey using production rate releases or provider data.

The integrator reported the earlier broad run as 2578 passes, 1617 explicit skips and two failures: the derived migration-frontier mismatch was corrected to 104; `tests/owned-proof-process.test.ts` retains a Linux grandchild/process-absence cleanup failure. This reviewer did not execute that broad run and does not declare full standing green. The integrator has started a fresh full-standing run using a subreaper environment runner to reap its owned child, without changing or waiving the test. Its result is pending at this review checkpoint. Source promotion remains pending exact full standing; the original failed run remains evidence.

This slice requires an existing active Party and staff-delivered invitation. Anonymous registration, individual invitation revocation, payments, frontend guest UX, provider activation and hosting remain outside its completion claim. No public/tunnel/real-data/paid/CompSet action occurred in this review; credentials and private authority contents were not printed.


## Migration104 metadata closure — independent follow-up

The amended order and resolved `handoff/questions/BOOKING-20261001-frontier104-closure.md` admit only the remaining current-frontier literals in `scripts/local-review.sh`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, and their free-host ARM64/release workflow test expectations. This reviewer inspected every diff and verified that each changed line is exactly a 103-to-104 replacement. Jobs, triggers, publishers, permissions, deadlines, release eligibility and deployment behavior are unchanged.

Personally executed `bun test tests/free-host-arm64.test.ts tests/release-workflow.test.ts` with the pinned Bun binary: **10 pass, 0 fail, 126 assertions**. Hash checks confirm every previously reviewed booking source/test, migration104, schema, composition, setup and readiness byte is unchanged; only the amended order changed among the original receipt's files. The native **11/0/95** proof remains bound to those stable bytes and was not rerun.

The successor receipt now binds **29 files**: `/workspace/yellow-coordination/guest-booking-proof-20261001/independent-review-receipt.json`, SHA-256 `dff12cc37bce03b517a403fceae13f93220fcaf5bfa6f0c40089dd42c9485413`. The initial receipt and all earlier failed runs remain preserved.

The integrator reports its owned subreaper environment proof **7/0/25**, with the process test unchanged and 116 adopted children reaped. Its two successive broad runs each reported **2580 pass / 1 fail**: first the release metadata oracle, then the ARM64 metadata oracle. Both failures prompted the literal repairs reviewed above; neither was waived. Actual owned runtime readiness on104 is separately reported green. This reviewer did not execute those environment/readiness/broad runs. The final full-standing rerun is pending at this checkpoint, so source promotion and complete release acceptance remain pending its exact result.


## Final source acceptance checkpoint

The integrator's final owned-subreaper full-standing run is **2581 pass / 1618 explicit database/environment skips / 0 fail / 45297 assertions**, 65.32 seconds, with 116 owned adopted children reaped. This reviewer read the final totals and verified the exact log SHA-256 `3be575cd72422ee026dcb4b295057d6eca5f8d6ec697e2ae00668a7d50a00dc2` against `quality-full-subreaper.log` in the owned proof directory. The integrator's final canonical setup reports **11/11**, 5.453 seconds, with final104 labels; its `setup104.log` hash was verified as `4c8870930bab3d5cc51d8754b2d9acb7c4793464c04b60964b8b5f4350194f1c`. The separate owned `runtime-readiness104.json` reports actual current104 readiness passing. These are inspected integrator receipts, not full-suite/setup/readiness runs personally executed by this reviewer.

All 29 reviewed hashes still match. The earlier host-fixture and metadata failures remain historical evidence; final standing clears their acceptance blockers without assertion waivers. Bounded guest-booking source publication is accepted on this review, the personal native **11/0/95** proof, personally executed focused checks, and the inspected final standing receipts. Exact published-head remote CI and receiving laptop integration remain pending. This does not approve serving migration, deployment, hosting, complete guest-engine/frontend/payment behavior, or phase/product completion.

Final independent receipt: `/workspace/yellow-coordination/guest-booking-proof-20261001/independent-review-receipt.json`, SHA-256 `c68c6fb20b31479c324b0e3965e206b8b84fc86fd1cbeb83301dc081dabfce6f`. The previous metadata checkpoint is preserved as `independent-review-receipt-metadata.json`; the original receipt remains `independent-review-receipt-initial.json`.
