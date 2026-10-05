# Order 297 independent Tier-3 review

**Reviewer:** `order297_fresh_review`, fresh non-implementing OpenAI Codex agent
**Candidate:** `c789eb467a3276a7b0047020eeaa39722ee4b80b`
**Approved base:** `a9cb63e` (Order296 D800 governance descendant)
**Result:** CHANGES-REQUIRED

## Blocking findings

### 1. Real approved Order295 and Order296 roots cannot be composed

Order295 and Order296 each produce their outer result hash as
`sha256({ tenantId, ...evidence })` (`india-gst-registration-at-time-of-supply.ts`
line 175 and `india-gst-recipient-registration-at-time-of-supply.ts` line 99).
Order297 instead validates each outer hash as `sha256(evidence)` without the tenant
(`india-gst-accommodation-supply-nature-at-time-of-supply.ts` lines 332 and 352).

The focused fixtures reproduce the non-tenant hash rather than the approved
predecessor contract, which is why they are green. The reviewer rebuilt both fixture
outer hashes with the exact approved tenant-bound algorithm and passed those complete,
recursively frozen roots to the composer. It rejected them with:

```text
IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError:
Order295 supplier timing envelope is inconsistent
APPROVED_TENANT_HASHED_PREDECESSORS_REJECTED
```

Required repair: replay the exact tenant-bound outer hash for both predecessor roots
and change the focused fixtures to construct the exact approved Order295/296 results.

### 2. Order287 status evidence is not equality-bound to Orders295/296

The final cross-root check binds only the supplier and recipient status IDs (lines
367–368). It never compares Order287's supplier/recipient status evidence hashes with
`supplierRegistrationStatusEvidenceHash` and
`recipientRegistrationStatusEvidenceHash` from Orders295/296. A caller can therefore
provide individually rehashed, frozen roots that name the same status IDs but carry
different status evidence.

The reviewer changed both Order287 nested status hashes, recomputed its canonical JSON
and tenant candidate hash, recursively froze the complete input, and the composer
accepted it:

```text
supply_nature_and_registrations_bound_at_time_of_supply
MISMATCHED_STATUS_EVIDENCE_ACCEPTED=true
```

Required repair: equality-bind both status evidence hashes (and their corresponding
status semantics) across Order287 and Orders295/296, then add self-consistent rehash
attacks proving both crossings fail closed.

### 3. Time-of-supply hash replay is predecessor-ambiguous

Order295's nested time-of-supply hash is the non-tenant body hash (line 171), while
Order296's nested time-of-supply hash is the tenant-bound body hash (line 90).
Order297's shared validator accepts either algorithm for either root (lines 311–314).
The current recipient fixture uses the non-tenant Order295 algorithm and is accepted,
even though Order296 cannot emit that root. Required repair: replay the exact
predecessor-specific hash algorithm for each root, not a union of both algorithms.

### 4. The candidate range fails `git diff --check`

Three lines in the new order header contain trailing whitespace. This is not the
statutory blocker, but the candidate cannot truthfully claim a green diff gate until
the whitespace is removed.

## Independent statutory inspection

The reviewer checked the current official India Code IGST Act sections 7 and 8. They
retain inter-State treatment for services where supplier location and place of supply
are in different States/Union territories, the section 7(5)(b) SEZ override, and
intra-State treatment under section 8(2) only when the locations are the same and the
SEZ exception does not apply. The current official CBIC registration rules also keep
SEZ registrations distinct and Rule 21A suspension separate from active registration.
Order297's intended narrow composition boundary is consistent with those sources;
the rejection is caused by executable lineage/hash defects, not by a new statutory
interpretation.

Sources checked:

- https://www.indiacode.nic.in/bitstream/123456789/2251/4/a2017-13.pdf
- https://cbic-gst.gov.in/gst-registration-rules.html
- https://cbic-gst.gov.in/pdf/10112020_CGST-Rules-2017_Part-A_Rules.pdf

## Reviewer-executed evidence

- Focused Order297 suite: `5 passed, 0 failed`, 75 assertions.
- Impacted Orders287/295/296/297 suite: `28 passed, 0 failed`, 643 assertions.
- Standing suite: `1,041 passed, 880 expected database skips, 0 failed`, 15,979
  assertions across 1,921 tests / 340 files.
- TypeScript, 120 import boundaries, 23-package licence policy, exact container-image
  pins and dependency audit (zero vulnerabilities) passed.
- Strict ancestry from approved base `a9cb63e` to candidate `c789eb4` passed; the
  candidate file set is bounded to the admitted Order297 source/export, two tests,
  six documentation files and governance/order records.
- Database/schema/setup/referee paths are byte-identical to approved D800. Their
  complete Git-tree manifests at base and candidate have the same SHA-256:
  `1EB5AC3F875894CEEC45071119385F5C8D510D60CCF97ED97934539C74FBEEF2`.
  Therefore the approved exact 58-migration / 110-table / referee 11/11 artifacts are
  unchanged; Order297 adds no database execution surface.
- Static containment found no clock, network, SQL, writer, buyer payload or downstream
  fiscal authority in the new composer.
- `git diff --check` is red only for the three documented trailing-space lines.

## Re-review gate

Candidate `c789eb4` is not approved and grants no integration, merge, local promotion,
deployment, phase-complete or application-complete authority. A repaired exact
candidate must correct all three hash/binding defects, replace the synthetic fixtures
with exact approved predecessor shapes, add self-consistent hostile attacks, clear the
diff check, and receive a fresh non-implementing Tier-3 review.
