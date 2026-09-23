# Order 297 fresh independent Tier-3 approval review

**Reviewer:** `/root/order297_approval_review`, fresh non-implementing OpenAI Codex agent
**Candidate:** `17e08db662f790780271d27d4d716860712bdb1b`
**Approved base:** `a9cb63e35028823fb09474f5deef8d9f948f58d2` (Order296 D-800 governance descendant)
**Prior rejected candidates:** `c789eb467a3276a7b0047020eeaa39722ee4b80b`, `eeaf8709953d6f0e38b7633dece7eb217f9c2881`, `f9f83191d30a51bf06e5a555ea30fd83ed9dc73c`
**Result:** **APPROVED**

## Independence and exact approved roots

I did not implement Order297 and did not perform any prior Order297 review. I read
`PROJECT.md`, `AGENTS.md`, ran `state.sh`, and inspected Order297, D-801 through
D-808, all three prior reviews, the compliance/entity/PostgreSQL skills, and the
approved Order287/295/296 source contracts before personally executing this review.

The exact approved predecessors are ancestors of the candidate and their current
source blobs are byte-identical to the approved commits:

| Predecessor | Approved commit | Approved/current source blob |
|---|---|---|
| Order287 | `4f25f8e39b8a9f0e327b954b7f0496caa5a38184` | `0e262fe100a8bd6d6912e3219f083e4f5ad44383` |
| Order295 | `45b5ceba5d231f64eeabc0e1a5edc8932fb59ef0` | `44d005383125ef34a1c519fed2651a95c75b1af2` |
| Order296 | `58c6b49a20e4e4ba9560118c62cb7517ad95a930` | `ffe43b70476b385106a0e92cb26b25de145d4e47` |

The positive fixture now carries those exact emittable shapes: tenant-bound
Order295/296 outer hashes, distinct non-tenant Order295 and tenant-bound Order296
nested time hashes, and Order296's recipient status hash including nested `partyId`.
The composer independently replays all three complete roots, their statutory/date
semantics and hashes, then equality-binds the duplicated transaction, identity,
status, service-location, date and timing lineage fields.

## Reviewer-executed mutation proof

The unmodified focused suite passed `12/0` with `88` expectations. I then applied
each source mutation below separately, ran the committed focused suite, and restored
the exact candidate bytes after every run. Every historical blocker made the suite
red:

| Reviewer-only mutation | Mutant result |
|---|---:|
| Validate Order295/296 outer roots without tenant | `9 pass / 2 fail / 55 expectations` |
| Accept either predecessor nested time-hash algorithm | `10 / 1 / 83` |
| Remove Order287-to-295/296 status-evidence crossings | `10 / 1 / 83` |
| Omit timing `segmentId` UUID validation | `10 / 1 / 84` |
| Permit non-null approval on a regular recipient | `10 / 1 / 84` |
| Remove supplier registration-status hash replay | `10 / 1 / 84` |
| Remove supplier/recipient taxpayer-type and SEZ crossings | `10 / 1 / 83` |
| Omit recipient `partyId` from exact Order296 status replay | `9 / 2 / 55` |
| Remove exact INR guards while retaining cross-root currency equality | `10 / 1 / 84` |

The INR mutant accepted the fully self-consistent CAD pair and therefore failed the
new permanent hostile test exactly as required. The party-id mutant rejected the
exact positive Order296-emittable root. This closes both D-807 blockers and confirms
the earlier D-803/D-805 repairs remain mutation-sensitive. After restoration, the
source and focused-test worktree hashes exactly matched their candidate Git blobs.

## Other reviewer-executed evidence

| Proof | Result |
|---|---:|
| Focused Order297 intentional + hostile suite | `12 pass / 0 fail / 88 expectations` |
| Orders287/295/296/297 impacted superset | `36 pass / 0 fail / 9 expected DB skips / 659 expectations` |
| Full standing suite | `1,048 pass / 0 fail / 880 expected skips / 15,992 expectations`; `1,928 tests / 340 files` |
| TypeScript / import boundaries / licences | green; `120` TypeScript files / `23` packages |
| Container image pins / dependency audit | `4/0/7`; zero vulnerabilities |
| Exact-range and worktree diff checks | green |

Strict ancestry is the eight-commit range `a9cb63e..17e08db`; the D-800 candidate is
an ancestor of the approved base. The range changes exactly 16 admitted Order297
source/export, focused-test, documentation, order/governance and prior-review paths.
Static inspection confirms no database, writer, network, clock, document, posting,
submission or downstream tax-calculation authority.

The 68 protected database/migration/schema/setup/referee blobs are byte-identical at
D-800 candidate `58c6b49` and Order297 candidate `17e08db`: both fresh Git-tree
manifests contain 68 entries, have no differing entry, and hash to
`e00c3c2c0de2a6fdcff332cf33496409c2ab0681f754339796bead8addd8d833` under the
reviewer's canonical LF-separated `git ls-tree` representation. The protected diff
is empty. D-800's reviewer-executed exact PostgreSQL16.15 setup result of 58
migrations, 110 public tables and referee `11/11` is therefore preserved unchanged.

## Verdict

Exact Order297 candidate `17e08db662f790780271d27d4d716860712bdb1b` is
**APPROVED** with no finding. Approval is limited to the pure, migration-free,
tenant-hidden `supply_nature_and_registrations_bound_at_time_of_supply` evidence.
It grants no integration, merge, local promotion, deployment, legal-buyer/B2B,
`Pos`, `SupTyp`, `IgstOnIntra`, rate, levy, tax calculation, document, journal,
posting, IRP/submission, Phase-7-complete or application-complete authority.
