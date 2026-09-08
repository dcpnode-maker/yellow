# Independent review — Order RMS-20260908 market pipelines

**Reviewer:** `/root/market_import_reviewer`, non-implementing

**Review date:** 2026-09-08

**Order baseline:** reviewed remote main `3503b0c01f336637d2583963c17b792f6ad59efe`

**Review worktree HEAD:** `cb4803e68c8c7f018d1856c48d089a196f7647ef`

**Disposition:** **APPROVED for the bounded single-process market collection and POSIX private-staging scope.** This is focused source acceptance. The unavailable canonical database wrapper remains a release gate and is not approved by this review.

## Final reviewed source

| File | SHA-256 |
| --- | --- |
| `src/contexts/distribution/market-shopping.ts` | `7c93b4db386cee0e569eb6dfff3c2928b7a52b07fc0699f2e14cbdab24dcdc28` |
| `src/contexts/distribution/index.ts` | `556fbca77dee84a24202114c17cd1c16ee0556e298946a1dd8870ddaa30671d1` |
| `tests/market-shopping.test.ts` | `4599bf9839ac5a3c1413689e1f3f7851d4d472af6f20ac5ded853db4e3414b92` |
| `scripts/research/pricelabs-import.ts` | `da1087588de0e1fc4975f7e8dcbee09f65fab56d3a305db9b8b5f65a00b10fdb` |
| `tests/pricelabs-import.test.ts` | `e17291f20024beb9037880d7ed1d40724a5efb3897af9705c887ce04fec88f02` |

`src/contexts/distribution/index.ts` exports only the new market-shopping surface. The reviewed files add no migration, database access, dependency, operational writer, network client, credential path, provider activation, UI mutation or external service call.

## Reviewer-executed proof

The reviewer used Bun 1.3.14 from the order-provided pinned executable.

```text
bun test tests/market-shopping.test.ts tests/pricelabs-import.test.ts
27 pass, 0 fail, 138 assertions
  market shopping: 18 pass, 86 assertions
  PriceLabs import: 9 pass, 52 assertions

bun run typecheck
tsc --noEmit: pass

PATH=<pinned-bun-directory>:$PATH bun run boundaries
Import boundaries OK: 184 TypeScript files scanned

git diff --check
pass
```

The first boundary invocation used the pinned Bun executable without placing its directory on `PATH`. Its child script stopped with `bun: command not found` and exit 127. The corrected invocation above passed; the first environment failure is not counted as proof.

The initial full baseline-to-worktree diff check found four Markdown hard-break whitespace warnings in the review metadata above. Those trailing spaces were removed; the corrected full diff check passes.

An additional reviewer probe reproduced a cache-provenance defect before repair: a correctly keyed initial cache entry carrying an HTML route ID, an invalid method and an unsafe upstream string returned an actionable cache hit. Against the final hashes, the same probe returns `status: failed, cacheHit: false`. Permanent tests also prove context-key isolation, the cache fallback path and sanitized audited output.

## Market collection findings

All material findings found during review were repaired before the final proof:

- The comparison identity initially omitted the managed property, comparator property/listing, room product, point-of-sale market, permission scope and entitlement. These are now required exact key dimensions, and the permanent test varies every dimension independently.
- Concurrent `run()` calls initially received separate upstream request budgets. Overlapping calls now join one finite in-process budget window, while exact-context calls still share a single in-flight read.
- A timed-out adapter initially released its concurrency lease before an adapter that ignored abort had settled. Timed-out reads are now quarantined, retain their upstream lease until actual settlement, prevent same-upstream retry overlap and still permit an independent upstream to run.
- An aborted queued acquisition initially could return without a lease and then decrement the active count. Acquisition now reports whether it obtained a lease, removes its abort waiter and guards against underflow.
- Hard blocks and cooldown changes now wake queued contexts so they can fail closed instead of waiting indefinitely.
- Initial-cache provenance initially bypassed runtime validation. Admission and lookup now validate the exact context key, route ID, upstream and method before a cached value can satisfy or appear in collection output.
- The runner initially identified its timeout by matching `Error.message`. It now uses an identity-only sentinel; an adapter throwing `Error("adapter-timeout")` is classified as a network failure and does not forge quarantine.

Inspection and tests confirm that unavailable results remain source no-offer evidence rather than booked occupancy, stale/unknown/unzoned source prices remain retained but non-actionable, output carries `pricingAuthority: "comparison-only"`, cache capacity is bounded, and routes sharing an upstream also share block, cooldown, concurrency and budget state. Cadence boundaries use explicit property-local dates, including leap-year/month-end clamping. Cost quotes use bigint minor units and exact `ceil(cost * 100 / 70)` arithmetic with signed-int64 output bounds.

