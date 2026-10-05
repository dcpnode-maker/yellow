# Review 605 — public Overwatch departure candidate release

## R1 — local target ACCEPTED for tunnel start, 2026-09-22

Independent non-implementing reviewer: Codex `/root/order593_http_proof`.
The reviewer edited no product, migration, order or ledger file; ran no public seed,
fixture, DDL/DML, service proposal/confirmation, provider request or rollback; and
kept the public tunnel stopped. This disposition accepts the already-migrated local
target so the release owner may start the existing tunnel. It is not the final
public-origin closure required by Order605 step 11.

### Frozen candidate gates

The authoritative candidate was
`D:\Yellow\temp\order593-departure-coordination-source`. Personal execution
produced:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DbOnly
=> exit 0; migrations 1-99; 130 tables; 11 passed, 0 failed of 11

bun run typecheck
=> exit 0

bun run boundaries
=> exit 0; 203 TypeScript files

bun test
=> 2389 pass, 1557 skip, 0 fail, 44065 expectations, 644 files
```

The clean full-suite command was bound to the parent Git metadata by `GIT_DIR` and
`GIT_WORK_TREE`. Before that final run, two resource-sensitive tests failed once and
then passed 14/0 focused; an initial unbound invocation exposed the known non-Git
fixture behavior. Neither is hidden or counted as the authoritative result.
Order581's current migration98 was separately accepted in Review581 R3 after actual
authority/replay/Unicode and same/shared-authority concurrency proof. Focused
Order599 HTTP tests passed 34/0 and prove that the legacy
`POST /api/v1/jarvis:ask` delegates to the one Overwatch implementation, rejects
privacy-invalid input, maps service unavailability to Overwatch, and leaves
`/api/v1/overwatch:ask` unmounted.

The candidate and immutable release source each contained 2,391 reviewed files
(excluding `.git`, `.yellow`, `node_modules` and logs). Sorted relative-path/SHA-256
manifests were byte-identical with aggregate
`f123bc74e23c66aee6606c12f538ba057fbe8acd847babe064f845871062b852`
and zero differences. The compatibility route's `src/app.ts` hash is
`0c66a08a4d900bc077a97ca6af1b97766da570fb5251bd09fe29be87add81901`;
the operator bundle hash is
`a5203c0ef4247db9770d7c80a729f38da0170912fe827d1adb37b52f3ebec589`.
Both match candidate, release source and the running container. No competing
Overwatch POST route exists.

### Actual target, migration and preservation

The personally inspected application container is
`361b651c9f428656ead6bf8c6c96b2d7e24095fa80188f35cccac5f9f09d1aa7`,
healthy on loopback port 3010, from image
`sha256:73d6423ec4a347d720ca882446786ae34bfe956de42c7cf5dc16f1af5acc85a8`.
Its immutable source label points to
`D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`
and its revision is the exact 40-hex release identity
`344ab3485bf4a9da3d27ffca4cabbce75c36151b`.

The original PostgreSQL container
`9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`
and Valkey container
`781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`
remain healthy and retain their original volumes. PostgreSQL is 16.15. A
repeatable-read/read-only transaction verified ledger count/min/max 99/1/99 and
the exact frozen checksums:

- migration98 `dc8472faebbd05c4ebd3baf34d6582e3a7bd9f370be0d1bc8afc66284db69e2`;
- migration99 `115bd87ee7c247f8ed3ccdf2f870860d7da96217e232dae577ff09cc477e51e4`.

The catalogue has 130 public base tables, 120 RLS-enabled tables, 29 forced-RLS
tables, 120 policies and two security-invoker views. `departure_service_request` is
forced-RLS, has its policy, remains empty, and is SELECT-only for `app_role`.
The three departure capabilities are `yellow_owner`-owned SECURITY DEFINER
functions with fixed search paths and only the intended owner/app-role execution
grant. Property-identity capabilities retained the corresponding accepted shape.

The pre-migration 129-table fingerprint had aggregate
`2af37d091b40f5bec2cd5d1c69b9b78760a5133b55a24d443b9d21f25f12bff6`.
The post-migration/pre-review 130-table fingerprint is
`80c34915dbd08c889bb430a0e381b9d02c57ebc9cf195b4bc8b857979b876bed`.
Across the transition, only the migration-owned `permission` and
`schema_migration` rows changed and the new empty departure table appeared; all
other pre-existing table multisets matched. After all guarded browser checks, the
reviewer recomputed all 130 table count/row hashes inside a repeatable-read,
read-only transaction: 130/130 matched the post-migration snapshot, with zero
differences and zero departure requests. No public fixture has been applied.

### Backup and rollback evidence

`D:\Yellow\runtime\backups\order605-pre-migration.dump` is a readable PostgreSQL
custom archive (2,446,285 bytes), SHA-256
`9f8588f6bc3889648893ef758c01639000b8f7b02c286e43fae503a5c44f8b95`.
It preserves owners but was created without ACL entries. It is therefore not
sufficient by itself for an exact pre-migration privilege restoration; this is an
explicit residual limitation, not concealed rollback proof.

The later full owner-and-ACL checkpoint
`D:\Yellow\runtime\backups\order606-full-postmigration-prefixture.dump` is readable
by PostgreSQL 16.15, is 2,694,728 bytes, and has SHA-256
`aacc49585ba70ada6dd2f7ba1110b8677502bf6243b5bdf5d810b3ff3d023378`.
Its listing contains 2,123 TOC entries, owners and 609 ACL entries, including the
Order98/99 objects. It is the exact-restoration checkpoint for the accepted current
state. No restore was attempted. The immutable app rollback tag
`yellow-public-demo-app:pre-order605` resolves to old image
`sha256:1bfdcb55a74e83b3e84e09c6907a27df0985fe2599ecb89708a5994769710d6e`
at revision `41415cc5c6953f71d9b3baada6fd9c7853567128`.

### Loopback HTTP and guarded Chromium

Loopback `/health`, `/ready` and `/` returned 200. Readiness is no-store, names the
runtime database, reports migration frontier 99 and exact revision `344ab348...`.
The served root and every referenced CSS/JS asset matched both immutable release
source and container bytes. Principal asset hashes were:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| index JS | 196568 | 0b28ee84f53eda989267e340c9d3254e44483ecd85275b72b1ab2b0da57a5a3f |
| runtime JS | 716 | 580ad8c58061a4dde99bde0a56905e382f0568516ee2f5b84dbfb52085709021 |
| React JS | 218840 | b19a9fcdb691b2158d837ef44b93412f755c06ec395363af87850a92252826b4 |
| vendor JS | 163303 | 0eb9c401f77add137025d435b85a4a9a367b05ddfed7cab756af9e03cae972c3 |
| CSS | 128857 | 3805310492bbcb81b6f1fe50be4cf1b2b5211fd72d5dfd8300eefef3ef666bbb |

BrowserAct was unavailable because this host has no configured BrowserAct API key
or browser. The reviewer used installed Chromium with a strict request guard that
permitted only GET/HEAD/OPTIONS and automatic demo-login POST; every other mutating
request was aborted. All owned temporary profiles/processes were cleaned.

- Root at 240, 375 and 1440 CSS pixels rendered meaningful content, glass and tab
  depth, compact ribbon/navigation and zero horizontal overflow. There were no page
  errors or warnings.
- The classic gallery opened after JS readiness and exposed exactly eight named
  interfaces: Ledger, Aura, Relay, Journey, Orbit, Atlas, Focus and Index.
- The ecosystem surface rendered `Today & Overwatch`, its preview, a seven-tab
  segmented ribbon and depth cards without overflow.
- Yellow AI mode opened with English (India) prompt text; listening was false,
  speech synthesis was inactive, and no speech started without consent.
- The real completed reservation `L3R-HX-0126` rendered Sara Al Harbi as checked
  out/departed recorded history with no write. This is completed-checkout read-only
  retrieval, not a new checkout or operational confirmation.
- Guard accounting saw only three automatic demo-login POSTs plus reads; no other
  POST and no blocked attempted mutation. Direct GETs to both ask paths correctly
  returned 404 because the sole compatibility transport is POST; its executable
  behavior is bound by the accepted Order599 test and the deployed source hashes
  above.

The first gallery probe clicked before frontend readiness and timed out at that
assertion; the bounded corrected probe waited for the eight options and passed.
This was a reviewer timing error, not a product failure. No write occurred.

### Scope boundary and disposition

Live departure proposal/confirmation and queue progression were intentionally not
performed because Order605 forbids creating or confirming a public request. Their
route, authorization, idempotency, minimization and state-machine behavior is bound
to the frozen candidate's executable Order593/604 tests; fixture-dependent visual
population belongs to Order606. This review does not infer a public operational
write from source tests.

The tunnel container
`e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`
remained exited throughout review. **LOCAL TARGET ACCEPTED FOR TUNNEL START.** The
release owner may start only that existing tunnel and proceed to Order605 step 11.
Final Order605 closure still requires independent designated-public-origin health,
root/asset byte equality, guarded public Chromium at the required widths and a
post-public-check 130-table fingerprint. Until that evidence is appended, this is
not a claim that the external origin is released or that Order605 is fully closed.

## R2 — designated public origin ACCEPTED, 2026-09-23

Independent non-implementing reviewer: Codex `/root/order593_http_proof`.

The reviewer personally executed Order605 step11 against the designated origin
`https://offset-kinds-authentication-thirty.trycloudflare.com`. No product, image,
container, database or fixture was changed; the running application/database were
not restarted. Browser guards admitted only GET/HEAD/OPTIONS plus the existing
automatic `POST /api/v1/auth/demo:enter`; no operational write was attempted.

