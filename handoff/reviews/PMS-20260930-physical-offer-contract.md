# PMS-20260930 — Independent physical-offer contract review

Date: 2026-09-30. Reviewer: `/root/yellow_design/crs_hostile_read`, independent
non-implementer, explicitly authorized by the root coordinator. Read PROJECT first,
then AGENTS, current lifecycle/Phase7, D-140/D-284 and the dated PMS order.
Basis: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`.

## Verdict

**APPROVE the bounded source contract repair and final scoped proof.** No remaining
material correctness, authority or proof-sensitivity finding in the reviewed slice.
This accepts the exact hashes below; it does not approve publishing, deployment,
laptop integration, the whole PMS/CRM product, or an integrated release candidate.
The inherited license policy remains RED in this worktree. The separately accepted
license-policy artifact is not silently included in this verdict.

The reviewer changed no production, test, configuration, order or governance bytes
and installed nothing. The only authored repository file is this review. All database
execution used coordinator-provided safe wrappers and task-owned disposable targets;
no private authority values were inspected or printed.

## Frozen inputs

| File | SHA-256 |
| --- | --- |
| `src/contexts/reservations/offers.ts` | `f6be07554c3d44198125483f62811450fd097f0c5f7d9915c597dc18707d10fe` |
| `tests/pms-20260930-physical-offers.test.ts` | `4415dc3e64e1e7438790a806083cef256a9f7a000890b05c7386b97acbbc90ae` |
| `tests/pms-20260930-physical-offers.integration.test.ts` | `3d370cd5acdcd5bfe4c33bbae7fb467eee17f41ab997dd26e2e001f23c27a626` |
| `tests/reservation-offers.integration.test.ts` | `5b0616ff693e688ed7a7c4d1b0d61b92f542707a980a16564b11e149c092a5d8` |
| `docs/CONTRACTS.md` | `968f4ea07b0eebbe7b84a4fc78200c85c463f93e75a7628b174e79eb28d64fe5` |
| Dated PMS order | `3d136c58567879ecc838bb68f8e2fbef89d97c343c1bbac4dd0703200687f700` |

Protected bytes equal the basis: `migrations/0001_init.sql`
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
`tests/run_invariants.py`
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`.

## Source and proof assessment

D-284 and CONTRACTS159–168 require every published physical sellable/rate pair.
The inherited unit-type deduplication violated that contract before both the pair
ceiling and exact quote loop. Availability sorts by type/name/id, so it cannot pick
a bookable representative: a blocked first sibling can conceal available later
siblings, and a later blocked sibling can disappear. The sole production hunk
removes that deduplication. Existing filters, exact quote rereads, quote/policy/tax
evidence, bigint money, output ordering, authorization and hold/commit arbitration
remain unchanged. The full physical pair count reaches the existing pre-quote cap.

The current canonical fixture has six active rooms, three STD and three DLX. The
new restricted proof independently measures raw AvailabilityService output and exact
physical IDs, then compares each returned offer with its own canonical quote in the
same transaction: hash, release, availability reference, state, nightly money and
total. It exercises blocked-first/available-later and the reverse ordering, and
proves a five-pair cap rejects six candidates with zero resolver calls. Full public
table-row fingerprints and every actual public sequence's last_value/is_called are
compared around successful and cap-denied reads. Effective app_role and the login
are non-superuser/non-BYPASSRLS; tenant context and matching live database identities
are verified before seeding.

The legacy suite deliberately disables only Room203 inside its owned disposable
fixture, preserves its documented five physical candidates, then verifies original
status restoration. All 48 original assertion statements remain, with seven new
admission assertions. Occupancy uses the sanctioned record/release functions and a
typed OOO parent; assertion failures run finally cleanup. Failed release retains
the parent. URL admission requires the loopback exact regression database; actual
database/session/current-user/owner admission precedes review seed and mutation.
Rejected admission closes initialized pools and performs no cleanup DML.

Earlier fixture-only RED classification is corrected: physical deduplication is a
production regression, while six-versus-five seed counts are a separate fixture
drift. Historical reports and RED receipts remain untouched.

Independent findings were repaired by the builder: initial uniqueness-only hash
checks did not prove per-room evidence association; the direct raw six-room oracle
was indirect; legacy target admission was absent; failed release deleted the OOO
parent; and rejected owner admission still reached cleanup DML. Final source/proof
inspection and affected reruns close these findings. Failed-release retention was
source-reviewed; no artificial database release failure was injected.

## Personally executed commands and results

Safe logs are retained under `/workspace/yellow-coordination/pms-offers-proof/`.
The pinned Bun is `/workspace/yellow-toolchain/bun`, version 1.3.14.

