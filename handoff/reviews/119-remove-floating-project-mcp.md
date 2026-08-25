# Independent review — Order 119 remove floating project MCP launchers

**Verdict:** APPROVED  
**Risk tier:** 2  
**Reviewer:** independent non-implementing OpenAI Codex security reviewer  
**Implementation reviewed:** `7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`  
**Required red commit:** `5c147b27c9eb07414a653607d47cff9dc243221e`  
**Order:** `handoff/orders/119-remove-floating-project-mcp.md`

This approval is exact-SHA and exclusive to
`supply-chain.unpinned-project-mcp` (`occ_f2201362eef2a3df87abf1b3`). It
approves absence and static fail-closed configuration behavior only. It does not
claim that Postgres, GitHub, Context7, Playwright or any replacement MCP was
started, connected or functionally accepted, and it does not approve a later
commit, merge, deployment or sibling Cyber finding.

## Findings

No finding remains at the corrected implementation SHA.

The first review rejected `014afb0667dc3e6a5bb83ff9b4bff8b44c07cd1a`
because its hand-written TOML validator accepted a duplicate `[mcp_servers]`
table and an illegal NUL control character, its red diagnostics omitted the
package/tag/credential markers, and its exact-base diff check was not clean.
The correction at `7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`
closes each item:

- prohibited TOML control characters are detected before comment removal;
- duplicate and unknown tables, unknown keys, keys outside the sole allowed
  table, malformed entries and any non-empty server configuration fail closed;
- parent diagnostics name all three package specifications, preserve
  `@upstash/context7-mcp@latest`, and print only the credential key
  `GITHUB_PERSONAL_ACCESS_TOKEN=[redacted]` rather than a credential value;
- permanent focused tests retain the duplicate/control and parent-snapshot
  regressions; and
- the complete exact-base diff now passes `git diff --check`.

The production configuration remains the removal implemented at `014afb0`:
`.mcp.json` parses to exactly `{ mcpServers: {} }` and
`.codex/config.toml` parses to exactly `{ mcp_servers: {} }`. The corrected
commit changes only the scoped validator and permitted governance evidence; it
does not reintroduce a command, package, URL, environment value, dependency or
runtime launcher.

`docs/TOOLING.md` and `docs/CODEX.md` honestly document the functional tradeoff:
local `psql`/repository scripts replace the removed Postgres launcher, `git`/`gh`
replace the GitHub launcher, built-in documentation tools replace Context7, and
future MCP tooling requires a separate reviewed provenance order. The floating
Playwright example is absent. No replacement-integration claim is made.

## Reviewer-executed evidence

The reviewer used detached worktrees for the original and corrected reviews.
No MCP was installed, resolved or started, `GITHUB_TOKEN` was not used, and the
live `yellow` Compose project was not touched.

### Exact parent and focused correction

The original detached parent run at
`5c147b27c9eb07414a653607d47cff9dc243221e` personally produced the required
real-config red:

```text
bun test tests/project-mcp-config.test.ts
```

Result: `0 pass, 1 fail`. The error named the three real JSON server entries and
the TOML launcher/args/environment locations. The corrected validator was then
executed against `git show 5c147b2:.mcp.json` and
`git show 5c147b2:.codex/config.toml`; its sanitized diagnostics explicitly
contained:

```text
@modelcontextprotocol/server-postgres
@modelcontextprotocol/server-github
@upstash/context7-mcp@latest
GITHUB_PERSONAL_ACCESS_TOKEN=[redacted]
```

It did not print the database DSN or `${GITHUB_TOKEN}` value reference.

At exact corrected SHA:

```text
bun test tests/project-mcp-config.test.ts
```

Result: `3 pass, 0 fail, 7 assertions`. This covers the real empty configs,
duplicate/control regression and sanitized parent snapshot diagnostics.

### Independent hostile validator challenge

A disposable reviewer harness executed the exact validator functions without
editing the product test. It accepted only the valid mirrored empty pair and
rejected all sixteen negative cases:

- malformed and unknown-key JSON;
- `npx`, `npm`, `bunx`, shell URL and bare-package launchers;
- `@latest`, another dist-tag and a semver range;
- credential-bearing environment configuration;
- unknown TOML table, unknown key, duplicate table and malformed entry; and
- a NUL control character occurring after a TOML comment marker.

The prior failing cases now report respectively
`duplicate TOML section [mcp_servers]` and
`prohibited control character U+0000`. Unknown tables and keys also fail
independently, including an otherwise empty `[other]` table and `foo=1` under
`[mcp_servers]`.

