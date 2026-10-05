# Order 286 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order286_tier3_review`)
**Reviewed commit:** `03d68cc9902f49a81d5a629cc3150d7fb8846c43`
**Reviewed base:** `20ae4e9af02bb8967327b625849642b0e4038bfc` (independently approved Order285 descendant)
**Reviewed range:** `20ae4e9..03d68cc`
**Date:** 2026-08-29

## Independence, required reads and exact scope

I implemented none of Order286. Before inspecting or executing it I read
`PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and completely read the mandatory
`yellow-compliance-rules`, `yellow-entity-patterns` and
`yellow-postgres-patterns` skills, `docs/YELLOW-CONSTITUTION.md`,
`docs/ARCHITECTURE-V1.md`, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, the current
Phase-7 material, Order286, D-752/D-753 and the approved Orders272/284/285
lineage.

The worktree was clean and `HEAD` was exactly
`03d68cc9902f49a81d5a629cc3150d7fb8846c43` before this authorized review
record. `20ae4e9` is a strict ancestor and the merge base is exactly `20ae4e9`.
The linear candidate history is Order286 admission `fd6160e` followed by build
`03d68cc`. The exact nineteen changed paths are the declared migration,
resolver/export, focused and catalogue tests, normalized schema snapshot, three
product documents, setup count and scoped governance records. No immutable
baseline, seed, dependency, credential, application composition, provider,
local-promotion or deployment path changed. Ancestry, name-status, scope,
`git diff --check`, `git show --check` and clean-tree proof passed.

Migration0053 SHA-256 is exactly
`e5208a1698c06db64842946876c90912c03d9aa0481ed0ceced6fa0295020c3d`.

## Reviewer-personal official-source audit

I checked current official primary materials rather than relying on builder notes:

- The official CBIC [Integrated Goods and Services Tax Act, 2017](https://cbic-gst.gov.in/hindi/IGST-bill-e.html)
  states in section 7(5)(b) that supplies to or by an SEZ developer or SEZ unit
  are inter-State supplies. Section 8(2)'s same-State service rule expressly
  excludes supplies to or by an SEZ developer or unit.
- CBIC [Circular 48/22/2018-GST](https://cbic-gst.gov.in/pdf/Circular_48-22-2018-GST.pdf)
  confirms that section 7(5)(b) is the specific rule for short-term
  accommodation, conferencing, banqueting and similar services supplied to an
  SEZ developer or unit. The same circular separately requires specified-officer
  evidence that services were received for authorized operations before the
  zero-rating/refund benefit is available. Registration/SEZ status alone does not
  prove that separate condition.
- CBIC's official [sectoral FAQ](https://cbic-gst.gov.in/hindi/sectoral-faq.html)
  records that an SEZ unit and the same person's place outside the SEZ require
  separate GST registrations. This supports an affirmative registration-bound
  status root rather than inference from GSTIN prefix, address, property name or
  configuration.
- The official consolidated [Special Economic Zones Rules, 2006](https://www.sezindia.gov.in/sites/default/files/sez_rules_amendments/23SEZRulesincorporatingallamendments.pdf)
  identify Form G as the unit Letter of Approval, Form B as the SEZ developer
  Letter of Approval and Form C as approval for infrastructure facilities in an
  SEZ/co-developer lineage. Rule 6 expressly uses Form B for a developer and Form
  C for the infrastructure-facility approval.
- Current official SEZ material separately identifies Form F2 as the renewal of a
  unit Letter of Approval after Form-F1 application/evaluation. The candidate
  intentionally does not model or accept Form F2, so a renewed unit cannot be
  silently treated as current under only the initial Form-G contract. That
  omission is explicit fail-closed scope rather than an incorrect negative
  inference.

These sources support the narrow supplier-registration status boundary. They do
not permit this root to infer bilateral supply nature, authorized operations,
zero-rating/refund/payment mode, place-of-supply applicability at a later supply
date, levy, exemption, rate, value, tax component, invoice treatment or
submission authority.

## Schema, ancestry, no-inference and resolver audit

Migration0053 adds exactly one fifteen-column tenant-leading table. Its composite
primary key and current-evidence unique identity lead with tenant, and its
same-tenant composite foreign key targets the exact Order272
`property_fiscal_registration`. Registration and evidence hashes are canonical
lowercase SHA-256. Registration status is only `active`; taxpayer type is exactly
`regular`, `sez_unit` or `sez_developer`; source is only `gst_common_portal`; and
the legal rule is fixed to
`IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS`.

The approval-shape constraint makes every approval field NULL for regular status.
It requires Form G for an SEZ unit and Form B or C for an SEZ developer, a trimmed
1–128-character control-free reference, finite nonempty canonical `[)` validity
containing `status_as_of`, `in_force` status and lowercase approval evidence hash.
Form F2 is rejected. RLS is enabled and forced with the transaction-local tenant
policy. `yellow_owner` owns the table; PUBLIC and `yellow_runtime` have no
privilege; `app_role` has SELECT only and no insert/update/delete/truncate
authority. There is no writer, security-definer capability, fact, event, seed or
lifecycle command. Both indexes are tenant-leading.

The resolver accepts only the exact accessor/proxy/symbol-free five-canonical-UUID
input. It invokes the approved Order284 resolver for the explicit tenant,
property, reservation and service-location identity, then independently
revalidates the complete recursively frozen service-location shape and hash,
including its Order272 registration id/hash, jurisdiction identity, registered
place, lodging scope and exact `IGST_ACT_2_15_A` basis. It performs one SELECT
equality-bound to transaction tenant, requested status id, exact current supplier
registration id/hash and all fixed statutory literals. There is no latest-row,
server-clock, date inference or ambiguity fallback.

The selected row is independently revalidated as an exact fifteen-field shape.
Date/range parsing is canonical, taxpayer/form pairings are repeated in code, and
positive approval validity contains the stored evidence-as-of date. The exact
fixed-order result is recursively frozen, binds the unexposed tenant in its
recomputed SHA-256 and replays byte-identically. Missing, duplicate, stale,
foreign, malformed, thawed, unsupported or cross-mixed evidence fails closed;
absence never returns non-SEZ.

Manual and executable scans found no Form-F2 acceptance, address/name/GSTIN-prefix
inference, recipient-Order285 substitution, bilateral supply-nature or
place-of-supply decision, authorized-operations or zero-rating claim, levy/rate/
value/tax-component authority, DML, row/advisory lock, fact/outbox,
journal/posting, invoice/document/number/hash-chain, provider/submission, network
or UI path. Happy, replay and hostile executions preserved the Order272/284/285
and shared-effect byte/count oracles.

## Reviewer-personal executable proof

I did not reuse builder output. I created one fresh isolated PostgreSQL 16.15
container, `yellow-order286-tier3-pg`, on verified-unused loopback port `5599`,
with dedicated volume `yellow-order286-tier3-pgdata`. No second app or Valkey was
started. I provisioned distinct disposable deploy/runtime/extension authority,
migrated and seeded canonical `yellow_dev`, independently created `yellow_test`,
applied migrations 1–53 and loaded the protected invariant fixture.

Personally executed results:

- exact Order286 focused hostile proof: **16 passed, 0 failed, 317 expectations**;
- full migration runner against the disposable `/postgres` authority: **39
  passed, 0 failed, 187 expectations**;
- canonical database acceptance: **18 passed, 0 failed, 52 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 112 expectations**;
- direct catalogue: **53 migrations / 105 public tables / 95 RLS-enabled tenant
  tables / 95 tenant-isolation policies / 5 FORCE-RLS tables**; the forced tables
  are exactly `india_gst_item_classification`,
  `india_gst_recipient_sez_status`, `india_gst_supplier_service_location`,
  `india_gst_supplier_sez_status` and `property_fiscal_location`;
- direct live relation proof: exactly fifteen columns, `yellow_owner`, RLS and
  FORCE RLS true, `app_role` SELECT true/mutation false, exact transaction-local
  policy and two tenant-leading indexes;
- live PostgreSQL 16.15 schema, normalized through the repository normalizer,
  matched `tests/schema/expected.sql` exactly;
- canonical setup contract was reproduced against that one PostgreSQL container:
  distinct roles, canonical dev migration/seed, fresh invariant database,
  migrations 1–53, exact 105-table assertion and canonical fixture; `bash -n
  setup.sh` passed and the protected referee reported **11 passed, 0 failed of
  11**, including **95 tenant tables / 95 RLS / 95 policies** and both
  security-invoker views;
- standing `bun test`: **945 passed, 861 database/environment skips, 0 failed,
  14,270 expectations; 1,806 tests across 316 files**;
- `bun run typecheck`: exit 0; import boundaries: **109 TypeScript files**, pass;
  dependency licence policy: **23 packages**, pass; `bun audit`: no
  vulnerabilities; forbidden-authority/source/scope/diff gates: pass.

Two initial reviewer-harness invocations failed before valid proof: acceptance was
first pointed at the invariant-fixture database rather than canonical `yellow_dev`
(17/18, only the expected demo-seed identity differed), and the first referee run
used Windows CP1252 output then left its one-use race fixture dirty. With UTF-8 set
before a single run against a newly recreated invariant database, the unchanged
candidate passed 11/11. These were disposable harness errors, not candidate
findings; the candidate bytes remained unchanged throughout.

## Cleanup, stable-runtime preservation and bounded approval

Before removal, the disposable container was healthy at restart count zero and no
`yellow_migrate_%` child database remained. I removed the exact review container
and volume; post-cleanup counts are **0 containers / 0 volumes** for their names.

The sole stable runtime retained the same full container identities, start
timestamps, restart counts and health before and after review:

| Stable service | Exact container id | Start timestamp | Restarts | Health |
| --- | --- | --- | ---: | --- |
| app | `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf` | `2026-08-29T06:37:36.392830169Z` | 0 | healthy |
| PostgreSQL | `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` | `2026-08-29T02:59:30.103272572Z` | 0 | healthy |
| Valkey | `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` | `2026-08-29T02:59:30.442755852Z` | 0 | healthy |

Stable port `3000` remained bound only to the exact app container, and
`http://127.0.0.1:3000/health` remained exact HTTP **200** with body
`{"status":"ok"}`. I did not query or mutate the stable database and did not
restart, promote or replace any stable service.

No product, legal-containment, tenant/RLS, executable-proof, governance or cleanup
finding remains. Approval is limited to the exact affirmative supplier
registration/SEZ-status evidence at candidate `03d68cc`. It grants no Form-F2
renewal evidence, bilateral supply nature, authorized operations, zero-rating,
refund/payment mode, place-of-supply application, levy/exemption/rate/value/tax
component, item, posting/correction, invoice/document/number/hash-chain,
provider/submission, API/HTTP/UI, local promotion, merge, deployment, Phase-7
completion or application-complete authority. Apart from this review record, I
changed no repository file.
