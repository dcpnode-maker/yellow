# Independent review — PROFILE-20260930 public property evidence

**Date:** 2026-09-30
**Reviewer:** `/root/yellow_design`, independent non-implementer
**Requested configuration:** GPT-6.1 / ultra, assigned by the coordinator. Runtime model identity is not independently tool-attested; the coordinator's model identity is not inferred.
**Basis:** `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`
**Branch:** `phase-7/property-profile-capture-20260930`
**Verdict:** APPROVED for the frozen, bounded public-evidence foundation below. Overall release gates remain open/RED. This does not approve an owned property profile, provider connection, complete named-cohort coverage, laptop integration, publication or deployment.

The reviewer changed no production source, tests, dependencies, configuration or assertions. This review record is the reviewer's only repository edit. A read-only child assisted with hostile source inspection; the reviewer personally reproduced the findings and executed final acceptance. Safe probe scripts and receipts live outside the delivery source.

## Scope and authority

Two new distribution helpers compose provider/account-namespaced observations into inspection-only drafts and parse bounded lodging JSON-LD from already captured HTML. The context index only exports these helpers. The new CLI reads an explicitly selected local capture file and creates an explicitly selected new output file; source content never supplies filesystem paths. No transport, media download, database, authentication route, schema, frontend, ownership assignment or authoritative property/inventory write is added.

Only explicit source aliases connect candidate identities. Name, address, geography and proximity do not merge them. Missing stable IDs use an ephemeral key containing exact final URL, capture hash and JSON-LD path and emit an ambiguity issue. This is not a physical-unit identifier or a Yellow owner/account grant. Multiple Airbnb accounts and co-host identities remain a separate connection/authority design; this draft creates none.

Current claims use capture chronology with deterministic ties and preserve history, provenance and conflicting claims. Six-digit UTC fractions are ordered without millisecond truncation. Source update time stays unknown unless a valid source `dateModified` supplies it. Amenity false/unknown/conflicting values remain distinct; supported mappings are narrow and unsupported labels remain evidence. Original advertised image URLs and observed dimensions are retained; media rights and scope remain unknown.

The parser admits only known compact lodging names under a trusted schema.org context or exact supported `https://schema.org/<KnownType>` identifiers under that context. Other contexts/types remain unsupported. Actual HTML parsing excludes comments, textarea contents and inert templates. Duplicate JSON object keys are rejected before last-key-wins parsing can erase ambiguity. The 2 MiB UTF-8 document, script/node/value/string/evidence and diagnostic limits bound work and output. These are deliberately bounded extraction semantics, not a general JSON-LD processor, external-context resolver or complete property scraper.

## Findings personally reproduced and repaired

Earlier source was not acceptable. The reviewer personally reproduced unsafe exported-composer URLs, an impossible February calendar date, capture getter execution, query-stripped provenance and fallback identity collisions, false script selection, hostile schema namespaces, input-order-dependent contradictory ties, missing case-normalized unknown-amenity conflicts and diagnostic amplification. A 50,061-byte nested-null capture produced 10,001 issues and roughly 759 KiB of output before the traversal/issue repair.

Further final inspection reproduced lodging extraction from an inert template and acceptance of an arbitrary schema.org path ending in `/Hotel`. Exact-type review also required rejecting userinfo, nondefault ports, query and fragment variants. The shared URL guard initially admitted embedded newline/tab/CR that the URL constructor silently removed while the receipt retained the original bytes. The builder repaired these findings in the authorized helpers and permanent regression files; the reviewer did not implement the repairs.

The final version snapshots descriptor-based plain JSON-like inputs before field reads or async hashing, rejects accessors/cycles without invoking own getters, applies the shared HTTPS guard at parser/composer/image/identity boundaries, validates actual calendar instants, preserves exact allowed source/final query and fragment bytes, binds unresolved fallback identities to capture content, uses a full observation tie key and one normalized amenity conflict key, and caps visited values and emitted issues. Final hostile proof includes the original reproduced cases and the later template/type/URL-control cases. No known material scoped finding remains on the frozen files.

