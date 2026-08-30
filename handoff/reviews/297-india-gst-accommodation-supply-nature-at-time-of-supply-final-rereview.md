# Order 297 final fresh independent Tier-3 re-review

**Reviewer:** `/root/order297_final_rereview`, fresh non-implementing OpenAI Codex agent
**Candidate:** `f9f83191d30a51bf06e5a555ea30fd83ed9dc73c`
**Approved base:** `a9cb63e35028823fb09474f5deef8d9f948f58d2` (Order296 D-800 governance descendant)
**Prior rejected candidates:** `c789eb467a3276a7b0047020eeaa39722ee4b80b`, `eeaf8709953d6f0e38b7633dece7eb217f9c2881`
**Result:** **CHANGES REQUIRED**

## Independence and exact target

I did not implement or previously review Order297. I read `PROJECT.md`, `AGENTS.md`,
ran `state.sh`, and read the Phase-7 material, Order297, D-801 through D-806, both
prior reviews, the compliance/entity/PostgreSQL skills, and the approved
Order287/295/296 builders before executing this review. The authoritative worktree
was clean and exactly at the candidate above before reviewer-only mutations.

Strict ancestry is the six-commit range `a9cb63e..f9f8319`, and D-800 candidate
`58c6b49a20e4e4ba9560118c62cb7517ad95a930` is an ancestor of the approved base.
The candidate changes exactly the 15 admitted source/export, focused-test,
documentation, order, prior-review, decision and ledger paths. The current official
India Code IGST Act sections 7/8 and CBIC Rule 21A material remain consistent with
the narrow composition boundary; the verdict below is an executable predecessor-
replay/proof failure, not a new statutory interpretation.

Official sources checked:

- https://www.indiacode.nic.in/bitstream/123456789/2251/4/a2017-13.pdf
- https://cbic-gst.gov.in/pdf/10112020_CGST-Rules-2017_Part-A_Rules.pdf

## Blocking findings

### 1. The exact approved Order296 recipient-status root is rejected

Order296 constructs its recipient registration-status evidence hash over a nested
`recipient` object containing `partyId`, `registrationId`, and `evidenceHash`
(`india-gst-recipient-registration-at-time-of-supply.ts`, status body). Order297's
`expectedStatusHash` omits `partyId` from that nested object. Its focused fixture
repeats the same non-approved shape, so the ordinary green path does not exercise an
Order296-emittable root.

I changed only the reviewer fixture status hash to the exact approved Order296
algorithm, retaining the approved tenant-bound status and outer hashes and complete
frozen envelope. The focused run became `9 pass / 2 fail / 58 expectations`; both
the positive composition and zero-effect calls failed with
`Order296 recipient timing envelope is inconsistent`. The edit was then removed.

Required repair: include `recipientPartyId` as nested `recipient.partyId` in the exact
Order296 status-hash replay, construct the permanent fixture with that approved
shape, and demonstrate that the complete approved root composes while a separately
rehashable party-id crossing fails closed.

### 2. The committed INR proof is not mutation-sensitive

D-806 says the repaired hostile proof covers the predecessor INR constraint. I
temporarily removed only the two exact-INR comparisons while retaining equality
between the time envelope and reservation-lineage currencies. The complete committed
focused suite remained green at `10 pass / 0 fail / 83 expectations`.

The existing `CAD` case changes only one nested field without recomputing the nested
and outer hashes, so it fails at unrelated hash/envelope checks. It does not prove
that a self-consistent, fully rehashed pair of non-INR Order295/296 timing roots is
rejected by the INR guard. The production guard is present, but D-801/D-806 require
exhaustive hostile proof, and its removal is currently undetected.

Required repair: add a fully self-consistent attack that changes both timing roots'
currencies and both lineage currencies, recomputes the predecessor-specific nested
hashes and tenant-bound outer hashes, recursively freezes the roots, and turns red
when the exact INR guard is removed.

## Reviewer-executed mutation matrix

All mutations below were reviewer-only and restored before retained edits:

| Guard or prior finding | Mutant focused result | Meaning |
|---|---:|---|
| Exact approved Order296 recipient status hash with nested party id | `9/2`, 58 expectations | Candidate rejects a real predecessor root; blocker |
| Accept either predecessor time hash algorithm | `9/1`, 82 expectations | Wrong-algorithm hostile proof kills mutation |
| Remove Order287-to-295/296 status-hash crossing | `9/1`, 82 expectations | Status crossing hostile proof kills mutation |
| Remove timing `segmentId` UUID validation | `9/1`, 83 expectations | Fully rehashed segment hostile proof kills mutation |
| Remove regular-recipient null-approval rule | `9/1`, 83 expectations | Fully rehashed approval hostile proof kills mutation |
| Remove supplier registration-status hash replay | `9/1`, 83 expectations | Stale supplier GST hostile proof kills mutation |
| Remove supplier/recipient taxpayer and SEZ crossings | `9/1`, 82 expectations | Semantic crossing hostile proof kills mutation |
| Remove exact INR comparisons only | `10/0`, 83 expectations | Mutation survives; blocker |

This confirms that the repaired D-803 outer hashes, predecessor-specific time hashes,
status crossings, segment UUID, approval, supplier status replay and taxpayer/SEZ
checks are effective under the committed fixtures. It does not cure the exact
Order296 party-id mismatch or the surviving INR mutation.

## Other reviewer-executed evidence

| Proof | Result |
|---|---:|
| Focused intentional + Order297 suite | `11 pass / 0 fail / 87 expectations` |
| Impacted Order287/295/296/297 suite | `34 pass / 0 fail / 9 expected DB skips / 655 expectations` |
| Full standing suite | `1,047 pass / 0 fail / 880 expected skips / 15,991 expectations`; `1,927 tests / 340 files` |
| TypeScript / import boundaries / licences | green; `120` TypeScript files / `23` packages |
| Container image pins / dependency audit | `4/0/7`; zero vulnerabilities |
| Ancestry / exact candidate scope / static containment / diff | green |

Database, migration, schema, setup, migration-runner and referee artifacts are
byte-identical to independently approved D-800. A reviewer-generated 68-blob Git
manifest has the same SHA-256 at D-800 and the candidate:
`20F5FC06A26DE59F8B62651D3B072E8AE15884649DF8E3D56D4DD6BB7F1B96FD`.
The protected diff is empty, so D-800's exact 58-migration / 110-table / referee
11/11 execution remains applicable and was not needlessly recreated. Static
inspection confirms the composer remains pure and has no database, writer, network,
clock, financial, document or submission authority. Both exact-range and worktree
`git diff --check` are green.

## Verdict

Exact candidate `f9f83191d30a51bf06e5a555ea30fd83ed9dc73c` is **CHANGES
REQUIRED**. It rejects an exact approved Order296 predecessor root and the committed
suite does not detect removal of the promised INR constraint. No approval,
integration, merge, local promotion, deployment, downstream fiscal authority,
Phase-7 completion or application-complete authority is granted. The Order297
Definition of Done remains unchecked and another repaired exact candidate requires a
fresh independent Tier-3 re-review.
