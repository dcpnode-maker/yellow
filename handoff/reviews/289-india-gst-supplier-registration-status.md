# Order 289 independent Tier-3 review — India GST supplier registration status

**Verdict:** APPROVED
**Reviewer:** OpenAI Codex independent review agent `/root/order289_reviewer`
**Candidate:** `35ad4349c579f45d613ba49bf223c6ced9132c9b`
**Base:** `bb22dd7`
**Branch:** `phase-7/india-gst-supplier-registration-status`
**Reviewed:** 2026-08-30

## Independence and scope

I did not implement Order 289. I read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`,
and read the complete `yellow-compliance-rules`, `yellow-entity-patterns`, and
`yellow-postgres-patterns` skills before inspecting or executing the candidate.
I reviewed the exact base-to-candidate diff and changed-file list. Every candidate
file is within the order's declared migration, resolver, tests, schema mirror,
documentation, build-plan, decision, ledger, and order scope. The immutable
`migrations/0001_init.sql` is untouched. `git diff --check bb22dd7..35ad434` is
clean and the worktree was clean before this review record.

The implementation adds one tenant-leading, forced-RLS, SELECT-only evidence root
and one exact equality resolver. It does not add a writer, network/portal call,
clock/latest lookup, statutory time-of-supply decision, SEZ approval substitution,
tax calculation, posting, document, API, UI, or local promotion authority.

## Primary-source statutory check

I inspected the following official primary sources:

- GST Portal, *Welcome Kit for New Taxpayers*, section 3.4, pages 17–18:
  <https://tutorial.gst.gov.in/downloads/news/welcome_kit_for_new_taxpyers.pdf>.
  The official taxpayer search exposes `Taxpayer Type` and `GSTIN / UIN Status`
  as separate fields and identifies the common-portal taxpayer-search route.
- CBIC, Central Goods and Services Tax Act, sections 25, 29 and 30:
  <https://cbic-gst.gov.in/hindi/CGST-bill-e.html>. These establish registration,
  cancellation (including effective/retrospective dates), and revocation of
  cancellation as independently changeable registration facts.
- CBIC, CGST Rules, Rule 21A:
  <https://cbic-gst.gov.in/pdf/10112020_CGST-Rules-2017_Part-A_Rules.pdf>.
  Rule 21A separately governs suspension and its effective date and states the
  consequences of suspension.
- CBIC registration rules:
  <https://cbic-gst.gov.in/gst-registration-rules.html>. The official rules state
  that an SEZ unit or SEZ developer makes a separate registration application,
  supporting the preserved `regular|sez_unit|sez_developer` taxpayer-type boundary.

These sources support the order's narrow model: preserve exact portal status/type
evidence for an explicit date and fail closed unless status is affirmatively
`active`. They do not support inferring active status from GSTIN syntax, address,
property configuration, Form G/F2, or SEZ labels, and they do not make the evidence
date a statutory time-of-supply decision. The candidate correctly excludes all of
those inferences.

## Reviewer-executed proof

All database proof used the isolated PostgreSQL 16.15 container
`yellow-order289-proof-pg2` on `127.0.0.1:5559`. Credentials came from the approved
local authority file and were never printed. The isolated database was reset and
re-migrated where a pristine fixture was required. I did not alter or promote the
stable application.

| Proof | Reviewer result |
|---|---:|
| Focused Order 289 hostile + live PostgreSQL RLS/ACL suite | `10 pass / 0 fail / 225 expectations` |
| Fresh deployment database acceptance on canonical `yellow_dev` | `20 pass / 0 fail / 58 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 114 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Normalized `pg_dump` versus `tests/schema/expected.sql` | exact match |
| Exact catalogue | `55 migrations / 107 tables / 97 RLS / 97 policies / 7 FORCE RLS` |
| Fresh standalone invariant referee | `11 passed / 0 failed of 11` |
| Adjacent Orders 284–289 behavior without historical DB locks | `60 pass / 0 fail / 29 DB skips / 1,453 expectations` |
| Live Order 284 dependency proof | `17 pass / 0 fail / 228 expectations` |
| Live Order 288 dependency proof | `10 pass / 0 fail / 227 expectations` |
| Full standing suite | `976 pass / 0 fail / 865 database-only skips / 15,108 expectations`; `1,841 tests / 322 files` |
| TypeScript | `tsc --noEmit` green |
| Context boundaries | `112 TypeScript files scanned` green |
| Dependency licence policy | `23 installed packages` green |
| Dependency audit | no vulnerabilities |
| Schema-drift utility unit suite | `4 pass / 0 fail / 19 expectations` |
| Migration SHA-256 | `c0f50dc59178da55cd89ad06bcbd4ee48f36a48e154c07e41b089a7608cb1f80` |

The Order 285 and 286 live catalogue assertions deliberately preserve their own
approved historical 52/53-migration snapshots. I did not weaken or reinterpret
those historical locks against the later 55-migration descendant. Their behavioral
suites remained green, while current descendant schema authority was proven by the
Order 289 acceptance, migration, dump, catalogue, and referee gates above.

Two reviewer harness observations were resolved without product changes:

1. Database acceptance was first pointed at `yellow_test`, whose intentional
   two-tenant invariant fixture cannot satisfy the acceptance suite's canonical
   one-demo-tenant assertion. The same suite passed `20/0` against the correct
   canonical `yellow_dev` target.
2. The first standalone referee invocation encountered state left by an earlier
   completed referee run (an existing occupancy claim and sealed business day).
   I recreated only the isolated `yellow_test`, applied all 55 migrations, loaded
   the canonical invariant fixture, and personally reran the referee `11/11`.

Neither observation was a candidate assertion failure; only the clean reruns are
counted as approval evidence.

## Stable-local preservation

After all reviewer proof, the sole stable local remained unchanged and healthy:

- app `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf`,
  port `3000`, healthy, restart count `0`;
- PostgreSQL `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`,
  port `5545`, healthy, restart count `0`;
- Valkey `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`,
  port `6485`, healthy, restart count `0`;
- `GET http://127.0.0.1:3000/health` returned `200 {"status":"ok"}`.

Order 289 was not promoted to that local. The isolated proof container remains for
the coordination owner to remove after integrating this review.

## Findings and verdict

No blocking, high, medium, or low-severity product finding remains. The exact
candidate `35ad4349c579f45d613ba49bf223c6ced9132c9b` is **APPROVED** for Order 289.
