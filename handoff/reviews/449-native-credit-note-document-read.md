# Order449 — Independent complete-credit document retrieval proof

**Status:** independent scoped proofs and combined standing pass; published
0b1ff327 on draftPR92. All six CI jobs pass in34202983111.
Order451's publication record retains all prior failures and the separate index
preservation audit. No UI, local promotion or Phase7 completion.
**Reviewer/executor:** root Codex coordinator, not implementer of the service,
command, route or actual database test. Backend and HTTP were disjoint agent lanes.

## Source review and focused execution

Root reviewed every scoped service/command/export/HTTP/test change, including the
materialized current-authority CTE on both present and absent IDs, tenant-scoped
document lookup, raw stored content and hash, existing lossless CRN validator,
receipt/lineage/total binding, exact bigint amounts and sanitized errors. No new
table, migration, event, posting, provider, dependency or UI implementation.

Root identified insufficient document-specific native cases in the first HTTP
draft. The HTTP implementer added concurrent reads, tenant/property/noncredit
concealment and revoked-authority checks within the same two synthetic cohorts,
and consolidated a duplicated pure content fixture. Root read the final test body.

Personally executed:
`bun test tests/india-native-fiscal-credit-note.test.ts tests/india-irp-issued-wire-candidate.test.ts tests/operator-fiscal-credit-note.integration.test.ts`

**50 passed,0 failed,3 explicit database skips,650 assertions,1.55s.** Those skips
are not the separate actual database execution below. Frozen working source SHA256:

| Path | SHA256 |
| --- | --- |
| src/contexts/tax-fiscal/india-native-fiscal-credit-note.ts | dea55d4f96b34f582c6932612374cae41265f89c48d580c2640b7f72f832fb70 |
| src/commands/issue-india-native-fiscal-credit-note.ts | 1aa47f5ec76aa2aa5c38e75bc1b69f0e8350550ef8260edc10fde65fa9a22a5d |
| src/contexts/tax-fiscal/index.ts | 9eef13724193a7579c0b97cac71826c1ab9b5da2e2905c64d27ad036e4c042b5 |
| src/http/operator.ts | f534d23a823d56e4e4b111418fdca9caf144965a0f9f1444dcf80bf445a57923 |
| src/app.ts | 2c2d13c6fec8ef952f54b386ed904a2edc38eb7e356d8ca1044d63a2372da14d |
| tests/india-native-fiscal-credit-note.test.ts | e3e459cb676efefb23ee52ddc599ed146dc1314c39376b5d2d6cfaeb62f2fe06 |
| tests/operator-fiscal-credit-note.integration.test.ts | 0a73e266f12c94f77bed6053c12491f63dbfe19a5de379d53c51f5118f199dc8 |

Mixed app/operator working files also retain paused UI edits; publication must
select only the Order449 delta. The native preflight pins the whole runtime src
tree, both nested fixtures, seed/UUID helper, dependency/config files and retained
proof helpers, not only the seven changed paths.

## Q233 independent native execution — 2026-09-08

Root fully read native-proof.ts SHA256
d7ab1c12aa0e8815c5c0afe36a913f849930276e81d3120a52baa69d218d5287 and
native-run.ps1 SHA256
54137ebda713934c6137ed10e533da938c1f85a564831d309fc42055eb259589.
Only inspected AST-selected credential/host helpers run; no legacy startup mode.

Root ran readonly Preflight and inspected snapshot
20260908-045722-336-285eab53-preflight.json, SHA256
a4b8d0738f8b9cf0963b6677b99e9c05069ba8e82749fc545e824e1d8d03c8f6.
Canonical snapshot ee35062228047f656400e54ec2c62a2d5d061f67324f451ff5134cabbc814120
matches the previously accepted Q229 target:1,574 rows,5 tenants,21 permissions,
canonical88/129tables/119RLS/119policies/28FORCE/2views; zero sessions.

Root separately ran `native-run.ps1 -Mode Execute -ExecuteAfterHandoff` with
that exact snapshot path/hash. The one actual signed-session test passes
**1 passed,0 failed,48 assertions,10.81s**. Fourteen other cases were filtered,
not executed. Log20260908-045940-609-c37f27fa-actual-signed-session.log SHA256
845da41601cff88f312b5c2ed0a47db672c6e3c20c94df4100a4124743bc273f.

Genuine native issuance supplies immutable content. The API returns its exact
stored contentJson string and validated receipt; twelve concurrent reads preserve
those values, not necessarily request-specific HTTP metadata. Foreign tenant,
missing ID and original invoice ID are concealed;
wrong property and revoked actor fail. Direct caller-transaction existing and
missing reads also deny revoked authority. Complete original accounting and
fiscal-submission graphs remain unchanged by every read/denial cohort.

Full containment PASSES, not just the test process: all1,574 previous row hashes
survive within1,773 final rows. Exactly two fresh fixture tenants own all199 new
rows and the six complete ROOM/CGST/SGST transaction definitions. Each tenant has
one exact INR property/account triplet; scalar references total6 routes,4 tax
semantic routes,18 postings and2 valuation sources, with0 package/payment refs.
Every other global dictionary, catalogue, migration ledger, function/ACL/config,
companion/template database and outside role/settings state is unchanged.

After receipt SHA25613deb86e4a9c13504a7916b52036d42dad972acf3fae2ae6879358b761824727;
canonical after7af73c81c30436be115aa8f4afcf058896ccffe887f62a6190741fa64ecc0327;
before receipt3ba163aea2c7a3cf8f958045e57f11f3bd2349603e313c3d5206b28e78bae54b.
No test retry, cleanup or migration. Existing PostgreSQL postmaster15956 and
live app7568/9508 remain exact; port3001 stays absent. Protected credentials never
enter source/output. Q234 governs the remaining exact backend-only release checks.

## Retained failed standing and subsequent repair

Q234 initial standing:1,929 passed,1,407 explicit skips,two failures,34,517
assertions; existing geometry and invoice browser deadlines failed. Receipt
53d8a7457566e869153864ac0508a0cc11bfae5e8dad7b2c5b399b4aaea734ed.
Q235 unchanged standing:1,929 passed,1,407 skips,two failures,34,515 assertions;
native project-status and long-stay pricing deadlines failed. Receipt
45e46479b671f36aa7ac128664ece884a3ed69869879b3ff5a5944b4a8e5da3f.
Q237 isolated standing:1,944 passed,1,421 skips,two failures,36,259 assertions;
geometry and pricing deadlines failed. Full log
c25dc8c640e4ebd2f065ce020ced5fcc2ae330aba35806ca6f2fbd4489d17fbb.
Isolation registers imported tests separately, so counts are not interchangeable.

No passing standing receipt was produced for the isolated run. Its post-run guard
also caught an accidental literal patch suffix in CONTRACTS; root restored exact
bytes and all2,081 tracked working hashes as recorded inQ238. A second malformed
literal patch suffix in this review was removed before candidate preparation;
the underlying native evidence and original private patch file were preserved.
Placeholder claims and mislabeled Q235/Q237 prose from that suffix are not proof.

Q238 holds the original seven-file f2ada candidate UNPUBLISHED and activates scoped
450/451 continuation. Root independently passed450 native listing and451 actual
old/new parity/performance plus intentional provenance-bypass RED checks.
Q239 repairs only the existing browser harness lifecycle, not UI design. Exact
combined standing/source CI remain pending; focused passes do not replace them.