## Personally executed acceptance

All commands used pinned Bun 1.3.14. No credential/private authority file or real guest/payment data was inspected. This pure foundation introduces no operational authority requiring a new tenant mutation proof.

The reviewer executed:

```text
PATH=/workspace/yellow-toolchain:$PATH bun test tests/property-profile-candidate-evidence.test.ts tests/property-profile-public-capture.test.ts tests/market-source-adapters.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-batch.test.ts
PATH=/workspace/yellow-toolchain:$PATH bun /workspace/yellow-coordination/profile-reviewer-hostile.ts
PATH=/workspace/yellow-toolchain:$PATH bun run typecheck
PATH=/workspace/yellow-toolchain:$PATH bun run boundaries
PATH=/workspace/yellow-toolchain:$PATH bun scripts/research/property-profile-capture.ts --input /workspace/yellow-coordination/profile-real-data/official-captures.json --output /workspace/yellow-coordination/profile-real-data/profile-reviewer-draft-v2.json
```

| Final proof | Actual result |
| --- | --- |
| New pure tests plus existing adapter, shopping and batch regressions | 74 passed, 0 failed, 380 assertions across six files |
| Independent hostile probe script | 32 passed, 0 failed |
| Typecheck | Exit 0 |
| Import boundaries | Exit 0; 207 TypeScript files, no violations |
| Actual offline CLI on official captured pages | Exit 0; incomplete, 2 captures, 1 observation, 1 draft |
| Same CLI targeting the existing reviewer output | Expected exit 1, `invalid_output_path`; existing output hash unchanged |

The independent hostile probes cover URL scheme/credentials/images/control characters, calendar validity, zero getter calls, asynchronous snapshot mutation, false/inert HTML, trusted-context/untrusted-type combinations, exact unsupported schema IRIs, escaped duplicate keys, supported siblings after templates, exact URL preservation, query/content-sensitive fallback identities, reversed contradictory observations, normalized Gym/GYM conflicts, microsecond chronology, bounded deep primitive arrays and ordinary/trailing-dot short-link hosts.

Safe final receipts are in `/workspace/yellow-coordination/`:

```text
profile-reviewer-final-focused.log
profile-reviewer-final-hostile.log
profile-reviewer-final-types.log
profile-reviewer-final-boundaries.log
profile-reviewer-final-cli.log
profile-reviewer-cli-no-overwrite.log
```

## Actual public-data proof and limits

The coordinator fetched the two official public documents; the reviewer independently processed their supplied literal HTML through the actual CLI. The reviewer did not claim to have performed the fetch. Both receipts retain HTTP 200 and exact equal source/final URLs.

| Official source | Capture instant | Actual extraction |
| --- | --- | --- |
| `https://hotelaketadehradun.com/` | `2026-09-30T20:05:05.130025Z` | 47,375 UTF-8 bytes; one lodging observation, eight amenity claims, three advertised images; unresolved Google short link reported |
| `https://www.headingleystadiumhotel.co.uk/` | `2026-09-30T20:05:05.773232Z` | 24,706 UTF-8 bytes; zero lodging observations; `no-lodging-node` reported |

Aketa selects the observed name `Hotel Aketa Dehradun` and address `113/1-2, Rajpur Road, Dehradun, Uttarakhand, 248001, IN`. Source update time, image dimensions and rights remain unknown. The returned draft is correctly incomplete. Headingley is not fabricated into a property profile. The input does not contain bnbme or Locanda lodging documents, so this execution does not establish those STR cohorts, a full UK cohort, OTA coverage or operational tenant onboarding.

```text
89844b6e8b71ab2048b86b49731cedeb6ec1dfd286d6f1e2b1b55cb3462b87c2  official-captures.json
9c5cf09d45a3ff22446ebec4fa0751145c7624bd7947ab8561efcc5c443656cc  profile-reviewer-draft-v2.json
ef5fa4176c751865fdee738f624361f692ce0af11c397714e889e4ebc300a749  Aketa literal HTML
d436ac5638de3c89c87d5ed017ba9d5571175d5e1e70da8a7b50833fa86e5857  Headingley literal HTML
```

