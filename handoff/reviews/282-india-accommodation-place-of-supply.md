# Order 282 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order282_tier3_review`)
**Reviewed commit:** `4047684a8c7b8300d8631ff99fc668104bd7d337`
**Reviewed base:** `2c45c6d` (independently approved Order281 descendant)
**Reviewed range:** `2c45c6d..4047684`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order282. I read `PROJECT.md`, `AGENTS.md`, ran
`./state.sh`, and read Order282, the compliance/entity/PostgreSQL skills, roster,
workflow, current Phase-7 plan, relevant architecture/contracts/security records and
D-738/D-739 before inspecting or executing the exact candidate.

The reviewed head was the exact clean commit
`4047684a8c7b8300d8631ff99fc668104bd7d337`; independently approved Order281 base
`2c45c6d` is its ancestor. The thirteen changed paths are exactly the declared
read-only compositor/export, focused tests, documentation and governance records.
There is no migration, table, grant, seed, dependency, credential, application route,
provider, runtime-promotion or deployment path in the range. Ancestry, name-status,
`git diff --check`, `git show --check`, scope and clean-tree checks passed.

## Reviewer-personal statutory-source audit

I personally checked the named primary official sources:

- CBIC's published IGST Act text for section 12(3)(b) says lodging accommodation by
  a hotel, inn, guest house, home stay, club or campsite is supplied where the
  immovable property is located. Its outside-India and multi-State provisos remain
  outside this exact domestic single-property boundary.
- The GSTN-authorized IRIS IRP **Notified E-invoice Schema** separately lists
  mandatory buyer `Pos`, top-level `SupTyp`, and item `IsServc`/`HsnCd`, while item
  `Qty` and `Unit` are separate non-starred fields. That supports a property-derived
  `Pos` evidence candidate while forbidding this order from inventing quantity/unit,
  item values, supply type or tax decomposition.
- The official CBIC Notification 60/2020 / substituted **FORM GST INV-01** resource
  resolved as the published PDF e-invoice format under Rule 48. Order282 correctly
  stops before document construction, issue, numbering, provider or submission.

The legal label `IGST_ACT_12_3_B` and sole `pos` source therefore match the admitted
law and notified-schema separation.

## Contract, lineage and containment audit

The service accepts only the exact proxy/symbol/accessor-free plain seven-UUID input
`{tenantId,propertyNode,reservationId,folioId,recipientPartyId,
recipientRegistrationId,classificationId}`. It delegates only to the approved
Order272 supplier, Order279 explicit folio/buyer, Order280 physical-property location
and Order281 accommodation-classification resolvers. It then independently revalidates
the complete frozen shapes and recomputes supplier, recipient, buyer payload and
association, property-location and classification hashes.

Tenant/property/reservation/folio/Party/registration/classification identity, INR/IN
truth, exact accommodation SAC/Y truth and the full supplier/classification frozen
jurisdiction identity must agree. Closed folio/account/reservation lineage, foreign,
missing, duplicate, stale, malformed or cross-mixed evidence fails closed. The source
contains no org/profile/guest/account-address/rate/tax-code/display fallback.

The candidate body has exactly the fixed-order keys
`propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,
buyerAssociation,classification,propertyLocation,legalRule,pos`. The only `pos` is
the validated Order280 property state; supplier and recipient states are neither
compared nor substituted. `candidateJson` is the exact fixed-order body JSON and
`candidateHash` is SHA-256 over `{tenantId,candidate}`, binding but not exposing the
tenant. Result and every nested object are frozen, replay is byte-identical, and
caller/source bytes remain unchanged.

Static and executable scans confirm no direct SQL, DML, advisory/row lock, event,
journal, posting, document, submission or network authority. The compositor adds no
lock beyond the already governed source resolvers. It returns no intra/inter-state
decision, CGST/SGST/IGST decomposition/rate/allocation, `SupTyp`, `ItemList`, ordinal,
description, quantity, UQC, unit/gross/assessable/tax/value, document or submission
field.

## Reviewer-personal executable proof

I did not reuse builder evidence. I created a fresh isolated Windows Docker Compose
project `yellow-review282-tier3` with only PostgreSQL 16.15 on unused port 5585; no
application or Valkey container was created. I personally executed:

- exact Order282 focused proof: **12 passed, 0 failed, 353 expectations**;
- the four adjacent supplier/folio-buyer/property-location/classification integration
  files: **42 passed, 0 failed** (the same reviewer invocation also executed their
  eight intentional-current checks, for **50/0 and 551 expectations** total);
- positive-tax folio eligibility integration: **6 passed, 0 failed** (plus its
  intentional-current check, for **7/0 and 48 expectations** total);
- database acceptance: **15 passed, 0 failed, 42 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 109 expectations**;
- full migration replay: **39 passed, 0 failed, 186 expectations**;
- fresh catalogue/schema: **50 migrations / 102 public tables / 92 RLS-enabled
  tenant tables / 92 policies**, with both new India assignment roots forced-RLS;
  normalized schema exact and fresh referee **11 passed, 0 failed of 11**;
- standing `bun test`: **905 passed, 828 database/environment-only skips, 0 failed,
  9,484 expectations; 1,733 tests across 308 files**;
- `bun run typecheck`: exit 0; boundaries: **105 TypeScript files**, pass; licence
  policy: **23 packages**, pass; `bun audit`: no vulnerabilities; diff/scope/ancestry
  and clean-tree gates: pass.

The first disposable start reached `pg_isready` before the Windows host listener was
settled and the provisioning client closed; it was removed without migration or
product assertion. I rebuilt from zero, required the container health state plus a
host settle interval, and all proofs above passed. This was a reviewer-harness race,
not a product failure.

Both exact disposable attempts, their containers, networks and volumes are absent.
The sole stable app, PostgreSQL and Valkey retained their exact container identities,
are healthy with restart count zero, and stable `/health` is HTTP 200. I did not
mutate the stable runtime.

## Findings and bounded approval

No finding remains. I approve only the exact read-only domestic India accommodation
place-of-supply evidence candidate at commit
`4047684a8c7b8300d8631ff99fc668104bd7d337`.

This approval grants no intra/inter-state tax decision, CGST/SGST/IGST rate or
decomposition, `SupTyp`, `ItemList` or item values; no posting/correction, document
allocation/series/issue/number/hash chain, provider/submission, API, HTTP, UI, local
promotion, merge, public deployment, Phase-7-complete or application-complete
authority. Apart from this review record, I changed no repository file.
