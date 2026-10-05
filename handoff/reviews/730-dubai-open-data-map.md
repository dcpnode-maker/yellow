# Order730 independent source review

Reviewer: Codex agent `/root/app_next_slice727` (not the Order730 implementer).
Implementer: Codex agent `/root/antigravity_dubai728`.
Date: 2026-09-25.
Repository: `D:/Yellow/git-live-order611-source-v2`.
Authority: Order730 review-only scope, explicitly extended by root to this record.

## Verdict and boundary

Source-only approval: no blocking finding in the five frozen Order730 files.
Root's actual file-chooser import of the Order728 collection, 1,233-point/count
verification, category/search/detail interactions, and mobile fit remain
outstanding at the time of review. Synthetic tests do not replace those checks.
This record does not approve deployment or claim complete Dubai/OTA coverage,
calendar rates, or ecosystem completion.

The reviewer waited for the implementer's freeze, inspected the source, personally
executed the proofs below, and independently checked every frozen hash. No source
edits, DB writes, runtime deployment, map/service requests, or real-data uploads
were performed. No external collection or verification call was repeated.

## Inspected contract and findings

- OSM metadata, exact shape, byte/row limits, count relationships, exclusions,
  duplicate JSON keys, attribution, timestamps, and declared sample bounds fail
  closed when invalid.
- String IDs are preserved and namespaced by OSM type, preventing node/way/relation
  collisions. Source links are fixed HTTPS OpenStreetMap links for that identity.
- Coordinates are finite and within the declared rectangle; node-point versus
  mapped-area-centre semantics are checked. Commercial and exact-entrance claims
  must remain explicitly unknown.
- OSM and PriceLabs use a discriminated import type with separate validation and
  source-specific presentation. The existing PriceLabs validator remains intact;
  there is no dataset blending or invented rate/bedroom/review data.
- Source names are rendered as text, not HTML. UI copy states that provenance is
  not independently authenticated, the sample is not complete market coverage,
  records are not verified active OTA inventory, and area centres are not verified
  entrances. OpenStreetMap/ODbL attribution remains visible.
- Local import generation checks suppress stale completions after replacement,
  clear, or disposal. Rows remain in mounted memory; map layer payloads contain
  coordinates and composite IDs, not provider commercial fields.
- Search, categories, bounded pagination, selected details, and reused clustered
  layer lifecycle are covered by synthetic executable proofs.

No blocking issue was identified. Real browser behavior remains a separate gate.

## Personally executed proof

Commands ran in the repository above with Bun 1.3.14, invoked as
`C:\Users\astha\.bun\bin\bun.exe`.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order730-osm-map-import.test.ts tests/order730-osm-map-results.test.tsx tests/order723-market-map-import.test.ts tests/order723-market-map-layer.test.tsx tests/order699-street-map.test.ts
```

Result: **26 passed, 0 failed, 289 assertions**, five test files, exit 0.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' run typecheck
& 'C:\Users\astha\.bun\bin\bun.exe' run boundaries
git diff --check -- frontend/yellow/src/osm-market-import.ts frontend/yellow/src/market-listing-import.ts frontend/yellow/src/workspaces/StreetMapWorkspace.tsx tests/order730-osm-map-import.test.ts tests/order730-osm-map-results.test.tsx
```

Results: root and frontend TypeScript checks passed, exit 0; import boundaries
passed for **208 TypeScript files**, exit 0; scoped diff check produced no errors.
These are reviewer-executed results, not copied implementer output.

## Reviewed source freeze (SHA-256)

| File | SHA-256 |
| --- | --- |
| `frontend/yellow/src/osm-market-import.ts` | `c0393aecfaba8b1934166c12528382a85edae83667a743c4f5b01daba7eaa19a` |
| `frontend/yellow/src/market-listing-import.ts` | `1211c581acd792cf9289670240e14f6af78063bdb7de8f30a64125704faab507` |
| `frontend/yellow/src/workspaces/StreetMapWorkspace.tsx` | `5bfb20e5e3db83a1770741b33400fff9a78ed431086fe9a6c83f4cdfef45b4a6` |
| `tests/order730-osm-map-import.test.ts` | `ac2aa5115df4a77af0b2c97d734d55f64d9c7f96c9ae7a6345ad671c33baa5ec` |
| `tests/order730-osm-map-results.test.tsx` | `13431b439633633dae89ee3f6360298ae3a21e778516db58af3663c73a0e259d` |

These hashes were personally read with `Get-FileHash -Algorithm SHA256` and matched
the implementer's freeze. Changes after this snapshot need proportionate re-review.
