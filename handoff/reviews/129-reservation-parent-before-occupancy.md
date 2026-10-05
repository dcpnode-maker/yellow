# Order 129 independent Tier-3 review — reservation parent before occupancy

**Verdict:** APPROVED

**Reviewer:** Claude Sonnet 5, independent non-implementing reviewer

**Exact parent red:** `0c4c13fb8f2e451303ae868de2589904cecf91a4`

**Exact executable reviewed:** `9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90`

**Governance metadata read only:** `a31725899298677276445a442c7a50fd665e9306`

No implementation, migration, scope, security, or protected-file finding was found.
This approval is exact-SHA and exclusively establishes the Order-129 sequencing
prerequisite. It does not approve Order 126, close its Cyber finding, integrate a
canonical branch, deploy, or claim live status.

## Personally executed proof

- The reviewer created isolated detached worktrees and disposable Compose projects,
  left the live `yellow-founder-workbench` stack untouched, and removed all review
  resources afterward.
- P0 at the intentional-red SHA: focused guard proof passed 2/2 with 7 assertions.
  The test-only SQLSTATE `P0129` guard caught both real direct and held paths; the
  direct path left zero artifacts and the held path retained its active hold and
  original claim.
- P1–P3 at the executable SHA: focused sequencing/revalidation/rollback/concurrency
  proof passed 7/7 with 45 assertions; reservation commit passed 5/5 with 106;
  reservation HTTP commit passed 5/5 with 61; operator holds passed 7/7 with 48.
- P4: isolated cumulative matrix passed 19/19; migrations 17/17 with 95 assertions;
  deployment acceptance 6/6 with 13; standing tests 171 passed, 0 failed, 419 skipped,
  and 1,977 assertions; typecheck, 64-file boundaries, 23-package licence gate,
  schema drift, dependency audit, and protected hashes passed.
- Final pristine `./setup.sh --db-only`: 85 public tables and 11 passed, 0 failed.

The affected holds proof used a separately migrated, unseeded database because its
inherited review seed collides with the shared fixture database. A boundary test hit
the default five-second timeout on the Windows-mounted WSL filesystem, then passed
standalone and with a 30-second allowance. Both were classified as environment/test
isolation observations, not Order-129 defects.

## Source inspection

The reviewer confirmed that both direct and held commits create the authoritative
reservation and segment parents inside the command transaction before occupancy is
acquired. Inventory preparation is read-only; acquisition independently revalidates
authoritative state and does not trust the prepared value. `record_occupancy()` and
`release_occupancy()` remain the sole occupancy mutation choke points. Preparation
and acquisition identities and periods are compared, and any mismatch or later
failure rolls the complete transaction back. The held path retains fail-closed
concurrent-change handling and the direct path retains its advisory-lock,
exclusion-constraint, and bounded-retry behavior.

The executable delta matched the 13-file order scope. No migration, direct
`space_occupancy` DML, production guard, authorization bypass, or protected-file
change was present.

## Residual risks

Caller-supplied occupancy tenant binding (Order 126), runtime database authority
(Order 127), external rate-intent admission (Order 132), broad runtime DML authority
(Order 136), token-secret entropy, and all other sibling Cyber findings remain open.

## Conclusion

Order 129 is APPROVED only at executable SHA
`9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90`. Order 126 may now perform its own
current-line integration and must receive a separate independent Tier-3 review.
