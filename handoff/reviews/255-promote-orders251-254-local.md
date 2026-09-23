# Order 255 — sole-local Orders251–254 promotion verification

**Conclusion:** PASS — local-only operational verification

**Served source:** `62afc68737f81f165358a5cd3f453254eefa2ab4`

**Verifier:** independent non-operating Codex worker

## Scope and method

The verifier did not build, restart, replace, migrate, seed, edit application source,
change credentials, mutate data or alter Git. Read-only Docker inspection, PostgreSQL
catalogue queries, protected-file metadata/hash checks and loopback HTTP checks were
performed against the completed promotion. Protected sign-in values and the
short-lived access token remained only in process memory. This file is the sole
verification write.

## Reversibility and protected backup

The retained rollback tag `yellow-order255-rollback:pre-orders251-254` resolves to
image id prefix `9d6bb66c6e29`. The restricted backup artefacts are:

- `D:\Yellow\backups\yellow-pre-order255-20260828T210829Z.dump` — 692,682 bytes,
  SHA-256 `8f875088c8c571a0d255fb091ed942d1b4d43546e8e764b27be02393caac874f`;
- `D:\Yellow\backups\yellow-pre-order255-20260828T210829Z-counts.txt` — 1,499 bytes,
  SHA-256 `2840c5fe0b1e36c805a62751d1f3b5907f9590bead1a476e2b23e8199fa81889`.

Both files are ACL-protected, owned by the current Windows account and expose only
two protected access rules. A read-only PostgreSQL 16.15 restore-catalogue inspection
passes with 1,269 catalogue entries.

## Exact database promotion

The live ledger is continuous at exactly 42 rows, versions 1 through 42, with no
missing version. Row 41 remains byte-identical by recorded identity:
`0041_quoted_tax_reservation_lineage.sql`, checksum
`96795066ed0ae795044a56c7fbef33087e8c7fa94647b22482ee6b48ed06f171`.
The sole appended row is 42,
`0042_quoted_tax_reservation_no_binding_compatibility.sql`, checksum
`dd2622f024859231a6128f649276bb4904d60f2380de9324196c22ac43b0c098`.

The resulting catalogue is exactly 96 public tables, 86 public policies and two
properties. Both quoted-tax binding roots remain empty. Comparing all 95 non-ledger
public-table counts with the protected pre-promotion manifest produces zero drift.
The independent verifier deliberately did not rerun the migration runner because
that would cross the non-operating boundary; the continuous ledger, unchanged row41,
sole row42 append and zero non-ledger count drift are the available read-only no-op
corroboration.

The final six-UUID `public.link_tax_attribution_reservation` capability is owned by
`yellow_owner`, is `SECURITY DEFINER`, and fixes
`search_path=pg_catalog, public, pg_temp`. `PUBLIC` and `yellow_runtime` cannot
execute it; `app_role` can. The binding table has RLS enabled and one policy;
`app_role` can select but cannot insert, update or delete it.

## Sole local and founder access

Exactly one healthy application container is present: id prefix `c003bc076893`,
image SHA-256
`f15586b35662f19791aec67f1dbaa23022c8282ef8474e43b7d2c18532e9e398`, bound only to
`127.0.0.1:3000`. Ports 3002 and 3188 are closed. PostgreSQL id prefix
`b0a92182a16a` and Valkey id prefix `ae62afc8df69` are healthy and retain the exact
volume `yellow-order175-folio-responsive-containment_yellow-pgdata`; the compose
project contains only the one app, PostgreSQL and Valkey containers.

Root returns HTTP 200 with `Cache-Control: no-store`. The protected sign-in form has
autocomplete disabled, all three fields populated and the password masked. Submitting
that form returns HTTP 200 and a token without disclosing any credential. The
authenticated property endpoint returns exactly two properties. Both system-status
responses are exact:
`2026-08-29 / latest252 / current253 / review91 / active7`.

Served source is byte-exact to clean current HEAD for all three promotion-critical
files:

- `src/project-status.ts` —
  `11f3d2bd5050a792d79d9bfaf7c78b1fcd9b357c84e64ad9a45a116ec3bf4ce9`;
- `src/contexts/tax-fiscal/posting-plan.ts` —
  `e0169f6eb6f4de65f7a11d603c36be7f44489cc6877142644c073512ebde1818`;
- `src/contexts/reservations/commit.ts` —
  `ad8f76ca03895dd690ef3d11b5fe5090f7fa59dfc62d5c1efaf078a7c4980f9c`.

## Finding and boundary

No blocking operational finding was found. Order255's sole-local promotion is
approved. This is not product review and does not raise review coverage above 91,
merge, expose publicly, deploy to production, or claim Phase or application
completion.