## Coordinator evidence and remaining release work

The coordinator executed unchanged canonical `./setup.sh --db-only` in its owned disposable proof infrastructure. The reviewer inspected `/workspace/yellow-coordination/profile-setup-db-only.log`: exit 0, 11 passed, 0 failed of 11, with disposable proof database removal. This is coordinator-executed evidence, not a reviewer rerun. Setup/schema/dependency scripts were not weakened by this order.

The inherited license gate rejects `tslib@2.8.1` declaring `0BSD`. The basis also carries the previously observed RED required reservation-offer regression, now diagnosed as a separate physical-sellable contract defect with a separate repair/review lane. The old fixture-only explanation is superseded by that source diagnosis; historical receipts remain observations, not a new GREEN release assertion. This profile order changes neither gate. No full standing-suite pass or release approval is claimed.

Public capture remains untrusted candidate evidence. Authoritative profile mapping/publication, connected-account access, owner/operator delegation, occupancy deduplication and tenant/property authorization need separately scoped commands and executable authority proof. The dirty laptop's current source is not represented by this isolated basis and requires exact local reconciliation. Preserved CRS artifacts remain separate. No CompSet, push, PR, merge or deployment action occurred.

## Frozen personally verified source

These hashes matched the final executed proof. Production/test changes require fresh relevant proof and review.

```text
be1872dfa9d233f12179422ed4addb858e62a0cfb056ef5587046b8ce0812061  src/contexts/distribution/property-profile-candidate-evidence.ts
cddcdf6425df903a719cb7127039428cf4b3c2e20d58609093d226aaf3c1d4b9  src/contexts/distribution/property-profile-public-capture.ts
7d8809c3e91afb825fed9664ab32730e4c8e5065303317f97e3215d2b6408cf8  scripts/research/property-profile-capture.ts
42354e8797c7eed49d169b186415a5dbcd3c7fb1a0e46768c98561dc70e6f623  src/contexts/distribution/index.ts
da11329bca060bb09e1afaccfca25c3068ce145be40a38b8b982a12c0f641994  tests/property-profile-candidate-evidence.test.ts
c1fc35e8d2c31fad1c603b6bff76f0e1fd58376a7be014ecbe683812a56e34dc  tests/property-profile-public-capture.test.ts
4ee8d437ce625bc07962e916a937d0c5d0e8e08e27028c7461eab66736eeceb9  docs/CONTRACTS.md
```

Only the exact dated order/review and permitted append-only contract/decision/ledger records accompany these files. A tracked unstaged whitespace check has passed but does not cover untracked new records. Complete basis-to-staged scope/whitespace verification remains required after the coordinator stages all eleven allowlisted files; its separate receipt will be appended to this review.

## Complete staged-scope checkpoint

After the coordinator staged all final files, the reviewer personally verified the exact eleven-file allowlist against basis `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`. It contains the two helpers, context exports, CLI, two tests, contract, dated order/review, DECISIONS and LEDGER. There were no unstaged tracked changes before this checkpoint. DECISIONS, LEDGER and CONTRACTS retain their complete basis bytes as prefixes and append only; the new governance accurately limits public proof to Aketa/Headingley and preserves incomplete coverage and separate release/laptop work.

The reviewer personally executed `git diff --cached --check 40eb866a7f51645ee3de84806dbd1a8e17ca8a56` and `git diff --check 40eb866a7f51645ee3de84806dbd1a8e17ca8a56`: each exited 0 without diagnostics. These complete comparisons include the new records, unlike the earlier unstaged tracked-only check. All seven frozen source/test/contract hashes above match both current working files and staged bytes and the final executed proof.

This checkpoint adds only review evidence. The reviewer will make no further repository edits; the coordinator must restage this review and repeat complete whitespace/scope checks before its isolated local commit.
