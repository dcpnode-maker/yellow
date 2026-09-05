# Independent Tier-3 review — Order 146 prerequisite integration

**Verdict:** APPROVED AFTER CORRECTION

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

**Recorded executable (invalid):** `483d4f18247058374fd427e1d49ef3cb0b3372d4`

**Actual composition commit:** `483d4f15375c2d5e963ad75d6b8daacd0971070b`

**Builder evidence head:** `8339dc6d1c0db486c6092661f8932873176d0f51`

**Admission:** `550fb9960195aa69ff48c22012e742b8c1942bec`

**Base:** `2faf5e8db8264af59e65effdfcb5603da628a181`

## Blocking finding

The full immutable executable SHA recorded twice in Order 146's builder evidence and
supplied for review is not a Git object in this repository:

```text
claimed  483d4f18247058374fd427e1d49ef3cb0b3372d4
actual   483d4f15375c2d5e963ad75d6b8daacd0971070b
```

The values share only the abbreviated prefix `483d4f1`. Exact commands against the
claimed value fail with `fatal: bad object` / `Not a valid commit name`; full Git object
and fsck checks find no such object. `git log`, `git rev-parse 483d4f1`, and the parent
chain resolve the actual composition above:

```text
550fb996 admission
  -> 483d4f15375c2d5e963ad75d6b8daacd0971070b composition
  -> 4c9542ff1a21b0a17fd39f2985f7cd8693197493 non-DB evidence
  -> 8339dc6d1c0db486c6092661f8932873176d0f51 builder evidence
```

The invalid full SHA occurs at exactly:

```text
handoff/orders/146-pre126-prerequisite-integration.md:117
handoff/orders/146-pre126-prerequisite-integration.md:153
```

Tier-3 review cannot silently substitute an unrecorded object for the immutable
executable named by the order. Correct both occurrences through a new auditable
metadata commit, identify the actual executable exactly, and return the corrected
evidence head for independent review.

## Bounded checks completed before stopping

The reviewer did not trust builder output and independently inspected the actual
composition only to bound the change request:

- Base → admission → actual composition → non-DB evidence → builder evidence ancestry
  is valid;
- Base-to-actual composition has exactly the registered 12 paths;
- all four product blobs and five source-governance blobs match their fixed owners;
- D-382 is absent, D-383 through D-387 occur exactly once, and D-383 through D-386
  match their approved source metadata byte-for-byte;
- no migration, Order-126, dependency/lock, runtime/status, protected referee/fixture,
  finance or other forbidden path appears;
- direct source-approval ancestry is not an acceptable substitute: Order 144 and
  Order 145 each carry only their own branch-specific product/governance set, while
  their decision/ledger histories require the explicit additive union and D-382
  exclusion performed by Order 146.

These bounded checks do not approve the unrecorded actual commit. Per coordinator
direction, database P3, matrix, migration, acceptance, schema and referee execution
were not started after the identity blocker. No `yellow_o146r_*` database was created;
the count remained zero. The shared PostgreSQL/Valkey stack was not started, stopped,
or reconfigured by this review.

No implementation or source-governance blob should change to fix this finding. No
D-388 approval is issued. Order 126 remains unapproved and no merge, push, deployment,
live or Cyber closure is implied.

## Re-review approval at corrected append-only head

Re-review resumed at `c3a0d5ed1e9accc42a07083b39ad1c43cc6e3224`. The invalid SHA
remains only in the historical finding above and its ledger row; active Order-146
evidence names real executable `483d4f15375c2d5e963ad75d6b8daacd0971070b`.
The two historical abbreviated ledger rows are byte-exact to `c2ab2a1`; correction is
one appended row. Repeated 12-path, nine-owner-blob, ancestry, D-382 exclusion,
D-383–D-387 uniqueness and forbidden-path checks have no finding.

Reviewer execution passed canonical-0013 and exact strict-0014 combined suites 16/16
(130 assertions) each; an in-memory unique-prefix matrix 19/19; acceptance 6/6 (13);
native-WSL migrations 17/17 (95); exact schema; pristine referee 11/11 (85 tables,
75 RLS); standing 174/422/0 (1,983); typecheck, 64 boundaries, 23 licences, audit and
protected hashes. The first WSL command used the wrong admin-variable name and stopped
before any test/database; the corrected command passed. All reviewer/migration
databases were removed and shared services retained. Order 126 remains separate and
unapproved; no merge, push, deployment, live or Cyber closure is implied.
