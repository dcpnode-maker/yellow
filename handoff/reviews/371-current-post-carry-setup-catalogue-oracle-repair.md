# Order 371 current post-carry setup catalogue oracle repair — fresh Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order371_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact product candidate:** `8d969744a38370cab5637338305099261da04049`

**Exact governance frontier reviewed:** `17080f983ebe936c3fceabe18f00793143fc642b`

## Scope and candidate identity

The product candidate is an ancestor of the exact governance frontier. Its parent-to-candidate
diff contains only `setup.sh` and `tests/setup-current-catalogue-oracle.test.ts`. The setup
change is exactly two lines: `115` becomes `116`, and matching `1-62` text becomes `1-63` in
the assertion/error and success text. The permanent test is the only added file. The range
from the product candidate to the governance frontier changes only Order371, `DECISIONS.log`
and `handoff/LEDGER.md`. No migration, expected schema, ACL, policy, role, seed, runtime,
application or local-promotion byte changes.

## Reviewer-derived catalogue and intentional red

Independent canonical-source enumeration found 63 sequential migration files, highest
migration 0063, and 116 `CREATE TABLE public.*` statements in the committed expected schema.
The expected-schema SHA-256 is
`f3eaea77f2016596c8744cbdcb84e91e789e3bde1db64e79b15013a0c57666d6`.

In a disposable clone, reversing only the candidate's two setup lines made the permanent
test fail **0/1** after its catalogue tuple `63 / 63 / 116` passed. A separately named fresh
official pinned-image setup then applied all 63 migrations to development and referee
databases and stopped only at:

```text
yellow_test has 116 public tables; expected 115 after migrations 1-62.
```

After byte-restoring the exact candidate, the focused test passed **1/0 (5)**. A different
fresh Compose project and volume printed `yellow_test tables: 116 after migrations 1-63`,
then the invariant referee completed **11 passed, 0 failed of 11**.

## Fresh PostgreSQL 16.15 and preservation proof

Because the host Docker backend cycled after the setup commands, the long-running gates used
a separate official upstream PostgreSQL 16.15 source build in isolated WSL storage. The
official tarball SHA-256 sidecar verified successfully. A fresh SCRAM-authenticated cluster
personally returned server version exactly `16.15` and live catalogue:

- 63 applied migrations, highest 63;
- 116 public base tables;
- 106 RLS-enabled tenant tables and 106 public policies;
- 15 FORCE-RLS tables; and
- two public views, each with `security_invoker=true`.

Reviewer-executed permanent gates on that cluster:

- migration integration: **39/0 (187)**;
- database acceptance: **23/0 (65)**, including exact PostgreSQL 16.15;
- runtime DML authority: **5/0 (120)**;
- SECURITY DEFINER containment: **3/0 (192)**;
- deterministic seed: **10/0 (63)**;
- review seed: **24/0 (111)**;
- schema normalizer: **4/0 (19)** and live dump exact against the 18,317-line expected schema;
- a separately created, migrated and fixture-loaded referee database: **11/11**.

The complete standing suite passed **1217/0**, 946 expected database skips and **18,524**
expectations across 400 files. Typecheck, 139-file import boundaries, the 23-package licence
policy, production audit with zero vulnerabilities, diff hygiene and product-byte identity
through the governance frontier all passed.

The first upstream proof attempts exposed only harness configuration: missing ICU development
metadata, an unlinked `pgcrypto` OpenSSL build, and host `trust` authentication that could not
exercise the required 28P01 case. Each failed before usable approval proof; the disposable
cluster was removed, the verified source was clean-rebuilt with OpenSSL, and the final fresh
SCRAM cluster produced the complete green results above. These are not candidate findings.

## Stable-local boundary

No stable named resource or canonical `.yellow` file was written, started, stopped or
restarted by this reviewer. Docker API/port 3000 were transiently unavailable during the
backend cycle; the final read-only recheck returned `200 {"status":"ok"}` on port 3000.
The canonical `.yellow` inventory retained the same sizes, timestamps and SHA-256 values as
the opening snapshot. Only reviewer-named disposable resources and ports were used.

## Decision

Order371 is **APPROVED** at exact product candidate `8d969744a38370cab5637338305099261da04049`
and governance frontier `17080f983ebe936c3fceabe18f00793143fc642b`. This approves only the
current setup catalogue oracle correction to 116 tables after migrations 1-63. It grants no
migration, schema, product runtime, readiness, seal, local promotion, deployment, merge,
Phase-5/7 or application-completion authority.