| Command | Observed result |
| --- | --- |
| `python3 /workspace/yellow-coordination/run-pms-offers-proof.py --baseline` | Final identical frozen `3d370cd5` proof: intended RED, 0 pass / 1 fail / 6 assertions; raw six candidates pass, offers expected6 / actual2. |
| Same runner, candidate | Final hardened proof: 1 pass / 0 fail / 69 assertions. |
| Same runner with `--missing-runtime`, `--owner-runtime`, `--mismatched-target` | Each exits1 at its intended authority guard before fixtures; no accepted skip. |
| `/workspace/yellow-toolchain/bun run /workspace/yellow-coordination/run-pms-legacy-offers.ts` | Final hardened legacy: 8 pass / 0 fail / 83 assertions: three pre-registration tests and five PostgreSQL cases. |
| Same legacy runner with `--wrong-target` | Intended exit1 before connection: 0 pass / 1 fail / 1 error. |
| Same legacy runner with `--wrong-session` | Intended exit1 at connected identity admission: 0 pass / 1 fail; no extra cleanup DML error. |
| `/workspace/yellow-toolchain/bun test tests/pms-20260930-physical-offers.test.ts` | 2 pass / 0 fail / 22 assertions. |
| `/workspace/yellow-toolchain/bun run typecheck` | Exit0 after the final fixture hardenings. |
| `/workspace/yellow-toolchain/bun scripts/check-import-boundaries.ts` | Exit0; 205 TypeScript files. |
| Complete basis, cached and untracked whitespace/scope checks | Clean; exact nine authorized paths, including this review. |

The final baseline, candidate and all three authority controls were personally
executed using the identical frozen dated proof at `3d370cd5`, with no source/test
change between them. The final baseline/control receipts are named
`independent-hardened-baseline.log` and `independent-hardened-<mode>.log`; candidate
receipt is `independent-hardened-candidate.log`. Earlier `c98d18fd` baseline/control
runs, 19-assertion and 69-assertion candidate runs, and legacy 6/0/76 remain historical
logs rather than substitutes for the final frozen receipts.

The package-script boundary invocation initially could not locate Bun in PATH;
the same check passed through the pinned executable. A thin dependency tree reported
zero installed packages and was rejected as license evidence. Auditing the populated
`/workspace/yellow-pms` tree with this worktree's unchanged audit module instead
returned 66 accepted packages and one failure, `tslib@2.8.1` declaring 0BSD, with zero
license choices. No license policy was changed in this slice.

## Separately governed CRS compatibility

`handoff/orders/PROOF-20260930-crs-physical-parity.md` authorizes the disposable
`/workspace/yellow-pms-parity-preview`, detached at 40eb866. The reviewer byte-compared
the six copied CRS files with accepted `fbc5f00b961fd202bb95bc70b450486fc8d0dd25`;
all match. The preview's offer source
matches frozen `f6be0755`. It contains only those seven code/test inputs plus its
proof order; it is not a promoted combined source tree.

| Accepted CRS input | SHA-256 |
| --- | --- |
| `src/http/crs-search.ts` | `89cd679498fd3aa0f2271c85e5ef79c1e0d9af847355bed2fcc533944aeefcf1` |
| `src/app.ts` | `2f7c545585189f206276a90163d60133c8f5c98acf4a9a149876da83ee04d590` |
| `src/http/operator.ts` | `1a703a8b40e3e6a45573b7ba9ea48e51d85103f7b63eef9b4ec4798710093dc9` |
| CRS pure test | `252340e6a09864174644f4a4b8ff61a3f75b38b3f2024931f768c8a043baefe8` |
| CRS mounted HTTP test | `68e71a4c2758ace6060ef2db0c5fa3d0046be33b23445c30260c5f5f027facaf` |
| CRS required PostgreSQL test | `e48d6906da077022c9aa619ec28657dd372e6581c49ae3cec0aea7af2170d6c7` |

Personally executed the two original pure/mounted files: 27 pass / 0 fail / 163
assertions. Personally executed
`python3 /workspace/yellow-coordination/run-crs-physical-parity-proof.py`: 6 pass /
0 fail / 66 assertions. Same-transaction batch/single-property canonical evidence
parity, current brand/exact grants, stale revocation and foreign/unknown/mixed
denials, restricted pooled tenant context and public row/sequence fingerprints pass.
These receipts prove the exact governed preview composition; dirty laptop/UI
compatibility and publication are not inferred.

## Referee and completion boundary

The root coordinator personally ran unchanged `./setup.sh --db-only`; the reviewer
read its safe log at `/workspace/yellow-coordination/pms-offers-setup-db-only.log`:
**11 passed / 0 failed of 11**, followed by disposable database removal. The root
verified the actual catalogue as **100 applied migrations and 130 public tables**;
the setup log's printed migrations 1–99 prose is inherited stale text. The reviewer
also counted 100 current SQL migration files. This is root-executed referee/catalogue
evidence, not a claim that this reviewer executed setup or independently queried
its migration ledger. Protected source hashes were independently compared with
the basis.

Source correctness acceptance is bounded to this PMS repair and exact scoped
fixtures. The root owns final staging, governance integration and release decisions.
No real guest/payment/CompSet data, paid actions, push, merge or deployment was involved.

## Final cached checkpoint — 2026-09-30

Personally inspected the complete staged change against `40eb866`: exactly nine
authorized paths; staged/worktree source, test and contract hashes match the frozen
inputs; protected migration/invariant bytes remain equal to the basis. Governance
is append-only and the contract retains every inherited byte around its sole added
clarification. The order now hashes to
`3290f2395d54cde728227b44119f41ed6af5e9f3f1da340ad143eeaf54f38eda`:
only the coordinator's accurate completion checkpoint was appended to the earlier
frozen order. Cached/basis/worktree whitespace passes; no other unstaged or
untracked paths existed before this authorized review-only append. No tests rerun;
bounded approval stands. Coordinator owns restaging this checkpoint and commit.
