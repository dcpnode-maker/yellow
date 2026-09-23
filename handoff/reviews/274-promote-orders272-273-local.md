# Review 274 — Promote approved Orders272–273 to the retained sole local

**Reviewer:** fresh independent non-implementing, non-operating Codex Tier-3 reviewer (`/root/order274_independent_review`)  
**Verdict:** APPROVED — no finding  
**Date:** 2026-08-29  
**Reviewed commit:** `d17b1544954358f61aeb07e7511ad6541af31695`  
**Reviewed base:** `2cc2622`  
**Authority:** Order274 / D-714 / D-715 only

## Verdict

Order274 is approved. The safely repeatable read-only evidence is green for source
lineage, restricted backup and rollback, live database preservation and migration47
truth, contained registration authority, retained runtime identities, sole-local
topology, HTTP, protected button-only authentication and both authenticated status
responses. The reviewer did not implement or operate Order274 and did not mutate the
repository except for this review record.

The reviewer personally authenticated once through the real protected form by
clicking only `Enter workbench`, without reading, typing or emitting credential
values, and observed exactly two property options. After the browser connection
became unavailable, the reviewer independently completed the missing status proof
through the exact authenticated same-origin `system-status` endpoint consumed by
that UI. Both properties returned exact latest272/current273/review91/active7,
the unchanged13-phase vector and live app/database operational with tenant context
confirmed. The coordinator's separate UI-rendering check is disclosed as
supplemental evidence only and was not treated as this reviewer's proof.

## Independently executed evidence

### Exact Git/source lineage — PASS

- The worktree was clean at exact local and pushed commit
  `d17b1544954358f61aeb07e7511ad6541af31695`.
- `2cc2622` is an ancestor. The promotion commit changes only `DECISIONS.log`,
  `handoff/LEDGER.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md` and the
  Order274 record.
- Migration47 independently hashes to
  `7e5b8a912230ebbd7cf033b4883a7138ba5ae2d9fcb007dda42b5345d1c95bf0`.
- `git diff --check 2cc2622..d17b1544954358f61aeb07e7511ad6541af31695`
  passed.

### Restricted backup, catalogue and rollback — PASS

- `D:\Yellow\backups\yellow-order274-20260829T063345Z` is inheritance-protected,
  owned by `ASTHA\astha`, and grants FullControl only to the owner and
  `NT AUTHORITY\SYSTEM`; every file has only those two allow principals.
- The custom dump is 761,344 bytes with independently recomputed SHA-256
  `fe535af1da59b1aa95d11900dbddedf0c355f7b8407df1ec344597297dfca99c`.
- Existing PostgreSQL16.15 `pg_restore -l` read the dump from stdin with exit0 and
  reproduced the saved 1,324-line catalogue exactly after line-ending
  normalization. No restore was executed.
- Before/after manifests are byte-identical: 97 prior table counts, two property
  identities and binary ledger rows1–46.
- The root-filesystem rollback archive is 147,425,792 bytes with independently
  recomputed SHA-256
  `970c8fefda8ba62c084f8152547807a6eb59d179619308ee0ec66c04fe4e0191`;
  `tar -tf` exited0 and listed 3,392 entries.
- Rollback image `yellow-order274-rollback:pre-orders272-273` resolves to
  `sha256:bd0a7e73c3e4087c09400f576fee82266778ff04b8197c26ec306d6cc20d4024`
  with user `bun`, workdir `/app` and command `bun run start`.

### Live database, forced read-only — PASS

Every database query used exact retained PostgreSQL container
`f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`
with `PGOPTIONS=-c default_transaction_read_only=on`, `psql -X`,
`ON_ERROR_STOP=1` and SELECT-only SQL. Results:

```text
transaction_read_only=on
migrations=47|min=1|max=47
public_tables=99
rls_policies=89
properties=2
property_fiscal_registration_rows=0
open_other_transactions=0
migration47=0047_property_fiscal_registration.sql|7e5b8a91…c95bf0
historical_ledger_rows=46|binary_exact=true
prior_table_counts=97|set_exact=true
property_identities=2|binary_exact=true
```

The new registration root is owned by `yellow_owner`, has RLS enabled, has one
tenant-isolation policy, grants `app_role` only SELECT and grants no runtime/PUBLIC
DML. Its live catalogue has 18 constraints (two foreign keys, one primary key, one
unique constraint and fourteen checks) and the exact three expected indexes:
`property_fiscal_registration_pk`,
`property_fiscal_registration_identity_uq` and
`property_fiscal_registration_lookup`.

The protected operation record contains the one migration47 application on PID35543
followed by `applied=0 status=no-op transaction_pids=none`. The reviewer did not
rerun the production runner.

### Retained runtime and sole-local topology — PASS

- App `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf`
  is running/healthy/restart0 on image
  `sha256:54d252ae8b3a506c3f839af740b6e4bdec29a1ebd0b6cda0334459b30ed2a7e7`.
- Exact PostgreSQL and Valkey container identities are running/healthy/restart0.
- PostgreSQL retains volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata`.
- Exactly the app, PostgreSQL and Valkey attach to network
  `ba56ef587dbac90f222237d890c410c377aa9a36670ffdf2bd0412b4ce65161a`.
- Only loopback3000 is the app listener;3002/3123/3188 are closed. PostgreSQL5545
  and Valkey6485 remain loopback-only.

### HTTP and protected authentication — PASS

Root and health returned200. `operator.css`, `operator.js` and
`operator-local-prefill.js` returned200. Root is `Cache-Control: no-store`; the local
prefill asset is also no-store.

From a signed-out root, the reviewer confirmed the protected local-review controls
without reading any value. The password control remained type `password`, the
button was enabled, and clicking only `Enter workbench` authenticated
`Yellow Review Operator`. No value was typed, logged, serialized, hashed or emitted.
The authenticated property selector contained exactly two options.

### Both authenticated status responses — PASS

The first real-browser operation authenticated the reviewer through the protected
button-only form and returned exactly two property options. Its later pixel read was
interrupted, and two attempts to restore browser control in this independent session
returned no available browser; those interruptions are disclosed rather than hidden.

To complete only the missing authoritative status proof, the reviewer fetched the
loopback no-store document, kept its protected form values and returned access token
only in process memory, authenticated successfully, enumerated exactly two granted
properties, and issued exactly one authenticated same-origin GET to
`/api/v1/properties/:id/system-status` for each. No credential or token value was
read into review output, typed, logged, serialized, hashed or emitted. Both responses
were HTTP200/no-store and independently returned:

```text
latestBuiltOrder=272
currentOrder=273
independentlyReviewedThroughOrder=91
activePhase=7
phaseCount=13
phaseVector=reviewed,reviewed,reviewed,reviewed,built_unverified,
            active,active,active,planned,planned,planned,planned,planned
live.app.state=operational
live.database.state=operational
live.database.tenantContext=true
```

The coordinator separately reported that both properties rendered the same truth in
the real UI. That rendering is supplemental builder evidence, not a substitute for
the reviewer's personal button-only authentication, two-property observation and
two-endpoint semantic proof above.

## No-mutation statement

This reviewer did not build, run Compose, apply or rerun a migration, seed, restore,
provision, start, stop, restart, recreate or remove a container, image, network or
volume; did not write the database or cache; did not read or expose credential
values; and did not modify product/runtime source. Only this review record was added.
