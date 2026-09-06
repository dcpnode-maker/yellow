# Order440 / Question206 — independent provider and receipt review

## Private lossless decoder — bounded approval2026-09-06

**Builder:** native_resume_builder. **Independent reviewer:** root Codex, who
implemented neither the module nor its tests. Exact scope is only the two new
private files admitted in Question206; the full provider/receipt outcome is not
implemented or approved by this entry.

The builder recorded intentional missing-module red before implementation. Root
read both complete files and personally ran:

```text
bun test tests/fiscal-exact-json.test.ts
initial candidate:11 passed,0 failed,122 assertions,364ms
final candidate:12 passed,0 failed,130 assertions,385ms
bun run typecheck
passed
bun run boundaries
passed:178 TypeScript files
```

Independent adversarial execution nevertheless found a blocking raw/escaped
surrogate flaw in the initial candidate. A raw high surrogate plus an escaped
low surrogate, or the reverse, had malformed UTF-16 source but decoded into a
valid astral character. Both returned success; TextEncoder would replace the raw
half, so the purported original bytes and interpreted identity disagreed.
Root sent both exact constructions to the builder without implementing a fix.

The builder added four permanent value/member-name cases first, reported11 pass/
1 fail, then added raw-source validation before UTF-8 encoding/tree allocation.
Root personally inspected that delta and reran the complete final12-case suite.
Raw source and decoded strings are now separately validated, while the cheap
character-length bound precedes scanning. The previously demonstrated two attacks
also independently reject with invalid_json. Error results never reflect source.

Root additionally executed10,000 deterministic differential cases in a separate
`bun -e` process. PRNG seed90607, recurrence
`seed=(Math.imul(seed,1664525)+1013904223)>>>0`, maximum generated depth5:
null/boolean/safe-integer/string/array/object trees, multilingual and combining
Unicode, controls and __proto__/constructor-shaped keys. Projection of every
successful tree equals JSON.parse of the same JSON.stringify-produced source;
every node/container is frozen and every member map has null prototype.
Number conversion occurs only in this independent safe-integer test oracle,
never the production decoder. All10,000 cases pass; unsafe numbers/changed-cent
collisions/negative zero/huge exponents are covered lexically in permanent tests.

Inspection confirms direct-index number scanning, exact original lexemes, decoded
duplicate-name rejection and no package/network/database/global runtime export.
Permanent tests execute minus/exact/plus bounds for1MiB UTF-8,32 containers and
100,000 value nodes. These are bounded Yellow policies, not claimed provider
limits or a production latency benchmark.

Final SHA256, personally rechecked after execution:

- src/contexts/tax-fiscal/fiscal-exact-json.ts:
  `f6e59232b97171de8270f6cd96a2ca1c2a16ee467f444ddb07983f29f59f1516`
- tests/fiscal-exact-json.test.ts:
  `878cfd19b720776b5ffc3f5939eab79463e990128e56802919dbcc6329c9f01e`

**Accepted only as a private decoder dependency.** Complete standing/current-source
CI remain required before its integration. This does not verify signatures,
provider endpoints/credentials, authenticated transport, persistent artifacts,
authorized receipt reads, invoice printing, sandbox acceptance or Phase7 completion.
Q204's separate exacte439 CI is unaffected; no applied SQL, old scanner, provider,
database, local app or dependency changed during this review.

### Complete decoder standing proof

Root personally awaited the same live session80238 through terminal exit0.
`bun test` with no database environment and no competing local DB proof records
1686 pass,1264 explicit DB/Unix skips,0 fail,22423 assertions across505 files,
101.23s. Log:D:\Yellow\temp\q206-standing-20260906-exact-json.log.
This closes the decoder's local full-standing condition, not exact-source CI or
the full receipt/provider outcome. Later status edits and the separately admitted
JWS builder require their own completed proof; they are not included in this run.

## Private pinned RS256 verifier — independent findings (acceptance pending)

Builder:native_resume_builder. Reviewer:root, who changes neither implementation
nor test files. Root reads the complete module/test and personally executes the
initial13-case suite (13 pass,0 fail,131 assertions). The verifier returns only
signature evidence and explicitly denies that this establishes fiscal acceptance.
The existing decoder is consumed privately; no context export or provider is enabled.

