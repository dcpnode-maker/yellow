# Order 417 — Local hotel-data dependency retirement

**Status:** GUARDED RETIREMENT WAITING ON HOST FILE ACTION — D1244
**Phase:** Cross-phase local build hygiene
**Risk tier:** 3 — destructive local data handling
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer required

## Objective

Prove Yellow's executable tests and build gates do not depend on retained founder-UAT hotel records, remove any such dependency, then retire all populated hotel data from the sole local runtime so a deliberate India/Canada/Yellow UAT database can be created later.

## Scope

- test/setup/fixture code only where needed to make every executable proof self-contained;
- exact inventory and retirement of tenant, property, guest, reservation, folio and related populated hotel records in the sole local PostgreSQL runtime;
- exact inventory and retirement of local database dumps containing populated hotel data;
- empty-state runtime verification and recorded proof;
- this order, its review, decision and ledger evidence.

## Preservation boundary

- preserve application source, migrations, schema and invariant definitions;
- preserve reusable synthetic fixture/scenario generators as code, but do not load a populated hotel dataset;
- preserve authentication/runtime configuration without exposing credentials;
- preserve the single Docker stack and its PostgreSQL volume unless a verified empty replacement is required;
- do not delete repository history, research, orders, reviews or source evidence.

## Required proof before retirement

1. Complete standing suite and database acceptance/referee gates pass from isolated test-created data.
2. Static and runtime audit shows no test reads the retained UAT tenant/property identities or sole-local database contents.
3. Any discovered dependency is replaced by deterministic test-local setup and the complete proof restarts green.
4. A fresh non-implementing Tier-3 reviewer personally verifies the dependency proof and exact retirement target.

## Required proof after retirement

1. No populated hotel tenant, property, guest, reservation, folio, posting or operational records remain in the sole local runtime or retained local database dumps.
2. Schema/migration catalogue remains exact and referee remains green against an isolated proof database.
3. The application reaches its authenticated empty state without silently reseeding hotel data.
4. No second Docker/local instance or database authority is created.

## Forbidden

No production/external data deletion; no application feature removal; no schema contraction or migration rewrite; no repository fixture/history deletion; no credential exposure; no deployment, merge or push; no recreation of India, Canada or Yellow hotel data within this order.

## Builder evidence

- The retained runtime was not read by the standing suite. Focused setup-isolation proof passed 5/0 with inherited authority/catalogue checks.
- `setup.sh --db-only` no longer invokes the explicit demo seed against retained `yellow_dev`; the deterministic seed remains available for deliberate disposable tests and future UAT creation.
- The disposable `yellow_test` referee database is dropped after successful 11/11 execution.
- Standing suite: 1,368 passed, 1,054 skipped, 0 failed, 20,127 assertions.
- Type check, 152 import boundaries, 23-package licence policy and dependency audit are green.
- No hotel row, dump, volume, credential, container or local application was deleted by the builder. Fresh non-implementing Tier-3 review remains mandatory before retirement.

## Guarded retirement progress

- The stopped populated `yellow_order311_clean_pgdata` runtime and its sole PostgreSQL container were removed after D1242 approval, together with the empty orphan Order365 proof volume.
- Docker now has zero volumes and no PostgreSQL container; the three stopped non-database components of the sole intended stack remain.
- The archived Order147 database dump is absent; its 195-byte authentication/runtime authority file remains preserved.
- Fresh independent recursive verification found seven populated nested dumps under `D:\Yellow\backups`, totaling 12,444,872 bytes. The earlier root-only check did not enumerate nested folders.
- The execution environment blocked recursive host-file deletion before any file changed. Order417 remains open until the founder removes those seven approved dump targets and a fresh recursive absence/topology check is recorded.
- Docker has zero volumes and no PostgreSQL container. Three stopped non-database components of the intended single stack remain, with no listeners on their configured ports.