### Exact retained identity and public HTTP bytes

Read-only `docker inspect`, source/container hashing and HTTP checks proved:

```text
app container 361b651c9f428656ead6bf8c6c96b2d7e24095fa80188f35cccac5f9f09d1aa7
=> running, healthy
image => sha256:73d6423ec4a347d720ca882446786ae34bfe956de42c7cf5dc16f1af5acc85a8
revision => 344ab3485bf4a9da3d27ffca4cabbce75c36151b
source => D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source
source/container src/app.ts
=> 0c66a08a4d900bc077a97ca6af1b97766da570fb5251bd09fe29be87add81901

public GET /health => 200 {"status":"ok"}
public HEAD /health => 200
public GET /ready => 200, no-store, frontier99, exact revision344ab348...
public HEAD /ready => 200
public GET / => 200, no-store
public HEAD / => 200
```

Direct OPTIONS requests to `/health`, `/ready` and `/` returned the same bounded
404 route response; OPTIONS was permitted by the browser guard and caused no write.
The UI is same-origin and does not require an OPTIONS handler, so this is recorded
as route behavior rather than treated as false CORS proof.

The 672-byte public root was byte-identical to loopback with SHA-256
`a15070e6dd8b990d4f6cd065c9fb3640fcb003288f67809917dc17aa8acf6d47`.
All five referenced assets returned GET200/HEAD200 and matched loopback bytes:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `index-C6E69cm-.css` | 128857 | `3805310492bbcb81b6f1fe50be4cf1b2b5211fd72d5dfd8300eefef3ef666bbb` |
| `index-CXKPNmrE.js` | 196568 | `0b28ee84f53eda989267e340c9d3254e44483ecd85275b72b1ab2b0da57a5a3f` |
| `react-runtime-CR5VJ85Q.js` | 218840 | `b19a9fcdb691b2158d837ef44b93412f755c06ec395363af87850a92252826b4` |
| `rolldown-runtime-hePW80VL.js` | 716 | `580ad8c58061a4dde99bde0a56905e382f0568516ee2f5b84dbfb52085709021` |
| `vendor-CNqRKreC.js` | 163303 | `0eb9c401f77add137025d435b85a4a9a367b05ddfed7cab756af9e03cae972c3` |

