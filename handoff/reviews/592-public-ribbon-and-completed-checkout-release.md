# Review 592 — public ribbon and completed-checkout release

**Reviewer:** `/root/order592_review` (independent; did not implement Orders 590,
591, or 592)  
**Date:** 2026-09-22  
**Verdict:** **APPROVED for the bounded Order 592 public release.**

## Independence and release identity

I read `PROJECT.md`, the Phase 0 build plan, Orders and Reviews 590/591, and
Order 592. The Unix `state.sh` launcher cannot run on this Windows host because no
`/bin/bash` exists; I ran the repository's read-only `state.ps1` equivalent. I did
not edit implementation, serving source, application configuration, public data,
or containers. My only repository write is this review record.

I personally hashed every promoted source/test file in the public serving source
`D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
All ten hashes exactly match their independently approved Order 590/591 freezes:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/ui/SegmentedRibbon.tsx` | `28fd36b2e8860b1367be34935aecb7a552e83ffc4daf1c67915845a364781551` |
| `frontend/yellow/src/workspaces/OperationalHub.tsx` | `7ae9670667ed9470bccb70dcac4f141d46e7b05e61eb57eb4c5edf75bae25cd9` |
| `frontend/yellow/src/workspaces/EcosystemHub.tsx` | `2839758312b45d7dfd3051f5deec095d2cef2c72c90d521b880ae5e03d544105` |
| `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx` | `c0071274ca8029e435ebb45ca2d2f12be595644707bcd772bc58b2d13ef1e503` |
| `frontend/yellow/src/styles.css` | `dc0f7e95aea033c079279855c28fba3a70f993f973fcafd44a11d4741416cca4` |
| `tests/yellow-shared-ribbon-depth.test.ts` | `92034bb802dc2a32cc1b1a73b83bb0b80eb4130657d4bf59a98db9c1cc21b0f0` |
| `frontend/yellow/src/voice.ts` | `6c0a76b818e32dc5c829d7978735a0469b72e7a0e612b839c0ba93665166fd47` |
| `frontend/yellow/src/App.tsx` | `c061c8900757bb3bd61247bf645d1c34ceda253fe2ad4a226a8f40bde1dd6056` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `cff36c5892447e0d20a6649411c94274a6ba986ae38db1ba7d0fbabcd88dc78d` |
| `tests/yellow-completed-checkout-retrieval.test.ts` | `27eca932b32b17fc81f98604386b09fce43085fb099c86c41ffc766f4a1392fb` |

The serving source's complete `public/yellow-next` asset set is byte-identical to
the asset set inside `yellow-public-demo-app-1`; all thirteen paths and SHA-256
hashes match. This binds the running app to the promoted build rather than merely
to a source-tree claim.

The live infrastructure identities are:

- app `dbe35dabd624` (the one service recreated by Order 592);
- PostgreSQL `9f507e09cc38`, unchanged;
- Valkey `781c68656c43`, unchanged;
- Cloudflare tunnel `e17219ecd7aa`, unchanged.

No provider, worker, PostgreSQL, Valkey, or tunnel container was recreated by this
release.

## Personally executed deterministic gates

From the exact public serving source I ran:

```text
bun test tests/yellow-shared-ribbon-depth.test.ts tests/yellow-completed-checkout-retrieval.test.ts
  10 pass, 0 fail, 46 assertions

bunx tsc -p frontend/yellow/tsconfig.json --noEmit
  exit 0

bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/order592-independent-build-review
  exit 0; 484 modules transformed

bun run boundaries
  Import boundaries OK: 203 TypeScript files scanned

bun run license-check
  Dependency license policy passed for 0 installed package(s)
```

I also ran `setup.ps1 -DbOnly` against a separate fresh
`yellow-order592-review` PostgreSQL/Valkey pair. All 98 migrations applied,
the fixture produced 129 public tables, and the referee finished
`11 passed, 0 failed of 11`. This did not contact or mutate the public database.

## Public ribbon/card proof

I exercised actual Chromium against `http://127.0.0.1:3010` at 240, 375, and
1440 CSS pixels for Today, Operations, and Ecosystem.

- Every document/body remained within the viewport.
- Each ribbon had exactly one selected tab and exactly two pointer-inert backing
  cards.
- Today retained its white selected pill and yellow selected edge.
- Operations and Ecosystem retained the approved neutral rail and white selected
  pill.
- At 240 px I focused the first shared-ribbon tab and pressed `ArrowRight`.
  Operations revealed the new selected tab fully inside the 196 px scroller
  (`scrollLeft=123`, selected `48.64–191.44` within `22–218`); Ecosystem likewise
  revealed it (`scrollLeft=174`, selected `50.30–192.64`).
- The only non-read requests were the existing synthetic
  `POST /api/v1/auth/demo:enter` requests. There were no failed requests or HTTP
  error responses. A generic favicon console line was the only console noise.

This confirms the exact narrow-keyboard defect rejected by the first Order 590
review remains repaired in the public build.

## Fresh completed-checkout proof

I opened separate fresh Chromium contexts at 375 and 1440 px. A route guard allowed
only `GET`, `HEAD`, `OPTIONS`, and the existing synthetic demo-entry POST; every
other non-read request would be recorded and aborted. In both contexts I entered
exactly `checkout Rohan Kapoor`.

| Width | Initial step | State | Authoritative room | Mutation controls | Bill |
|---:|---|---|---|---:|---|
| 375 | Release | Departed | Two Bedroom Residence 113 | 0 | Window 1 · Primary · SETTLED · SAR 0.00 |
| 1440 | Release | Departed | Two Bedroom Residence 113 | 0 | Window 1 · Primary · SETTLED · SAR 0.00 |

Both journeys displayed the completed-departure copy, had zero checkout checkboxes
and zero checkout/final-confirm buttons, remained viewport-contained, and produced
zero operational or financial writes, console errors, page errors, or HTTP error
responses.

## Health and data preservation

Local `/health` and the unchanged public tunnel `/health` both returned
`200 {"status":"ok"}`. The tunnel root and all five entry assets referenced by its
HTML returned 200 and the same hashed build names served locally.

Order 592's release-time ledger records an unchanged pre/post-deployment 129-table
aggregate of
`1ee0e346b5653e717c931bdba664aa043fe4b33d5dcd0cc3cac72518637365a1`.
For independent browser verification I took new `REPEATABLE READ READ ONLY`
fingerprints across every base table immediately before and after the guarded
public runs. Both independent snapshots were:

```text
tables=129
aggregate=c2a318356ae8197ac48b20f6d99e1d3f53c64221104c4fe4b30443d60df1a512
equal=true
```

The live aggregate had advanced from the release-time value before my guarded run
while the already-enabled live workers continued operating; it stayed byte-stable
through all ribbon and checkout proof and for an additional three-second check.
Therefore the release's recorded deployment window and my independent interaction
window both prove no Order 592 browser/deployment data mutation.

## Approval boundary

This approval covers only the exact Order 590/591 files promoted by Order 592, the
app-only recreation, and the public read-only behavior proved above. It does not
approve a schema, migration, seed, fixture, finance, occupancy, checkout-state,
provider, worker, disabled-capability activation, re-checkout, rollback, or wider
assistant-authority change.
