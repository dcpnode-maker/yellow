# Question 127 — Order 077 deployment-ledger scope

## BLOCKED — ARCHITECT NEEDED

**Order:** 077  
**Raised by:** OpenAI Codex builder  
**Production edits made:** completed Order 077 implementation and evidence are pushed at `aec2437`;
no correction to the failing acceptance oracle has been made

PR 58's first GitHub database job passed migration integration, seed integration and fresh database
creation. The deployment runner then correctly applied migrations 0001 through 0006, but the exact
fresh-deployment acceptance array still ended at migration 0005:

```text
expected: migrations 0001–0005
received: migrations 0001–0006
0006_rate_release_approval_lookup.sql
72a938e1a9d5c862d873ce987c0cdb36247008d8b5d4b76aeec1aeabf6aa1c11
3 pass, 1 fail, 9 assertions
```

Order 077 scoped the forward migration and schema mirror but omitted
`tests/database-acceptance.integration.test.ts`. May Scope gain only that file so the immutable
ledger expectation appends the exact version, filename and runner-observed checksum for migration
0006? No migration, database behavior, referee, other acceptance assertion or equality strength
would change.
