# Order 284 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**  
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order284_tier3_review`)  
**Reviewed commit:** `9c222c41a93f66ab4f02a8eddf540fdb4e591780`  
**Reviewed base:** `2a9527aaaadd2ceb485867d93e91f7e2cb08669e` (independently approved Order283 descendant)  
**Reviewed range:** `2a9527a..9c222c4`  
**Date:** 2026-08-29

## Independence, required reads and exact scope

I implemented none of Order284. Before inspecting or executing it I read
`PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and completely read the mandatory
`yellow-compliance-rules`, `yellow-entity-patterns` and
`yellow-postgres-patterns` skills, `docs/YELLOW-CONSTITUTION.md`,
`docs/ARCHITECTURE-V1.md`, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, the current
Phase-7 material, Order284, D-746/D-747, and the relevant approved Orders272 and
280–283 orders/reviews.

The worktree was clean and `HEAD` was exactly
`9c222c41a93f66ab4f02a8eddf540fdb4e591780` before this authorized review record.
`2a9527a` is a strict ancestor and the merge base is exactly `2a9527a`. The linear
candidate history is the Order284 admission `4e89a39` followed by build `9c222c4`.
The exact nineteen changed paths are the declared migration, resolver/export,
focused and catalogue tests, schema snapshot, three product documents, setup
catalogue count and scoped governance records. There is no immutable-baseline,
seed, dependency, credential, app-composition, provider, local-promotion or
deployment path. Ancestry, name-status, scope, `git diff --check`, `git show
--check` and clean-tree proof passed.

Migration0051 SHA-256 is exactly
`af457264bb976d64930022eb4686a55096248bf0b9e1f13151454b47d47b2496`.

## Reviewer-personal official-source audit

I checked current official primary materials rather than relying on builder notes:

- CBIC's official [Integrated Goods and Services Tax Act](https://cbic-gst.gov.in/hindi/IGST-bill-e.html)
  states the sequential section 2(15) tests: a supply made from a registered place
  uses that place under clause (a); an unregistered fixed establishment is clause
  (b); more than one establishment requires the most-directly-concerned test under
  clause (c); usual residence applies only in the absence of those places under
  clause (d).
