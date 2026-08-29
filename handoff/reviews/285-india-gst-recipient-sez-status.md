# Order 285 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**  
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order285_tier3_review`)  
**Reviewed commit:** `86306397796a4ce0838f8fdb63a0c6d50e2cd945`  
**Reviewed base:** `ab32439af60fb5a28c7786d7b9267f8443721860` (independently approved Order284 descendant)  
**Reviewed range:** `ab32439..8630639`  
**Date:** 2026-08-29

## Independence, required reads and exact scope

I implemented none of Order285. Before inspecting or executing it I read
`PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and completely read the mandatory
`yellow-compliance-rules`, `yellow-entity-patterns` and
`yellow-postgres-patterns` skills, `docs/YELLOW-CONSTITUTION.md`,
`docs/ARCHITECTURE-V1.md`, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, the current
Phase-7 material, Order285, D-749/D-750, and the relevant approved lineage through
Orders276 and 284.

The worktree was clean and `HEAD` was exactly
`86306397796a4ce0838f8fdb63a0c6d50e2cd945` before this authorized review record.
`ab32439` is a strict ancestor and the merge base is exactly `ab32439`. The linear
candidate history is the Order285 admission `ec2eca0` followed by build `8630639`.
The exact nineteen changed paths are the declared migration, resolver/export,
focused and catalogue tests, schema snapshot, three product documents, setup
catalogue count and scoped governance records. There is no immutable-baseline,
seed, dependency, credential, app-composition, provider, local-promotion or
deployment path. Ancestry, name-status, scope, `git diff --check`, `git show
--check` and clean-tree proof passed.

Migration0052 SHA-256 is exactly
`7a318a99c4e3e40722fc97c0445b3475e7cedc10feb651b4c5049f4e3afd65da`.

## Reviewer-personal official-source audit

I checked current official primary materials rather than relying on builder notes:

