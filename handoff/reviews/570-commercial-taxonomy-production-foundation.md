# Order570 — independent review R1

Date:2026-09-21. Reviewer: OpenAI Codex independent Astra agent `/root/astra_review`, not the implementer.

## Verdict: CHANGES REQUIRED

Read PROJECT.md, Order570, relevant Orders/Reviews564/567 and the mandatory Yellow compliance/entity/PostgreSQL skills; ran canonical state ritual. Inspected only the scoped implementation in the designated D: serving source. No implementation edit, database connection, migration, financial/occupancy write, KPI/API/UI change or public/deployment operation was performed.

### Exact inspected candidate

Runtime root `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

| File | SHA256 |
| --- | --- |
| src/contexts/reporting/commercial-attribution.ts | 5A6285342E6EF12F12E9C59BE7B2C1EB92530196AAC7AC0D0E926904AE92B068 |
| src/contexts/reporting/index.ts | 8AB9FF4AF67F9D43B6594F421F81536B6E5E85BD66648FA2A5AF0B73642D9D22 |
| tests/commercial-attribution.test.ts | 92D8324C0A9789FBB5602F8A573716E540A2831491B953B70D3E273FF0870041 |

### Executed checks

- `bun test tests/commercial-attribution.test.ts`: **6 passed,0 failed,20 assertions**.
- `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution Bundler --types bun --skipLibCheck src/contexts/reporting/commercial-attribution.ts tests/commercial-attribution.test.ts`: exit0, no diagnostics.
- `bun run boundaries`: **Import boundaries OK:202 TypeScript files scanned**. Initial guessed script name `check:boundaries` did not exist; corrected to the declared package script, not an implementation failure.
- `bun D:/Yellow/temp/astra570-hostility.ts`: personally executed additional parser/resolver hostility plus a recording Tx fake; evidence retained in `D:/Yellow/temp/astra570-hostility-results.json`. This executes the real exported pure functions and records actual query bindings, but is not a real PostgreSQL/RLS integration test.

### Blocking findings

1. **Explicit unknown evidence is promoted to successful attribution.** Resolver's `bySource ?? byChannel` masks a supplied but unknown source. With configured WEB→WEBSITE and BOOKING→BOOKING_COM, `{sourceCode:'EXPEDIA',channelCode:'BOOKING_COM'}` resolves source BOOKING/reason null. `{sourceCode:'WEB',channelCode:'UNKNOWN'}` returns WEB plus channel UNKNOWN/reason null; even unknown channel alone is returned as a successful channel leaf. Likewise a syntactically valid but unconfigured unit UUID returns `product.unitTypeId` with reason null although its roomClass is Unmapped. These paths contradict requirements4/5's unknown-input fail-closed/Unmapped contract and can manufacture apparently valid dimensions. Resolve only configured mappings; when both distribution identifiers are explicitly supplied, require consistency without silently discarding an unknown one. Preserve raw evidence separately if needed, not as a success-shaped CommercialLeaf. Add permanent tests for each case, including malformed/nonempty versus missing input (currently malformed market `bad/value` is incorrectly reported MISSING_INPUT).

2. **Structurally contradictory configuration is silently stripped.** A segment nested under CORP with explicit `parentCode:'OTA'` is accepted because `node()` extracts only code/label; unsupported hierarchy fields are ignored. The same mechanism can silently ignore extra segment children rather than rejecting a third hierarchy level. Requirement4 promises structurally invalid mappings fail closed. Validate allowed object keys/shape at each level (or an equivalently explicit schema contract) so conflicting parent/hierarchy input is rejected, not silently reinterpreted. The current known-parent market-mapping and company-cycle checks do not cover this path.

3. **The stable sentinel namespace is not reserved.** Parser accepts a configured segment `code:'UNMAPPED'` and mapping to it. This can produce code UNMAPPED with arbitrary configured label/reason null, colliding with the promised stable Unmapped leaf in code-based downstream grouping. Reserve the sentinel across configured dimension codes/mappings, or explicitly model a non-colliding tagged identity before any consumer. Add a regression proving configured content cannot masquerade as the missing/unmapped identity.

### What passed

- Normalized duplicate segments across MSGs, duplicate sources across groups, duplicate channels across sources, duplicate Party and unit-type mappings all reject.
- Unknown company parent, company cycles and market→unknown-segment references reject.
- Embedded control characters, >120 UTF-8-byte labels and malformed configured UUIDs reject.
- Two configured but conflicting source/channel mappings reject.
- Missing input consistently returns stable missing-input leaves; unknown market/company/room-class mappings use NO_MAPPING. The success-shaped raw channel/unit leaves and masked source are the exceptions above.
- Parser returns frozen structures and keeps demand hierarchy separate from distribution, company and product. It adds no financial metric or inferred guest/GST relationship.
- Recording Tx proof captures exact tenant UUID and `property:<property UUID>` bind values; SQL includes explicit tenant equality plus current tenant setting, type commercial_attribution, property key, active status, `effective @> transaction_timestamp()`, ordered versions and LIMIT2. Zero and two rows reject; malformed scope invokes SQL zero times. The loader assumes the caller supplied a correctly transaction-local tenant Tx; it does not itself establish that context. No actual RLS/permission/canonical-extension registration proof is claimed here.
- Scoped module has only a type import from kernel, pure parsing/resolution and one SELECT. No DML, financial/occupancy function, outbox, stats_daily, KPI projection, HTTP/API or deployment path was introduced in these files. Existing extension activation/version authority remains a later governed prerequisite, not authorized by this loader.

**CHANGES REQUIRED** for the three bounded fail-closed issues before treating this as production-safe classification authority. Preserve this R1 evidence; remediate within scope and request a fresh independent review. No acceptance ledger entry or runtime copy is made while rejected.

---

## R2 — independent corrected-byte review, 2026-09-21 — CHANGES REQUIRED

Reviewer `/root/astra_review` personally inspected and executed the corrected source, without implementation edits or DB/public actions. R1 evidence remains intact.

Frozen hashes:

- commercial-attribution.ts: `25A20A0B6774131871369BEE1148553560B637B52DBF2A97D15C137779B88432`.
- index.ts unchanged: `8AB9FF4AF67F9D43B6594F421F81536B6E5E85BD66648FA2A5AF0B73642D9D22`.
- focused test: `1A656CC224F2EE637020DC337694FB5CC57D612C60F29A29F229C92D7DE70950`.

Executed from the D: runtime source:

- `bun test tests/commercial-attribution.test.ts`: **7 passed,0 failed,26 assertions**.
- Same explicit scoped strict/noUncheckedIndexedAccess TypeScript command as R1: exit0.
- `bun run boundaries`: **202 files,OK**.
- `bun D:/Yellow/temp/astra570-r2-hostility.ts`: reran R1 cases plus malformed raw source/channel, non-string source,513-element top-level/nested arrays and hidden third-level hierarchy. Results retained in `D:/Yellow/temp/astra570-r2-hostility-results.json`; original R1 artifacts were not overwritten.

### Closed findings

Unknown syntactically valid source+known channel and the inverse now reject. Unknown channel/unit UUID returns UNMAPPED/NO_MAPPING. Reserved UNMAPPED and hidden segment parentCode/children reject. Duplicate normalized segments/sources/channels across groups, duplicate company/unit mappings, cyclic/unknown company parents, unknown market targets, malformed configured UUIDs, control characters, excessive UTF-8 labels and513-element collections reject. Loader zero/overlap still reject; recorded tenant/property/type/active/effective bindings remain exact and malformed scope reaches SQL zero times.

### Remaining blocker — malformed is still treated as absent

`normalizedInput()` collapses malformed nonempty or non-string values to null. The source/channel resolver then skips the new unknown-evidence guards and falls back to the other dimension:

- `{sourceCode:'bad/source',channelCode:'BOOKING_COM'}` returns mapped BOOKING/reason null, silently discarding the supplied invalid source.
- `{sourceCode:'WEB',channelCode:'bad/channel'}` returns mapped WEB and channel UNMAPPED/**MISSING_INPUT**, despite a supplied invalid channel.
- Runtime `{sourceCode:123,channelCode:'BOOKING_COM'}` likewise maps BOOKING. The two malformed-string cases are already legal TypeScript string inputs, so this is not merely an `any` caller issue.
- Malformed market `'bad/value'` also remains mislabeled MISSING_INPUT.

Distinguish absent/blank from supplied-invalid before normalization/fallback. Reject invalid raw evidence or return an explicit non-success Unmapped result without inferring the paired source; never classify it as absent. Add permanent regressions for both distribution directions and malformed market/raw types. This is the outstanding R1 malformed-input subcase, not a new financial/schema requirement.

**R2 CHANGES REQUIRED.** All other reproduced R1 blockers are closed; one fail-open normalization path remains. No acceptance or D: review copy yet. No DB/RLS integration, migration, public consumer, KPI or deployment authority is claimed.

---

## R3 — independent final review, 2026-09-21 — ACCEPT

Reviewer: `/root/astra_review`, independent of implementation. R1 and R2 rejection evidence above is preserved. Personally inspected and executed the corrected current source; no implementation edits, DB connection, public operation or deployment occurred.

Final SHA-256, rechecked after proof:

- `src/contexts/reporting/commercial-attribution.ts`: `5708A5DB3650B88BEB9FDF52917957CDB5F2C22DA6334655C273043943CA5E62`.
- `src/contexts/reporting/index.ts`: `8AB9FF4AF67F9D43B6594F421F81536B6E5E85BD66648FA2A5AF0B73642D9D22`.
- `tests/commercial-attribution.test.ts`: `6C9EC0417EDAEF18BFA659AE78B84B60131B3809D540CF0DCB3EBA4533424849`.

Personally executed from `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