## Private archive proof

The reviewer ran the importer twice against the verified private archive into two fresh directories outside git. The count-only CLI result was identical on both runs:

```text
51 manifest-listed files verified
13,029,453 manifest-listed bytes verified
141 host listing records
2,508 platform/listing identities
2,992 market memberships
12 daily series
13,158 daily rows
```

The reviewer separately recomputed every listed file's byte length and SHA-256 from the source bytes and matched all 51 manifest entries. The manifest SHA-256 is `8c025be84c903a31b0132038cc0b91d858f67d399ec56f4efac7d45451a009cd`; the verified archive-index hash recorded by the receipt is `d3ca5a292437fde1973442586f83177283a3eff7574dc049d2d983ddcc3f9224`.

The two generated bundles were byte-identical:

| Output | Bytes | SHA-256 | POSIX mode |
| --- | ---: | --- | --- |
| `staging.json` | 14,746,782 | `3dcb0b7d8119db906beb22284a96f07145bade7d8cb746efd4c3d481771efca2` | `0600` |
| `preview.html` | 9,864,307 | `251e784feb25f7bc5d7d8a9833955ef7224a708bba45863141c286001a30f2d2` | `0600` |
| `receipt.json` | 582 | `f17f64215263f4875800b5556de76d6a4fde2a7d412d49ae806f6cdf3f97df8f` | `0600` |

The retained output directory has mode `0700`; its non-operational receipt is outside git at `../Yellow-PriceLabs-Staging-Reviewer-20260908/receipt.json`. No source host names, cities, listing identifiers or row values are reproduced in this review.

The archive CLI run used importer SHA `63ac5bf9fe3e32e41f9d447edc0b67e85a1e81b76f3920c34bed311b89872b30`. The only subsequent importer behavior change is the fail-before-effects native Windows guard now present in final SHA `da108758...`; the reviewer inspected that guard and reran the complete final synthetic, type and boundary proof. On this POSIX host it does not alter the generated bytes. The coordinator elected to retain the already byte-compared output rather than create a redundant third private bundle.

The reviewer additionally confirmed from the retained staging data, without publishing values, that all 252 field-dictionary entries have string `dataset`, `source_field`, `storage` and `note` fields; source CSV fields remain strings; host identity is the composite `(source PMS, source listing ID)`; market identity is `(platform, source listing ID)`; memberships remain separate by market view; and Yellow property mappings remain null/required. The preview contains one local script only, has no external script, fetch or XHR, and escapes embedded and rendered source data. The staging marks geography matching false, source update time/timezone unknown, archive completeness false, forward series as evidence rather than realised bookings, and source amounts as neither Yellow gross nor net.

The synthetic tests cover CRLF, BOM, quoted newline, comma and quote handling; empty, `0`, `NA`, `-NA` and IDs beyond JavaScript's safe integer range; malformed widths and quotes; duplicate headers and identities; count disagreement; tampering; traversal; duplicate manifest paths; symlinks; missing files; output overlap and refusal to overwrite; deterministic membership preservation; and HTML/script injection.

After byte comparison, the reviewer attempted exactly:

```text
rm -rf /workspace/scratch/9ee1a91ffb62/Yellow-PriceLabs-Staging-Reviewer-Compare-20260908
```

Automatic command review rejected it with `rm -f style commands are not permitted. Use a safer approach`. Per coordinator direction, the reviewer did not attempt a deletion bypass. That second private comparison directory remains intermediate scratch outside git.

## Explicit limits and pending integration

- Coordination, cache, concurrency, cooldown, quarantine and request budgets are in one `MarketShoppingRunner` process. There is no durable/shared multi-worker lease or time-window quota adapter.
- Context fields bind comparison identity but do not authenticate a caller or prove its permissions, entitlements, geography or room equivalence. Production callers still need verified identity and authorization.
- No live provider adapter, provider authentication, external connector, purchase, scheduling worker or pricing writer is present.
- The importer performs no operational Yellow write. Promotion still needs explicit tenant/property, physical-unit, geography, timezone, package/tax/commission/fee and duplicate mappings through existing governed commands.
- Private output writing is proven only on POSIX mode semantics. Final source fails with `unsupported_windows_acl` before archive/output filesystem work on native Windows. A tested NTFS ACL-bound writer remains future work.
- The canonical database wrapper was previously attempted in this isolated worktree and stopped at exact failure `Missing docker` before database effects. The reviewer did not obtain canonical database/referee proof, and this review does not satisfy that release gate.
- No claim is made for canonical database acceptance, a complete pipeline application, operational import, RMS integration, UI, publication, deployment, live pricing, historical demand, or Phase 14 completion.