Bun's real JSON and TOML parsers independently confirmed that the committed
configuration files are valid and semantically equal empty-server declarations.
A bounded search over `.mcp.json`, `.codex/config.toml`, `docs/TOOLING.md` and
`docs/CODEX.md` found no active/floating launcher, removed package name,
`@latest`, Playwright MCP, or credential launcher residue.

### Scope and standing gates

```text
git diff --check fb7571b58cf13021bd8777f1e1d32b443aa9527a..7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1
bun test
bun run typecheck
bun run boundaries
```

Results: diff check clean; `166 pass, 395 skip, 0 fail, 1,924 assertions`;
TypeScript clean; import boundaries clean with `64 TypeScript files scanned`.

The exact-base range is restricted to the order-authorized configs, tooling
documentation, one focused validator test, and the allowed order/ledger/decision
records. The correction relative to rejected `014afb0` changes only the focused
test and permitted governance files.

The detached Windows junction is not accepted as licence evidence. The reviewer
SHA-256-compared `package.json`, `bun.lock` and `scripts/license-check.ts` between
the exact corrected checkout and the installed root tree; all three were
byte-identical. The unchanged checker over the installed tree and a fresh exact
lockfile audit produced:

```text
Dependency license policy passed for 23 installed package(s).
No vulnerabilities found
```

### Reused broad proof after exact input-identity verification

The same reviewer previously executed the mandatory isolated database proof for
the removal implementation before rejecting its validator. That run used unique
Compose project `yellow-review119-0824`, applied migrations `0001`–`0011`, retained
85 public tables and produced canonical referee
`11 passed, 0 failed of 11`; exact schema matched
`tests/schema/expected.sql`. All disposable containers, network and volume were
removed.

Before relying on that personally executed proof for the correction, the reviewer
ran an exact `git diff --quiet 014afb0..7ba93e4` over `migrations/`,
`tests/schema/`, `scripts/schema-drift.ts`, both setup scripts, Compose,
`tests/run_invariants.py`, `package.json`, `bun.lock` and the licence checker.
It returned zero: none of the database, schema, dependency or referee inputs
changed. The corrected metadata also records a fresh builder run of the same
eleven-migration, 85-table, 11/11 gate; that builder output is not substituted for
the reviewer's earlier identical-input execution.

Protected SHA-256 values remain exact:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

## Reviewer precondition corrections

The first disposable parent-diagnostic harness invocation ran `git show` from a
different working directory and encountered Git's safe-directory protection; its
empty stdout consequently produced no marker evidence. It was discarded. The
rerun supplied the exact detached checkout through a scoped `safe.directory`
argument, returned the real parent blobs, and produced every sanitized marker
listed above. No product file changed.

## Residual Cyber findings — twelve remain open

This approval closes only `supply-chain.unpinned-project-mcp`. Orders 108, 116
and 117 previously closed only their named temporary-schema, repository-known-JWT
and local-login findings. The twelve remaining sealed siblings are:

1. `database.caller-controlled-rls-tenant` — high — `occ_48ef46aabb565be569c6e79d`
2. `database-grants.runtime-role-direct-dml` — medium — `occ_f0526a0906f1b0b5a72edf0c`
3. `database.occupancy-caller-tenant` — high — `occ_2f4ca8c2e6f1d7352ba849c8`
4. `database.public-destructive-maintenance` — high — `occ_0c5b4cfc4934049849c99d8f`
5. `database.runtime-bootstrap-superuser` — high — `occ_235bd4dcea3d48cd3f611759`
6. `actorless-api-idempotency` — low — `occ_2160f7211ebce346c54b759e`
7. `unbounded-external-rate-intent-requests` — medium — `occ_227ec2963a84e30663d4d7db`
8. `regular-expression.unbounded-extension-schema` — low — `occ_623ba52de928bfe323127e66`
9. `supply-chain.mutable-container-tags` — low — `occ_b05bc911e6d4fb6de7b6382e`
10. `broken-property-authorization.party-search` — low — `occ_ba3b2f7be81a2793ac34384a`
11. `authorization.party-duplicate-oracle` — low — `occ_a18c087af2ee0041e610dc85`
12. `privacy.reservation-notes-durable-events` — low — `occ_0f9a3b20577c0bf2f247d392`

## Conclusion

Order 119 is **APPROVED** at exact SHA
`7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`. No implementation, commit, push,
merge, integration, deployment or MCP runtime action was taken.
