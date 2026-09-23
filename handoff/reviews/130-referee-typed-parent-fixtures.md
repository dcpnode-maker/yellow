# Order 130 independent Tier-3 review — referee typed-parent fixtures

**Verdict:** APPROVED

**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer

**Approved immutable base:** `972d0cfef0b7e4b8499065f70eea3226aeacb187`

**Exact parent red:** `52e295544dc67af172e1050cc8ea56f5cf6e7889`

**Exact executable reviewed:** `f7867cd7fa8aad0e38893575cad6158ba171d0a4`

**Builder metadata read only:** `2485882b358aaf6884fb294f5f8292ce81fa07d1`

No implementation, migration, scope, occupancy, tenant-isolation, protected-file, or
proof-strength finding was found. This approval is exact-SHA and exclusively approves
Order 130's fixture/referee prerequisite. It does not approve Order 126, close its
Cyber finding, integrate a canonical branch, merge, push, deploy, or claim live status.

## Lineage, scope, and protected provenance

- The reviewer confirmed exact ancestry
  `972d0cfe` → `52e29554` → `f7867cd7` → `2485882b`, with executable parent
  `f7867cd7^ = 52e29554` and builder-metadata parent `2485882b^ = f7867cd7`.
- The executable delta is limited to new
  `tests/referee-typed-parent-fixtures.integration.test.ts` plus changes to
  `tests/run_invariants.py` and `tests/seed_fixture.sql`, all explicitly authorized by
  Order 130. The builder metadata changes only its order, decisions, and ledger.
- The reviewer independently recomputed the pre-change referee hash as
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`, post-change
  referee as `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture as
  `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, and immutable
  baseline as `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.
- The machine-executed P3 allowlist and mutation checks passed. The header, imports,
  connection/check helpers, direct-DML denial, and every byte from the R6 marker
  through EOF remain parent-identical; race literals, winner assertions, periods,
  and workload sizes retain their exact strength.

## Personally executed P0-P3 proof

- P0 ran the byte-identical old referee on a freshly migrated/seeded database with the
  test-only strict typed-parent guard. It produced `8 passed, 3 failed of 11`: TC-12.1
  had zero winners, TC-12.3 had zero claims, and TC-12.5 had zero commits. TC-12.2's
  zero/zero noncoexistence check and TC-12.4's exact `42501` denial still passed. Direct
  inspection found zero segment claims, occupancy claims, or typed observations. The
  referee exited nonzero as preregistered.
- P1-P3 ran from exact executable `f7867cd7` on a separate freshly migrated/seeded
  database with the same guard. The focused suite passed 5/5 with 58 assertions,
  including the embedded referee's 11/11, all exact `P0003` wrong/missing-parent
  negatives, forced `23P01` losing rollback, bypass negative, provenance allowlist,
  and assertion-mutation negative.
- The embedded race outcomes were exactly one of 50 room-exclusive winners, no
  coexistence between the dorm private winner and six positional winners, exactly six
  of 40 dorm-capacity winners, exact TC-12.4 `42501`, and 162 valid commits in the
  eight-by-fifty positive-throughput workload.
- Because the committed suite's aggregate query necessarily runs after TC-12.2 cleanup,
  the reviewer added observation-only transactional database triggers in the disposable
  review database. They observed 169 active winners: one room, six capacity, and 162
  throughput. The one cleaned TC-12.2 mixed winner was exclusive, not positional, and
  at cleanup had exactly one total guest and exactly one matching same-tenant primary
  guest. There was no invalid cleaned winner, no active tenant mismatch, and no residual
  focused reservation, segment, guest, or occupancy artifact. Thus every committed
  winner had one exact authoritative parent/guest chain and every loser had none; this
  conclusion is direct executed evidence, not inference from post-cleanup aggregates.

## Personally executed P4 and repository gates

- The native-WSL isolated cumulative runner passed all 19/19 suites; unchanged
  Order-069 P8 passed in 5,419.90 ms.
- Migration integration passed 17/17 with 95 assertions in 57.65 seconds.
- Fresh deployment acceptance passed 6/6 with 13 assertions after applying migrations
  and the canonical production seed.
- Standing tests passed 172, failed 0, skipped 423, with 1,981 assertions. Typecheck,
  64-file import boundaries, frozen installed-tree licences, dependency audit with no
  vulnerabilities, exact schema drift, `state.sh`, `state.ps1`, `git diff --check`,
  and protected hashes all passed.
- A second worktree and independent Compose project ran pristine, app-never-started
  `./setup.sh --db-only`: 85 public tables and exactly 11 passed, 0 failed of 11.

The licence gate reported 24 installed packages rather than the builder's 23 because
the native-WSL dependency refresh installed the platform-specific optional TypeScript
package; the frozen licence policy still passed. Three initial invocations stopped
before product assertions because the Windows worktree Git pointer/Python launcher
needed WSL adapters, deployment acceptance had not yet received its required production
seed, and inherited Windows `node_modules` lacked a native-WSL TypeScript binary. Each
was restarted from its proper precondition without changing tracked source and is not
counted as product evidence.

## Source and invariant inspection

The fixture adds only the deterministic tenant-A guest and property-coherent,
unambiguous dorm private/positional mappings required by the referee. Tenant-B and RLS
fixtures remain unchanged. Every attempt resolves an active same-property mapping,
creates its reservation and matching segment in the same transaction before the sole
`record_occupancy()` call, and adds exactly one primary guest after acquisition but
before commit. A conflict or validation error rolls the whole transaction back.

The existing owner cleanup line and exact application-role direct-DML denial remain.
There is no production migration, trigger, function, grant, policy, application change,
owner/BYPASSRLS exception, caller flag, GUC escape hatch, or baseline edit.

## Isolation and cleanup

Review execution used only Compose projects `yellow-o130-review` on host ports
55430/63930/30930 and `yellow-o130-review-pristine` on 55431/63931/30931. The app was
never started. The reviewer removed only those projects, containers, volumes, networks,
and the exact temporary WSL launcher directory, then verified their labelled resource
sets were empty. The reviewer issued no Docker Desktop or global WSL stop command and
stopped or modified no unrelated stack. A final post-commit probe found the Docker
Desktop engine unavailable after cleanup; that later external state is not attributed
to an Order-130 cleanup command.

## Conclusion

Order 130 is APPROVED only at executable SHA
`f7867cd7fa8aad0e38893575cad6158ba171d0a4`. The Gate-3 manifest may now carry the
approved post-change referee hash, and Order 126 may rebase and resume. Order 126 must
still execute and receive its own independent Tier-3 approval; all sibling findings
and broader Cyber, merge, push, deployment, and live claims remain open.