- The current India Code [Integrated Goods and Services Tax Act, 2017](https://www.indiacode.nic.in/bitstream/123456789/2251/4/a2017-13.pdf)
  states in section 7(5)(b) that supplies of goods or services or both to or by an
  SEZ developer or SEZ unit are inter-State supplies. Section 8(2)'s same-State
  service rule expressly excludes supplies to or by an SEZ developer or unit.
- CBIC [Circular 48/22/2018-GST](https://cbic-gst.gov.in/pdf/Circular_48-22-2018-GST.pdf)
  applies section 7(5)(b) specifically to short-term accommodation, conferencing,
  banqueting and similar services supplied to an SEZ developer or unit. It also
  keeps a distinct authorized-operations endorsement requirement for zero-rating;
  SEZ recipient status alone does not prove that separate condition.
- CBIC's official [GST registration rules](https://cbic-gst.gov.in/gst-registration-rules.html)
  require an SEZ unit or SEZ developer to apply separately from its places of
  business outside the SEZ. CBIC's [sectoral FAQ](https://cbic-gst.gov.in/hindi/sectoral-faq.html)
  likewise records separate SEZ registration, supporting an affirmative official
  registration-status root rather than address, GSTIN-prefix or name inference.
- The official consolidated [Special Economic Zones Rules, 2006](https://www.sezindia.gov.in/sites/default/files/sez_rules_amendments/23SEZRulesincorporatingallamendments.pdf)
  supplies the bounded approval evidence: Form G is the unit Letter of Approval,
  Form B is the developer Letter of Approval and Form C is the co-developer Letter
  of Approval. Section 2(g) of the official
  [Special Economic Zones Act, 2005](https://www.indiacode.nic.in/bitstream/123456789/2041/1/a2005-28.pdf)
  includes a co-developer within “Developer”, so the candidate's Form C mapping to
  `sez_developer` remains within the Act's defined category.

These sources support the candidate's narrow affirmative status boundary. They do
not permit this root to infer authorized operations, zero-rating, section 16
conditions, place of supply, supply nature, levy, exemption, rate, value, tax
component, invoice treatment or submission authority.

## Schema, no-inference and resolver audit

Migration0052 adds exactly one fifteen-column tenant-leading table. Its composite
primary key and current-evidence unique identity lead with tenant, and its
same-tenant composite foreign key targets the exact Order276 recipient fiscal
registration. Registration and evidence hashes are canonical lowercase SHA-256.
Registration status is only `active`; taxpayer type is exactly `regular`,
`sez_unit` or `sez_developer`; source is only `gst_common_portal`; and the legal
rule is fixed to `IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS`.

The approval-shape constraint makes every approval field NULL for regular status.
It requires Form G for an SEZ unit and Form B or C for an SEZ developer, a trimmed
1–128-character control-free reference, a finite nonempty canonical `[)` validity
range containing `status_as_of`, `in_force` status and a lowercase evidence hash.
RLS is enabled and forced with the transaction-local tenant policy. `yellow_owner`
owns the table; PUBLIC and `yellow_runtime` have no privilege; `app_role` has SELECT
only and no insert/update/delete/truncate authority. There is no writer,
security-definer capability, fact, event, seed or lifecycle command. The primary
and unique indexes are both tenant-leading.

The resolver accepts only the exact accessor/proxy/symbol-free four-canonical-UUID
input. It invokes the approved Order276 resolver for the explicit tenant, party and
registration, then independently revalidates the complete recursively frozen
registration shape, GSTIN checksum/state, canonical text/PIN and fixed-order
tenant-bound evidence hash. It performs one SELECT equality-bound to transaction
tenant, exact requested status id, exact current registration id/hash and every
fixed statutory literal. There is no latest-row, date-clock or ambiguity fallback.

The selected row is independently revalidated as an exact fifteen-field shape.
Date/range parsing is canonical, taxpayer/form pairings are repeated in code, and
the in-force validity must contain the stored explicit evidence date. The returned
result has the exact fixed order, is recursively frozen, binds the unexposed tenant
in its recomputed SHA-256 and replays byte-identically. Missing, duplicate, stale,
foreign, malformed, thawed or cross-mixed evidence fails closed.

Manual and executable scans found no address/name/GSTIN-prefix inference,
authorized-operations or zero-rating claim, section 16/supply-nature/place-of-supply
decision, levy/rate/value/tax-component authority, DML, row/advisory lock,
fact/outbox, journal/posting, invoice/document/number/hash-chain,
provider/submission, network or UI path. Happy, replay and hostile reviewer
executions preserved all source and effect byte/count oracles.

## Reviewer-personal executable proof

I did not reuse builder output. I created only one fresh isolated PostgreSQL 16.15
container, `yellow-order285-tier3-pg`, on verified-unused loopback port `5598`, with
dedicated volume `yellow-order285-tier3-pgdata`. No second app or Valkey was started.
I provisioned distinct disposable deploy/runtime/extension authority, migrated and
seeded a canonical `yellow_dev`, independently created `yellow_test`, applied
migrations 1–52 and loaded `tests/seed_fixture.sql`.

Personally executed results:

- exact Order285 intentional/current hostile proof: **16 passed, 0 failed, 301
  expectations**;
- full migration runner against the disposable `/postgres` authority: **39 passed,
  0 failed, 187 expectations**;
- canonical database acceptance: **17 passed, 0 failed, 49 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 111 expectations**;
- direct catalogue: **52 migrations / 104 public tables / 94 RLS-enabled tenant
  tables / 94 tenant-isolation policies / 4 FORCE-RLS tables**; the forced tables
  are exactly `india_gst_item_classification`,
  `india_gst_recipient_sez_status`, `india_gst_supplier_service_location` and
  `property_fiscal_location`;
- reviewer-captured schema normalized through the repository normalizer matched
  `tests/schema/expected.sql` exactly;
- the PostgreSQL-only setup contract was reproduced explicitly: provisioned roles,
  canonical dev migration/seed, fresh invariant database, migrations 1–52, exact
  104-table assertion and canonical fixture; `bash -n setup.sh` passed, and the
  protected referee reported **11 passed, 0 failed of 11**, including **94 tenant
  tables / 94 RLS / 94 policies** and both security-invoker views;
- standing `bun test`: **936 passed, 851 database/environment skips, 0 failed,
  14,049 expectations; 1,787 tests across 314 files**;
- `bun run typecheck`: exit 0; import boundaries: **108 TypeScript files**, pass;
  dependency licence policy: **23 packages**, pass; `bun audit`: no
  vulnerabilities; forbidden-authority/static/source/docs/scope/diff gates: pass.

The desktop tool launches native Bun while repository `setup.sh` is Bash. A first
WSL invocation could not receive the native process's override variables and could
not find native Bun, so it exited before proof. Although Compose printed a start
request against the default project, the exact stable container identities, start
timestamps, restart counts and health remained unchanged. I therefore reproduced
the canonical `--db-only` contract step by step against the single isolated
container above and personally ran its final referee. The isolated acceptance run
first exposed that my manual PostgreSQL container had not preloaded
`pg_stat_statements` (**16 passed, 1 failed**); after configuring that required
extension preload in the disposable container only, the identical unchanged
candidate passed **17/0/49**. Both were reviewer harness configuration issues, not
candidate failures or stable-runtime interactions.

## Cleanup, stable-runtime preservation and bounded approval

Before removal, the disposable container was running at restart count zero and no
`yellow_migrate_%` child database remained. I removed the exact review container,
volume, normalized dump, official-source downloads and other disposable evidence;
post-cleanup counts are **0 containers / 0 volumes** for their names.

The actual sole stable runtime retained its exact full container identities,
health, restart counts and start timestamps before and after review:

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
finding remains. Approval is limited to the exact affirmative recipient
registration/SEZ-status evidence at candidate `8630639`. It grants no
authorized-operations, zero-rating, section 16, place-of-supply, intra/inter-State
conclusion, levy/exemption/rate/value/tax component, item, posting/correction,
invoice/document/number/hash-chain, provider/submission, API/HTTP/UI, local
promotion, merge, deployment, Phase-7 completion or application-complete authority.
Apart from this review record, I changed no repository file.