1. `bun test tests/commercial-attribution.test.ts` — **7 passed, 0 failed, 30 assertions**.
2. `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution Bundler --types bun --skipLibCheck src/contexts/reporting/commercial-attribution.ts tests/commercial-attribution.test.ts` — exit 0, no diagnostics.
3. `bun run boundaries` — **Import boundaries OK, 202 TypeScript files scanned**.
4. `bun D:/Yellow/temp/astra570-r3-hostility.ts` — exit 0; personally inspected retained actual outputs in `D:/Yellow/temp/astra570-r3-hostility-results.json` against the expected outcomes below. This is a reviewer-owned executable probe, not a claim that authored coverage alone proves the hostile cases.

Probe SHA-256: `BF3ED2778527C476262C4CCB1E3E8CD5A691AADEE80F68242E530BCAA8ABD63A`; result SHA-256: `85B65F87F78352CC2FBEC4B6EC5E9360DBD6234768AAFB0CB8CC707E42AC62D1`.

### Findings and closure

- R2's exact malformed-source + known-channel, known-source + malformed-channel, and non-string-source + known-channel inputs now reject. Normalization retains whether evidence was supplied; malformed market evidence becomes UNMAPPED/NO_MAPPING rather than MISSING_INPUT. Truly missing input retains MISSING_INPUT. No supplied malformed distribution evidence silently selects the paired known mapping.
- All retained R1/R2 probes remain closed: unknown source with known channel and the inverse reject; conflicting known pairs reject; unknown channel and unknown unit UUID do not produce success-shaped leaves. Unknown unit makes both product leaves UNMAPPED/NO_MAPPING.
- Reserved UNMAPPED, hidden segment parentCode/children, duplicate normalized segment/source codes across groups, duplicate channels across sources/groups, duplicate company/unit mappings, unknown/cyclic company parents, unknown market targets, malformed configured UUIDs, control characters, excessive UTF-8 labels and 513-element top-level/nested collections reject.
- Loader probes reject zero and overlapping active rows and accept one valid row. Recorded SQL binds the exact tenant and property key, requires tenant equality with transaction context, type/status and transaction-time effective containment, and reads at most two versions. Invalid scope invokes SQL zero times. This is a recording-Tx proof, **not an executed PostgreSQL RLS/ACL integration proof**.
- Current scoped source remains immutable parsed taxonomy structures, pure resolution, exports and a tenant-bound SELECT. No financial/occupancy mutation, migration, event, KPI computation, API/UI or deployment path is added. Extension registration, activation/version authority and an authorized transaction-local caller remain later governed integration gates. Acceptance does not authorize production metrics or public deployment.

**R3 ACCEPT for the bounded Order570 foundation.** No remaining blocker reproduced. Runtime is an exported source directory without Git metadata, so exact candidate hashes and scoped semantic inspection are the evidence boundary, not a whole-runtime Git-diff claim. Copy this complete review, including both rejection sections, to the serving-source handoff review path; no implementation files changed.