- The official CBIC [registration rules](https://cbic-gst.gov.in/gst-registration-rules.html)
  and consolidated [CGST Rules](https://cbic-gst.gov.in/pdf/24092021-CGST-Rules-2017-Part-A-Rules.pdf)
  make FORM GST REG-06 identify the principal place and additional registered
  place(s), require the certificate/GSTIN at both kinds of place, and treat their
  address changes as registration amendments. Principal and additional registered
  places are therefore explicit registration facts, not deductions from a GSTIN
  prefix or physical co-location.
- The GSTN-authorized IRIS IRP [notified e-invoice schema](https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/)
  lists seller GSTIN/address/location/PIN/state separately from buyer `Pos`, supply
  type `SupTyp`, same-State IGST exception `IgstOnIntra`, and tax components.

These sources support the candidate's narrow evidence boundary. They do not permit
the assignment to decide section2(15)(b–d), SEZ treatment, supply nature, levy,
`SupTyp`, `IgstOnIntra`, item values, document issue or submission.

## Schema, no-inference and resolver audit

Migration0051 adds exactly one eight-column tenant-leading table. Its primary key
and unique identity lead with tenant, and its same-tenant composite foreign key
targets the exact Order272 registration id. The evidence hash is canonical
lowercase SHA-256; scope, place kind, location basis and legal rule are exact CHECK
literals. RLS is enabled and forced with the transaction-local tenant policy.
`yellow_owner` owns the table; PUBLIC and `yellow_runtime` have no table privilege;
`app_role` has SELECT only and no insert/update/delete/truncate authority. There is
no writer, security-definer capability, fact, event, seed or lifecycle command.

The resolver accepts only the exact accessor/proxy/symbol-free four-canonical-UUID
input. It first invokes approved Order272 for the explicit tenant/property/
reservation, independently revalidates the complete recursively frozen supplier
shape, GSTIN checksum/state and fixed-order tenant-bound evidence hash, then performs
one SELECT for the explicitly requested assignment. That SELECT equality-binds
transaction tenant, assignment id, current registration id, current evidence hash
and every fixed statutory literal. Missing, duplicate, stale, foreign, malformed,
thawed or cross-mixed evidence fails closed.

The returned state/address/locality/PIN bytes come only from the independently
revalidated Order272 evidence, but they are returned as supplier-location evidence
only after the explicit supply-from assignment matches. Neither their content nor
GSTIN state, property fiscal location, physical co-location, SellerDtls,
org/profile/config, recipient/folio truth or Order283 equality can create or replace
that assignment. The unique current registration/hash/scope assignment also avoids
silently selecting among multiple establishments; clause (c) remains unsupported.

The result has the exact fixed order specified by the order, is recursively frozen,
binds the unexposed tenant into its independently recomputed SHA-256, and replays
byte-identically. Manual and executable scans found no clause (b–d) labels or
fallback, SEZ/supply-nature/levy/IRP-item/document authority, DML, row/advisory lock,
fact/outbox, journal/posting, fiscal submission or network path. Happy, replay and
hostile reviewer executions preserved all source and effect byte/count oracles.

## Reviewer-personal executable proof

I did not reuse builder output. I created only one fresh isolated PostgreSQL
16.15 container, `yellow-order284-review-pg`, on verified-unused loopback port
`5597`, with dedicated volume `yellow-order284-review-pgdata`. No second app or
Valkey was started. I provisioned distinct disposable deploy/runtime/extension
authority, migrated and seeded a canonical `yellow_dev`, and independently created
`yellow_test`, applied migrations 1–51 and loaded `tests/seed_fixture.sql`.

Personally executed results:

- exact Order284 intentional/current hostile proof: **18 passed, 0 failed, 238
  expectations**;
- full migration runner against the disposable `/postgres` authority: **39 passed,
  0 failed, 187 expectations**;
- canonical database acceptance: **16 passed, 0 failed, 46 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 110 expectations**;
- direct catalogue: **51 migrations / 103 public tables / 93 RLS-enabled tenant
  tables / 93 tenant-isolation policies / 3 FORCE-RLS tables**; the forced tables
  are exactly `india_gst_item_classification`,
  `india_gst_supplier_service_location` and `property_fiscal_location`;
- reviewer-captured schema normalized through the repository normalizer matched
  `tests/schema/expected.sql` exactly;
- the PostgreSQL-only setup contract was reproduced explicitly: fresh migration,
  canonical seed, fresh invariant database, exact 103-table assertion and fixture;
  `bash -n setup.sh` passed, and the protected referee reported **11 passed, 0
  failed of 11**, including **93 tenant tables / 93 RLS / 93 policies** and both
  security-invoker views;
- standing `bun test`: **927 passed, 841 database/environment skips, 0 failed,
  13,842 expectations; 1,768 tests across 312 files**;
- `bun run typecheck`: exit 0; import boundaries: **107 TypeScript files**, pass;
  dependency licence policy: **23 packages**, pass; `bun audit`: no
  vulnerabilities; forbidden-authority/static/source/docs/scope/diff gates: pass.

The first migration-suite invocation completed after its command-output capture
detached, so I reran the identical suite unchanged through a retained session and
captured the exact final 39/0/187 result above. This was a reviewer harness/output
capture issue, not a product assertion failure or stable-runtime interaction.

## Cleanup, stable-runtime preservation and bounded approval

Before removal, the disposable container was healthy at restart count zero and no
`yellow_migrate_%` child database remained. I removed the exact review container and
volume; post-cleanup counts are **0 containers / 0 volumes** for their names.

The actual sole stable runtime, distinguished from this candidate worktree's Compose
status, retained its exact full container identities, health and restart counts
before and after review. Its post-review start timestamps were:

| Stable service | Exact container id | Start timestamp | Restarts | Health |
| --- | --- | --- | ---: | --- |
| app | `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf` | `2026-08-29T06:37:36.392830169Z` | 0 | healthy |
| PostgreSQL | `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` | `2026-08-29T02:59:30.103272572Z` | 0 | healthy |
| Valkey | `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` | `2026-08-29T02:59:30.442755852Z` | 0 | healthy |

Stable port `3000` remained bound only to the exact app container, and
`http://127.0.0.1:3000/health` remained exact HTTP **200** with body
`{"status":"ok"}`. I did not query or mutate the stable database, and did not
restart, promote or replace any stable service.

No product, legal-containment, tenant/RLS, executable-proof, governance or cleanup
finding remains. Approval is limited to the exact section2(15)(a) registered-place
supply-from evidence at candidate `9c222c4`. It grants no section2(15)(b–d), SEZ,
authorized-operations, intra/inter-State, levy/rate/amount, `SupTyp`,
`IgstOnIntra`, item, posting/correction, document/number/hash-chain,
provider/submission, API/HTTP/UI, local promotion, merge, deployment, Phase-7
completion or application-complete authority. Apart from this review record, I
changed no repository file.
