# Orders 387/395 — fresh independent Tier-3 review

**Verdict:** APPROVED
**Base:** `1196d89`
**Executable candidate:** `deedeaa`
**Focus repair:** `a5c8b0f`
**Governance head reviewed:** `8cd4021`
**Reviewer:** `/root/order395_fresh_tier3`, different fresh non-implementing Tier 3

I independently approve the governed operator discrepancy-carry journey and its
executable proof repair. Inspection confirms that every facade and HTTP operation
reuses the middleware-owned `context.tx`; browser inputs are limited to the exact
candidate/reason or opaque approval identity; server and PostgreSQL derive target,
hash, actor and canonical payload truth; decision and consumption lock and revalidate
kind, subject, property, payload, status, distinct maker/checker, permissions and the
strict transaction-time thirty-minute window. Migration 0063 is unchanged from the
approved base authority, remains the atomic final revalidation, and retains raw-DML,
ACL, one-use, race and append-only evidence containment. The new inbox query uses
typed `jsonb_to_record` evidence rather than a JSONB `->>` predicate in its `WHERE`.

Reviewer-personal execution used a new official Windows PostgreSQL **16.15** cluster
on port 55498 with SCRAM authentication and `pg_stat_statements` 1.10 preloaded.
Wrong-password authentication returned `28P01`; migrations 1–66 applied. The full
carry suite passed **20/0 (1,916 assertions)**, including real default-50 and
explicit-100 pages, non-null continuation over 101 rows, equal-created-at `(created_at,
id)` ties, MAX+1 malformed lookahead and malformed one-row failure, tenant/property
containment and minimized privacy. It also executes strict 30-minute boundaries,
maker/checker and inactive/foreign authority, source/target seal and lineage races,
rollback, replay/content conflict, one-use, concurrency, Orders 366/367 reuse hostility,
500/501 and 366/367 bounds, immutable carry evidence and no direct runtime mutation.

Real Chromium passed **1/0 (38 assertions)** and drove production-extracted Request
cancel/submit, Approve, Reject and Carry behavior, ambiguous retry-key retention,
success clearing, stale-response suppression and focus across all six approved
appearances at 390 and 1280 widths. I restored the pre-D1144 focus-before-enable
ordering as a reviewer-only mutation: the suite became **0/1**, exactly because
`actionFailureFocus` was false. Byte restoration returned SHA-256
`F2A95DED700A3435AF1964F1F031861ADC48E9E6699879DF3BEECF4CE622F527`, a clean product
diff, and Chromium **1/0 (38)**.

Additional reviewer-personal results: focused unit/HTTP/workbench **16/0 (94)**;
review seed **25/0 (112)** with distinct exact maker/checker roles; clean deployment
acceptance **23/0 (65)**; migration **39/0 (187)**; schema normalizer **4/0 (19)**;
native PG16.15 normalized schema byte-identical to `tests/schema/expected.sql`;
referee **11/11**; operator **517/0 with 117 expected skips (5,750 assertions)**;
standing **1,260/0 with 983 expected skips (18,819 assertions)**. TypeScript,
142 import boundaries, 23-package licence policy, zero-vulnerability audit and diff
hygiene pass.

Two setup mistakes were excluded rather than waived: installing `pg_stat_statements`
in `public` added its two views before the carry catalogue assertion, and running
acceptance after the review seed added the intentional review property. Dropping only
the disposable extension restored the full carry proof, and a separately recreated,
migrated and canonically seeded database passed acceptance. Neither was a product
failure. No product, permanent test, migration, schema, seed, permission, service,
stable local, `.yellow`, Docker, deploy, merge or push surface was changed. Governance
closure remains root-owned.
