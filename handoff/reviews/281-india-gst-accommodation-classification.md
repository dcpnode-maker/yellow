# Order 281 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order281_tier3_review`)
**Reviewed commit:** `d65ab22ceec415b0be858f06d7a82c85b9fb29ad`
**Reviewed base:** `1e01fe2` (independently approved Order280 descendant)
**Reviewed range:** `1e01fe2..d65ab22`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order281. I read `PROJECT.md`, `AGENTS.md`, ran
`./state.sh`, and read the compliance, entity and PostgreSQL skills, the roster and
workflow, Order281, D-735/D-736, the Phase-7 boundary, and the relevant architecture
and contract records before evaluating the exact candidate.

The reviewed head was the exact clean commit
`d65ab22ceec415b0be858f06d7a82c85b9fb29ad`; approved Order280 base
`1e01fe2` is its ancestor. The nineteen changed paths are exactly the declared
migration, resolver/export, focused tests, catalogue/schema proof, documentation and
governance records. There is no seed, dependency, credential, application route,
provider, local-runtime or deployment path in the range. `git diff --check`,
`git show --check`, ancestry, name-status, scope and clean-worktree proofs passed.

## Official statutory-source and separation audit

I personally checked all three named primary sources:

- The GSTN-authorized IRIS IRP **Notified E-invoice Schema** at
  `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/` separately lists
  mandatory item attributes `IsServc` and `HsnCd`; it separately lists top-level
  `SupTyp` and buyer `Pos`. Classification evidence is therefore a distinct input,
  not authority to decide item composition, supply type or place of supply.
- CBIC Notification No. 60/2020 — Central Tax / substituted **FORM GST INV-01** at
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf`
  establishes the notified e-invoice format/schema (version 1.1) under Rule 48. The
  Order281 boundary correctly stops before constructing or submitting that format.
- CBIC Notification 11 Annexure at
  `https://cbic-gst.gov.in/hindi/pdf/central-tax-rate/Notification11-CGST-Annexure.pdf`
  places exactly `996311`, `996312`, `996313` under accommodation services and
  `996321`, `996322`, `996329` under other accommodation services. Those are exactly
  the six launch codes accepted by migration0050 and the resolver.

The sources support `SAC` plus service indicator `Y` as classification evidence while
leaving `ItemList`, `Pos`, `SupTyp`, tax decomposition/rates, seller/buyer/folio
composition, document issue and IRP submission outside this order.

## Schema, tenant and resolver audit

Migration0050 creates exactly fourteen columns beginning with `tenant_id`. The primary
key and frozen-jurisdiction identity indexes both lead with tenant; the latter is
`UNIQUE NULLS NOT DISTINCT`. The property foreign key is the same-tenant composite
`(tenant_id,property_node)` relationship. The extension reference, owner coherence,
jurisdiction key/version/hash, fixed `IN`, `room`, `room_revenue`, `SAC`, exact
six-code set and `Y` constraints are present and exact.

RLS is enabled and forced with one transaction-local `app.tenant_id` policy.
`yellow_owner` owns the relation; `PUBLIC` and `yellow_runtime` have no table
authority; `app_role` has SELECT only and no insert, update, delete, truncate,
reference or trigger authority. Reviewer-personal catalogue queries confirmed two
tenant-leading indexes, fourteen named constraints, one policy and the exact ACL.

The service accepts only the exact accessor/proxy/symbol-free plain four-UUID object
`{tenantId,propertyNode,reservationId,classificationId}`. It projects only the exact
three-key eligibility input into the already governed positive-tax folio resolver,
then equality-binds the explicit classification id and property to the current tenant
and the complete frozen jurisdiction identity. Its single classification SELECT also
requires a real same-tenant `org_node.kind='property'` row and every fixed statutory
constant. Missing, foreign, stale, duplicate, malformed and incoherent truth fails
closed.

