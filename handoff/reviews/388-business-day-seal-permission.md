# Order 388 — fresh independent Tier 3 review

**Verdict:** APPROVED
**Base:** `7ce8ccf`
**Executable candidate:** `465b9f3`
**Governance head reviewed:** `4187e55`
**Reviewer:** `/root/order388_fresh_tier3`, fresh non-implementing Tier 3

I independently approve the narrowly bounded business-day seal permission prerequisite.
Migration 0067 contains only the two canonical permission rows: internal
`business_day.seal` / `Seal business day` and edge
`financials.business-days:seal` / `Seal governed property business days`. It creates
no role grant. Review provisioning grants both directly and effectively only to the
ordinary exact-property operator, explicitly excludes both and the carry-maker
permission from the specialized checker, emits the ordinary JWT edge scope while the
internal dot-only permission remains filtered, and leaves the checker JWT unchanged
and seal-free. Replay is an exact no-op and divergent credentials fail closed. The
fixture removes its duplicate catalogue tuple while retaining the Night Auditor
internal grant.

Reviewer-personal database proof used a new official Windows PostgreSQL **16.15**
cluster on loopback port 55501 with SCRAM authentication and
`pg_stat_statements` preloaded. A wrong password was rejected. Migrations 1–67
applied, and the live catalogue was exactly **67 migrations / 9 permissions / 0
migration seal grants / 116 public tables / 106 RLS tables / 106 policies / 15
forced-RLS tables / 2 views**. Migration0067 SHA-256 is
`a2c3ae78442c29c56766eae6d718970f39fa493ae1ec30427ac44489cf42b2c5`.
A native PG16.15 normalized schema dump was byte-identical to the committed snapshot,
SHA-256 `a5efaaae5ad3d2315cf2fc62a7dd2352e3992b9643f91784ca70994d1f89e8a9`.

Reviewer-personal executable results:

- focused permission proof **4/0 (10)** and current intentional-red oracle **3/0
  (13)**;
- migration regression **39/0 (187)**, review seed **25/0 (113)**, separate clean
  acceptance **23/0 (65)** and schema normalizer **4/0 (19)**;
- separately migrated and fixture-loaded referee database **11/11**;
- canonical non-browser operator proof **517/0** with **117 expected skips**: 512
  operator-prefixed tests after excluding the separately governed browser file, plus
  the five discrepancy-carry operator-domain tests;
- standing non-browser proof **1,258/0**, **989 expected database skips**, **18,748
  assertions** across 413 files. The count differs from D1151's builder invocation
  because this reviewer did not activate unrelated database-gated suites; every
  Order388 database gate was instead executed explicitly above.

TypeScript, 142 import boundaries, the 23-package licence policy, production
dependency audit (zero vulnerabilities), and range diff hygiene pass. Exact diff
inspection finds no service, HTTP, UI, identity-token grammar, baseline migration,
schema snapshot, local, deployment or dependency change. Candidate product/test
paths are confined to D1148's allowlist; the only additional paths are the recorded
Question186, prospective migration-number correction in Order386, and append-only
governance authorized by D1149–D1151.

Three discarded setup attempts grant no evidence: the first database omitted the
pre-migration authority-role provisioner; the first review-seed rerun reused a
deliberately different approver secret; and the repository schema CLI is Docker-bound,
so its attempted invocation did not run under the no-Docker review boundary. Each
required proof was rerun successfully on a clean appropriate database, with the
schema verified using the official native `pg_dump`. An unrelated Order195 Chromium
geometry test could not expose a DevTools port and is outside Order388; it was excluded
from the canonical non-browser operator/standing gates rather than waived as Order388
evidence.

No product, test, migration, snapshot, seed, service, stable local, `.yellow`, Docker,
port3000, deploy, merge or push surface was changed by this reviewer. Governance
closure remains root-owned.