The retained tunnel
`e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`
was running from its unchanged image
`sha256:b269e8abd07a5bf6f3f4be65d5050b2174eca89c56a0241a8ff32a16aec454e4`.

### Guarded public Chromium

The reviewer ran the existing private proof exactly:

```text
node .git\order605-public-browser-proof.mjs \
  https://offset-kinds-authentication-thirty.trycloudflare.com
=> exit0; every assertion passed; 121 requests; 7 automatic demo-login POSTs;
   0 blocked write attempts; 0 console/page problems
```

At240,375 and1440 CSS pixels the real public page returned200, rendered meaningful
Yellow content and glass/ribbon depth, and had exact width-to-scroll-width equality.
The ecosystem rendered `Today & Overwatch`, exactly seven tabs and68 capability
cards. A second strict guarded pass bound the previously broad card assertion to
exactly68 and counted51 disabled `Not operational` previews.

Yellow AI opened with the exact `Ask Yellow in English (India)…` placeholder,
listening false and speech synthesis inactive. Its neon field contained zero images,
had `background-image:none`, and rendered procedurally through the measured neon
inset shadows plus `blur(2px) saturate(2.15)`.

The completed reservation route rendered exact guest **Sara Al Harbi**, confirmation
`L3R-HX-0126`, `checked out` and departed history, with zero checkout action. The
Operations workspace rendered Service0. Its authenticated read-only queue returned
HTTP200, zero requests, and exactly six visible staff identities: Avery Housekeeping
plus Synthetic Assistant Manager, Duty Manager, Front Desk Cashier, Housekeeping
Desk and Housekeeping Team Lead. The strict supplemental pass admitted four automatic
demo-login POSTs and otherwise only reads; it also saw zero blocked attempted writes.

### Accepted Order606 state and no-write postflight

Before browser execution, a single repeatable-read/read-only transaction fingerprinted
all130 public base tables. Separate read-only assertions matched the accepted
post-Order606 fixture: frontier99; exact five roles and permission arrays; five active
`departure-*@yellow.local` users in one property scope; five synthetic staff parties;
`app_user=7`, `party=657`, `party_role=657`, `role=7`, `role_permission=163` and
`user_role=18`; departure requests0, payments0 and documents0.

The post-browser transaction repeated the same canonical per-table count/row digest
algorithm. Both complete ordered snapshots produced SHA-256
`a9f9b1326d0733e0bb3a10b03d6c1c30875e74b6db2454c9a0b7c24ef0694488`.
All130 table digests matched exactly. In particular, reservations654,
space occupancy232, journals2 and posting lines4 were unchanged, and departure
requests/payments/documents remained0. This proves the public browsing and automatic
demo-session entry caused no database mutation.

### Final disposition

**ACCEPTED AND CLOSED.** The designated public origin serves the exact independently
accepted Order605 image/source/assets, passes the required mobile/desktop guarded UI
proof, exposes the scoped Order606 role-visible queue without an operational request,
and leaves the full130-table database fingerprint exact. Order605 is a public release
of this bounded reviewed capability set, not a whole-PMS completion or authority for
departure confirmation, checkout, finance, provider or destructive database action.
