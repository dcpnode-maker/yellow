# Order 379 — fresh independent review

**Verdict:** APPROVED

**Candidate:** `a84c5b0bbde32b713bbc89eb7dd68d769c36ecc1`

**Reviewer:** `/root/order379_fresh_reviewer`, fresh non-implementing reviewer

**Date:** 2026-09-03

## Exact scope inspection

The exact diff from withheld Order375 governance
`0124f7367fce092c73a5cc17bb0287fd2b380fea` changes only the three authorized
catalogue literals in `tests/app-role-nonlogin.integration.test.ts` from
`89/79/79` to authoritative `116/106/106` for public tables, RLS-enabled relations
and policies. All other delta is the new Order379 record and append-only
decisions/ledger governance. There is no source, migration, schema, permission,
dependency, other-test, UI, status or local-runtime product delta.

## Reviewer-personal executable proof

On a fresh Windows-native PostgreSQL 17.2 disposable database, the reviewer:

- provisioned the exact deployment, owner, runtime and registrar authority boundary;
- applied migrations 1–64 successfully;
- queried the live catalogue as exactly `64/116/106/106/15/2` for migrations,
  public base tables, RLS relations, policies, FORCE-RLS relations and views;
- ran the complete `tests/app-role-nonlogin.integration.test.ts` suite;
- observed **5 passed, 0 failed, 25 assertions**.

The proof exercises direct-login rejection even after a password is installed, exact
role attributes and membership, zero direct sessions, the migration-12 checksum,
unrelated-principal denial, tenant A/B isolation with transaction-local role/context
reset, and atomic membership/direct-session precondition rollback and retry. The
repaired exact catalogue oracle therefore reflects live migration-64 truth without
weakening the underlying containment proof.

## Disclosed setup retry

The first fresh cluster was initialized with PostgreSQL's default `postgres` owner;
migration 15 correctly rejected that noncanonical deployment authority after
migrations 1–14. No test result from that cluster was accepted. It was stopped and
removed. The counted proof used a second fresh cluster initialized with the exact
`yellow_deploy` database-owning administrator and provisioned the remaining authority
roles before applying migrations 1–64.

## Teardown and boundary

The PostgreSQL server stopped cleanly, port 56833 refused connections, the exact
disposable root `E:\yellow\order379-review-20260903-r2` was removed and verified
absent, and no `C:\Users\astha\AppData\Local\Temp\wsl-crashes` directory was
generated. The protected `.yellow/` path remained untracked and untouched. No
application, local, Docker, deployment, merge or Order375 approval action was taken.
Order379 alone is approved and closed; Order375 still requires its separate fresh
full restart from item 1.
