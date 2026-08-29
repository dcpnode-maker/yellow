# Order 280 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order280_review`)
**Reviewed commit:** `0ba0581356d385234f5a0705eeda15a6b5fca164`
**Reviewed base:** `21bd115` (Order280 admission; approved Order279 descendant)
**Reviewed range:** `21bd115..0ba0581`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order280. I read `PROJECT.md` and `AGENTS.md`, ran
`./state.sh`, and read the compliance, entity and PostgreSQL skills, roster/workflow,
Order280, D-732/D-733, and the relevant Order272/276/279 boundaries before evaluating
the exact candidate.

The reviewed head was the exact clean commit
`0ba0581356d385234f5a0705eeda15a6b5fca164`; independently approved Order279 commit
`4a0f3edaa9f2f25bdd64f83a0a0be16a3a6274b2` is its ancestor. The nineteen changed
paths are exactly the declared migration, resolver/export, focused tests, catalogue/
schema proof, contracts and governance records. There is no seed, dependency,
credential, local-runtime, app, provider or deployment path in the range.
`git diff --check`, `git show --check`, exact ancestry, name-status and clean-worktree
proof passed.

## Official statutory-source and separation audit

I personally checked CBIC's official **Integrated Goods and Services Tax Act** at
`https://cbic-gst.gov.in/hindi/IGST-bill-e.html`. Section 12(3)(b) includes lodging
accommodation by a hotel, inn, guest house, home stay, club or campsite and places
that supply where the immovable property, boat or vessel is located or intended to
be located (subject to the section's stated qualifications). This supports retaining
typed physical-property location evidence separately from a supplier or recipient
registration address.

I also checked the GSTN-authorized IRIS IRP **Notified E-invoice Schema** at
`https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`. It lists seller
address/location/PIN/state separately and lists mandatory buyer place of supply as
the distinct top-level attribute `Pos`. It also separately lists `SupTyp`, `IsServc`
and `HsnCd`. Order280 emits none of those decisions. Its result is only a future
place-of-supply input; it cannot lawfully be treated as final `Pos`, supply type,
service classification or tax authority.

## Schema, tenant and resolver audit

Migration0049 creates exactly seven columns beginning with `tenant_id`. The sole
identity is `(tenant_id,property_node)`, with a same-tenant composite foreign key to
`org_node`. Country is fixed to `IN`; state/UT code, trimmed bounded address/locality
and nonzero six-digit PIN checks are exact. The primary key is tenant-leading. RLS is
enabled and forced, with a transaction-local `app.tenant_id` policy. `PUBLIC` and
`yellow_runtime` receive no direct table grant; `app_role` receives SELECT only and
no insert, update, delete, truncate, reference or trigger authority. There is no
writer or owner-mediated capability.

The resolver accepts only the exact accessor/proxy/symbol-free two-key plain object
`{tenantId,propertyNode}` containing lowercase canonical UUIDs. Its one SELECT
equality-binds explicit tenant, transaction-local tenant, property identity, country
and `org_node.kind='property'`. The exact stored-row parser rechecks tenant/property,
country, current state/UT code, canonical bounded address/locality and PIN. Missing,
foreign, malformed, duplicate or incoherent evidence fails closed.

The result fixes the exact field order
`propertyNode,countryCode,stateCode,addressLine1,locality,pin,evidenceHash`, is deeply
frozen, and deterministically hashes fixed-order evidence including the unexposed
tenant id. Reviewer execution confirmed byte-identical replay. Supplier and recipient
registration states, `org_node` name/config/path/timezone/currency, profile/space/
unit-type truth and `GST_ROOM` never enter the query or substitute for the selected
evidence.

## Zero-write and authority audit

Source inspection and static scans found a single SELECT and no insert/update/delete,
lock, `FOR UPDATE`/share, advisory lock, event/fact/outbox/idempotency, journal,
posting, document, fiscal submission, provider, network, API, HTTP, UI or local path.
The apparent source token `.update(...)` is only `Bun.CryptoHasher` input, not SQL or
state mutation. Reviewer-executed before/after count and byte digests prove successful,
replayed and failed reads leave the location root, org nodes, both registration roots,
tax lineage, facts, events, documents, journals, postings and submissions unchanged.

## Reviewer-personal executable proof

I did not rely on builder-recorded output. I created one isolated disposable Windows
Docker Compose project `yellow-order280-review-829` using PostgreSQL 16.15 and Valkey
on unused ports 5572/6512, never started an application container, and personally ran:

- exact Order280 intentional/current database suites with required deploy/runtime
  identities: **12 passed, 0 failed, 107 expectations**;
- database acceptance: **14 passed, 0 failed, 38 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 108 expectations**;
- full migration runner using the exact `yellow_deploy` `/postgres` admin URL:
  **39 passed, 0 failed, 185 expectations**;
- schema drift: exact match; direct catalogue recount: **49 migrations / 101 public
  tables / 91 RLS tables / 91 policies**;
- fresh isolated referee database: **11 passed, 0 failed of 11**;
- `bun test`: **889 passed, 815 environment/database-only skips, 0 failed,
  9,048 expectations; 1,704 tests across 304 files**;
- `bun run typecheck`: exit0; `bun run boundaries`: **103 TypeScript files**, pass;
  `bun run license-check`: **23 packages**, pass; `bun audit` and high-level audit:
  no vulnerabilities;
- exact range ancestry, scope, diff, authority and zero-write scans: pass.

The repository's bundled minimal Windows Git shell lacked several coreutils required
to invoke the wrapper script directly, so I executed its required migration,
catalogue, schema and referee proofs explicitly with Windows Docker, Windows Bun and
CPython rather than falling through to WSL. One first referee process completed its
initial database operation but Windows CP1252 could not print the Unicode arrow; I
discarded that database, rebuilt it from exact migrations and fixture, set UTF-8, and
reran the complete 11/11 proof. No credential was printed.

The exact disposable containers, network, volume and temporary Python helper are now
absent. Stable app `92cffafb9351`, PostgreSQL `f4f02655770a` and Valkey
`aa3061bdf231` remained healthy with restart count zero; stable HTTP health remained
200. The stable runtime was not mutated.

## Findings and bounded approval

No finding remains. I recommend approval only for the exact tenant-isolated,
SELECT-only physical-property fiscal-location evidence root and resolver at commit
`0ba0581356d385234f5a0705eeda15a6b5fca164`.

This approval grants no final IRP `Pos` or `SupTyp`; no B2C/URP, export, SEZ or
deemed-export treatment; no accommodation/service classification or HSN/SAC; no
CGST/SGST/IGST decomposition or tax rate; no reservation/folio/buyer association;
no posting/correction, document allocation/issue/number/hash chain, provider,
submission, API, HTTP, UI, local promotion, merge, public deployment, Phase-7-complete
or application-complete authority. Apart from this review record, I changed no file.
