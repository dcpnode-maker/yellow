# Order 398 — fresh independent Tier 3 review

**Verdict:** APPROVED

**Reviewer:** `/root/order398_fresh_tier3`, fresh independent non-implementing and
non-operating Tier 3

**Reviewed candidate:** `3d793df441f2bb4837cd11d844de3d27761be752`

**Order 399 approved prerequisite:** `183aa34`

## Scope and recovery inspection

I approve the exact Order 398 candidate. I read `PROJECT.md`, current `state.sh`
truth, Order 398, D-1167/D-1171, the approved Order 399 review, PostgreSQL and
compliance skills, roster and workflow before inspecting or executing proof. I did
not implement or operate the recovery or reconciliation and did not mutate the
application, retained database, retained containers, credentials or protected
`.yellow` files.

The Order 398 commits change governance only. The exact approved product source
remains `d1f6f45e1835df86bf0c27c50beba66113b4ae96`; the only intervening product-side
files belong to the separately independently approved, narrowly bounded Order 399
local reconciliation prerequisite. No migration, schema, hotel fact, financial row,
credential, public bind, deployment, merge or push is introduced by Order 398.

## Reviewer-executed proof

- Docker retains the exact `yellow_order311_clean_pgdata` volume and
  `yellow_order311_local` network. The app, PostgreSQL, provider and Valkey are all
  healthy with zero restarts on that network. Docker's original WSL path is an exact
  junction to `E:\Yellow\docker-data\wsl`; no reset or prune evidence was found.
- The protected pre-migration custom backup is exactly **833,216 bytes**, SHA-256
  `45477fc4592dfae1f96e3645a6d643dcc17702295750a452ff58adaa22e482d1`. It inherits
  only owner and SYSTEM full-control entries from a protected parent. A reviewer-run
  network-disabled, read-only `pg_restore -l` check exited zero with exactly **1,426**
  catalogue lines.
- Read-only PostgreSQL proof found exactly migrations **1–68**, **116** public base
  tables, **2** public views and **106** public policies. Migrations 60–68 carry the
  expected checksum prefixes `2379fed5d093`, `50cf8593ac38`, `0107247dd397`,
  `2b9dc9c73b77`, `82a1c49f936c`, `8e28af137263`, `9a4797260390`,
  `a2c3ae78442c` and `19eedaa18ae6`.
- The retained data remains exactly two properties and **8 parties / 0 contacts /
  8 party roles / 75 facts / 22 outbox rows**, with **0 journals / 0 posting lines**.
- The sole running UI app is container
  `40c47fe5425c383c5cf5c8059181149d3f7cbd597307c1c5c3470ce33063fcc0`, image
  `sha256:15707acfdf251ab6e6269cbb7cee9ab9c8a1f84d919a889e8a205cc3b49ec247`,
  with exact source label `d1f6f45e1835df86bf0c27c50beba66113b4ae96`. The prior image remains tagged
  `yellow-order398-rollback:pre-order398` at
  `sha256:b826c789d413410db1f2bdbb67540feb15ba72d468a730760e77ec4c7da2f059`.
- Root and health return **200**. Root carries `Cache-Control: no-store` and contains
  the expected populated tenant, email and password fields without disclosing the
  protected password. A fresh login retained its token only in memory and returned
  **200**; property discovery returned **200** with exactly two properties.
- Fresh authenticated status for both properties returned **200** and exact recorded
  truth `latestBuiltOrder=396`, `currentOrder=397`, review coverage **91**, active
  phase **7**, phase count **18**, operational app/database and tenant context true.
  Owner-trust returned **200/200**. Business-day entry returned **200** for the
  configured main hotel and bounded **404 financials/not_found** for the intentionally
  fixture-free identity property, not the former authorization 403.
- Every one of the **18** management shell routes and all **5** operator assets
  returned **200**. Exactly one listener exists at `127.0.0.1:3000`; ports 3002,
  3123 and 3188 have none. The retained PostgreSQL container has no host port binding.
- Current total runtime memory was approximately **212 MiB** across the four healthy
  services. CPU was transiently low. Disk headroom is constrained (about 6.34 GiB on
  C: and 2.26 GiB on E:) but does not presently threaten this single recovered
  runtime; avoid duplicate images/data and monitor E: before future large builds.
- Exact parent/candidate `git diff --check` passed and the worktree had no tracked
  changes before this review record.

No recovery-scope violation, source/runtime mismatch, tenant ambiguity, credential
exposure, financial mutation or second UI local was found. This approval closes
Order 398 only. It does not claim a phase complete or authorize deployment, merge,
push, cleanup of rollback resources or any wider product change.