The fixed-order result contains only classification id, property, complete nested
jurisdiction, line/group, `SAC`, one allowed six-digit code, `Y` and evidence hash.
It and its nested jurisdiction are frozen. The deterministic SHA-256 includes the
unexposed tenant id plus property, jurisdiction and classification evidence; exact
replay is byte-identical. Commercial or mutable truth (`GST_ROOM`, transaction code,
USALI, posting route, rate plan, profile, space, unit type and property name/config)
cannot select or alter the evidence.

## Zero-write and authority audit

Source and range scans found no classification writer, API, HTTP, UI, seed, provider,
network, fiscal-document, submission, posting, correction or tax-composition path.
The classification query has no DML, advisory lock or row lock. The inherited
positive-tax eligibility resolver acquires its existing governed financial-row lock
and re-reads eligibility; it creates no mutation. Successful, replayed and failed
reviewer executions left classification, fiscal registrations, tax lineage, facts,
outbox, journals, postings, documents and fiscal submissions byte/count unchanged.
The source token `.update(...)` is only `Bun.CryptoHasher` input, not SQL or state
mutation.

## Reviewer-personal executable proof

I did not reuse builder evidence. I created a fresh isolated Windows Docker Compose
project `yellow-review281-tier3-win` with PostgreSQL 16.15 on unused port 5574 and no
application container, then personally executed:

- exact Order281 focused proof: **12 passed, 0 failed** (intentional/current);
- classification plus location, supplier and folio-eligibility integration:
  **39 passed, 0 failed, 406 expectations**, comprising **28 adjacent** tests;
  including the intentional-red/current assertion made the invocation **40/0 with
  416 expectations**;
- database acceptance on the canonical seeded database: **15 passed, 0 failed,
  42 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 109 expectations**;
- full migration replay from the exact deployment `/postgres` authority:
  **39 passed, 0 failed, 186 expectations**;
- direct fresh catalogue: **50 migrations / 102 public tables / 92 RLS tables /
  92 policies**; migration0050 SHA-256 is exactly
  `a3eeba9a7a4b00c580c822126b8c48d17053c9acaccbf15538cadfddb47d9433`;
- schema drift: exact match; fresh referee: **11 passed, 0 failed of 11**;
- `bun test`: **894 passed, 825 environment/database-only skips, 0 failed,
  9,148 expectations; 1,719 tests across 306 files**;
- `bun run typecheck`: exit0; boundaries: **104 TypeScript files**, pass;
  licence policy: **23 packages**, pass; `bun audit` and high-level audit: no
  vulnerabilities; exact diff/scope/checksum/ancestry/clean-tree scans: pass.

One first reviewer-owned WSL proof completed fresh migration, exact catalogue and
11/11 referee, but that separate WSL Docker daemon was host-stopped after the wrapper
returned; a subsequent Windows-to-WSL focused invocation was discarded when the
database disappeared. The proof was rebuilt from zero on the Windows Docker daemon
and every required gate above then completed green. A direct Windows wrapper attempt
was also discarded before creating resources because the shared protected authority
file correctly rejected ACL rewriting without `SeSecurityPrivilege`; explicit
least-authority provisioning replaced it. No product assertion failed and no
credential was printed.

Both exact disposable projects, their containers, networks and volumes are now
absent. The stable app, PostgreSQL and Valkey retained the same container identities,
remained healthy with restart count zero, and stable `/health` remained HTTP 200. The
stable runtime was not mutated.

## Findings and bounded approval

No finding remains. I approve only the exact tenant-isolated, SELECT-only India GST
accommodation-classification assignment and resolver at commit
`d65ab22ceec415b0be858f06d7a82c85b9fb29ad`.

This approval grants no `ItemList`, `Pos`, `SupTyp`, B2C/URP, export, SEZ or
deemed-export treatment; no tax rate or CGST/SGST/IGST decomposition; no seller,
buyer or folio composition; no posting/correction, document allocation/issue/number/
hash chain, provider, submission, API, HTTP, UI, local promotion, merge, public
deployment, Phase-7-complete or application-complete authority. Apart from this
review record, I changed no repository file.