Two independent executable findings prevent accepting that initial green result:

1. WebCrypto accepts canonical RSA SPKI DER followed by four unrelated bytes.
   Root's actual generated-key probe returns a successful factory for this alias.
   The same key can therefore get different recorded fingerprints and evade a
   raw-byte duplicate check. Builder adds permanent trailing-DER/same-key-alias
   regressions and a built-in node:crypto public-key parse/export byte comparison,
   before non-extractable WebCrypto import. No custom ASN.1 parser or cryptography
   is introduced. Root later requires direct reexecution, not the builder result.
2. Bun1.3.14 WebCrypto reports a byte-rounded modulus length. Root constructs
   synthetic RSA JWK public moduli with exact bit lengths and converts them using
   built-in node:crypto. Actual2041/2047 bits are correctly reported by KeyObject,
   but WebCrypto reports2048 and the candidate incorrectly accepts them. Actual
   2049 reports2056 in WebCrypto. Enforce true KeyObject bit length and exponent,
   preserve fixed SHA256/RSASSA verification, and use ceiling bytes only for signature
   width. These are key-boundary probes, not proof of valid synthetic private keys.

Root also tries genuine key generation requesting2049 bits; Bun generates2048.
No genuine non-byte-aligned signing proof is claimed from that request. The builder
removes its similarly misleading test and retains mathematically correct ceiling
width. Exact key-boundary tests and final independent suite execution remain required.

### Final private-verifier acceptance — 2026-09-07

Root personally re-reads the repaired source and executes both previously blocking
probes after the builder freezes it. Generated RSA SPKI with four trailing bytes
is now rejected. Independently constructed public JWK moduli at actual
2041/2047/2048/2049/4096/4097 bits produce exactly the required reject/reject/
accept/accept/accept/reject results. KeyObject's actual bit length, RSA type and
65537 exponent are checked before WebCrypto import; signature length uses ceiling
bytes, not a claim that byte-rounded WebCrypto bits are authoritative.

The same independent in-memory probe generates a genuine2048-bit key and signs
the original compact bytes. A changed-cent payload fails; exact unsafe decimal
lexemes survive; the1999ms/2000ms exclusive upper boundary behaves correctly.
Proxy, revoked Proxy, null-prototype object, function and Symbol inputs produce
bounded failures without invoking getters. All36 independent assertions pass.
These public modulus boundary probes do not claim real non-byte-aligned signatures.

Root personally executes:

```text
bun test tests/fiscal-exact-json.test.ts tests/fiscal-signed-jws.test.ts tests/import-boundaries.test.ts
32 passed,0 failed,301 assertions,3.64s
bun run typecheck
passed
bun run boundaries
179 TypeScript files passed
bun run license-check
23 installed packages passed
git diff --check
passed
bun test
1699 passed,1264 explicit DB/Unix skips,0 failed,22568 assertions
2963 tests across506 files,97.05s; terminal session92728 exit0
```

Full-suite log: D:\Yellow\temp\q206-standing-20260907-jws-final.log.
No competing database proof or implementation edits ran during this full suite.
SHA256 personally confirmed before/after the focused final execution:

- src/contexts/tax-fiscal/fiscal-signed-jws.ts:
  `844072dfc67d2663d4ba1e3aa794ba8edd322621c41f3d4a794867fa73ede27b`
- tests/fiscal-signed-jws.test.ts:
  `ae744cbf50c5de39432fd02f29bce96906e429521f4728735c3fc79903b6f16f`

The separate fiscal_http_acceptance reviewer inspects root's current status
reconciliation against its own PR88/post-merge evidence and finds no mismatch.
It personally executes only the two requested current-management/founder-status
files:7 passed,2 explicit database skips,0 failures,155 assertions. That bounded
status review does not independently review this JWS implementation.

**Approve the two private JWS files and prior decoder for development publication.**
Root is independent of their implementation/tests. Exact-source complete CI and
normal non-author integration remain required. This is signature-only evidence:
issuer/source binding, authenticated provider transport, persistent artifacts,
property-authorized GET, operator printing and authentic sandbox remain unfinished.
No SQL, global roles, provider registration, dependency or stable local changed.
