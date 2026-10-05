# PROFILE-20260930 — Public property profile evidence pipeline

Status: authorized implementation under the founder's direct request to continue
Yellow PMS/CRM and prepare a real-data model test. Initial cohorts are bnbme and
Locanda Homes STR operations, Aketa Dehradun and a source-verified UK hotel set.
The laptop supplies its logged-in Lighthouse account roster separately. This is
Yellow public property/profile work, not CompSet pricing acquisition.

Basis: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`.
Branch: `phase-7/property-profile-capture-20260930`.
Worktree: `/workspace/yellow-property-profile`.

## Outcome and limits

Build an executable bounded pipeline from captured public property evidence to
an inspectable master-profile draft: provider-namespaced listing identities,
multiple explicitly related aliases, source-backed amenity mappings, original
source-advertised image URLs/dimensions and observation chronology. No name-only
or proximity-based automatic merge. Every selected value retains its provenance
and conflicts/unknowns. Observation freshness is not provider update freshness.

The current property identity service remains authoritative for Yellow's owned
name/timezone/currency and permissions. This draft pipeline does not create a
tenant/property, assign ownership, write an authoritative profile/inventory,
download image bytes or invent active Google/Airbnb/OTA API access. Google shared
links are untrusted identity leads; unresolved short links remain unresolved.
No paid service/key or challenge bypass is activated by this order.

## Exact scope

- NEW `src/contexts/distribution/property-profile-candidate-evidence.ts`: pure
  bounded evidence contracts/normalization and deterministic draft composition.
  Identities include provider and optional account connection namespace; explicit
  mapping links do not confer Yellow property or ownership authority. Preserve
  aliases/history/conflicts and exact provenance. A physical unit remains one
  canonical core entity across owner/operator/co-host account views.
- NEW `src/contexts/distribution/property-profile-public-capture.ts`: bounded
  pure JSON-LD lodging/amenity/image extraction from an already captured public
  document, exact source URL/time/sha provenance; no embedded script execution,
  arbitrary links, implicit ownership or coordinate/name matching. At most2MiB
  UTF-8 and bounded document/node/string/evidence counts; strict plain inputs.
- `src/contexts/distribution/index.ts`: only public exports for these helpers.
- NEW `scripts/research/property-profile-capture.ts`: executable offline capture
  CLI, explicit input/output paths, lossless captured-evidence pipeline into a
  bounded JSON draft. No network, credentials, filesystem traversal from source
  content or PMS database writes. A separate coordinator read-only public fetch
  receipt supplies real documents for proof; the CLI must process them itself.
- NEW `tests/property-profile-candidate-evidence.test.ts` and NEW
  `tests/property-profile-public-capture.test.ts`: meaningful provider/account
  collision, explicit alias, ambiguous/repeated IDs, chronology, amenity conflict,
  unknown/photo dimension, mutation/hostile input, size/byte and JSON-LD cases.
- `docs/CONTRACTS.md`: append precise draft-only evidence and CLI boundary.
- This order; NEW `handoff/reviews/PROFILE-20260930-public-property-evidence.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` source/proof records.

Any network transport, new provider, database/auth route, migration, frontend,
profile publishing or external-account activation needs its own scoped order;
never silently widen this order. Source capture is coordinator-owned outside the
repo and uses bounded public requests only. The original URL, not an invented
high-resolution variant, is retained; reuse rights remain unknown if unobserved.

## Acceptance

Execute the CLI against at least one genuinely fetched named-cohort official
property document and preserve source status/final URL/hash/timestamp. Output
only facts present in structured source; company landing pages are not lodging
profiles, and missing OTA/Google/amenity/photo/update evidence remains unknown.
Malformed or ambiguous lodging nodes must be surfaced, not arbitrarily selected.

Prove provider/account identity separation; multiple explicit aliases for one
anchor without physical inventory duplication; no fuzzy/wrong-city auto merge;
latest captured evidence chosen deterministically with all history retained;
source-updated time stays null when absent; false/unknown/conflicting amenities
remain distinct; source-advertised full-size/dimensions versus unknown; no media
download, script execution, relative-path escape or unsafe URL output.

New strict pure tests, real CLI public-data proof, existing market adapters and
batch tests, typecheck, boundaries and complete staged/basis whitespace must
pass. Independent non-implementer reviews untrusted parsing/provenance and
personally executes relevant hostile and real-data proof. Unmodified canonical
referee11/11 precedes any reviewable PR; inherited license/offer release failures
remain visible. No push/merge/deployment or complete-profile/provider-coverage
claim follows from this foundation. Later authorized property mapping/publication
and connected-account operations need live permission/tenant proof.

## Builder checkpoint — 2026-09-30 (independent review pending)

Implemented the two pure distribution helpers, public exports, offline capture CLI
and the two scoped unit files. Identity namespaces preserve provider/account
separation; only explicit source aliases connect candidate IDs. Composition keeps
disconnected listings separate, chooses current name/address/amenity evidence by
UTC capture chronology, retains all history and conflicts, maps only a small
amenity vocabulary, and leaves media rights and amenity scope explicitly unknown.
The JSON-LD parser applies the ordered UTF-8/node/string/evidence bounds, surfaces
malformed or missing lodging evidence and emits no operational authority.

The exact CLI input envelope is
{captures:[{sourceUrl,finalUrl,status,capturedAt,body}]}; httpStatus is an
accepted status alias. Invocation:
    bun run scripts/research/property-profile-capture.ts --input <capture.json> --output <draft.json>
The invocation performs no network or database access.

Focused property-profile plus existing market-shopping/adapter/batch tests pass
56/0 (286 assertions), typecheck passes, and import-boundary check passes with207
TypeScript files scanned. A real CLI run against the coordinator's named-cohort
capture file preserves Aketa's exact capture hash
ef5fa4176c751865fdee738f624361f692ce0af11c397714e889e4ebc300a749 and
47,375 UTF-8 bytes, extracts one lodging node, four explicit source identities,
eight amenity claims and three source-advertised image URLs with unknown
dimensions/rights. It leaves source-updated time unknown and surfaces an
unresolved Google short link. The Headingley document hash is
d436ac5638de3c89c87d5ed017ba9d5571175d5e1e70da8a7b50833fa86e5857
(24,706 bytes); it contains no lodging JSON-LD, so output has zero property nodes
and reports no-lodging-node. The generated draft is therefore marked incomplete.
No full OTA coverage, full-resolution media, ownership mapping, profile approval
or network-fetch capability is claimed. Safe focused logs and the inspectable
draft are retained under /workspace/yellow-coordination/profile-proof/.

Source and tests are frozen pending independent review. This checkpoint is not a
review verdict, referee result, release, provider activation or deployment.

### Reviewer hardening checkpoint

The independent parser review found edge cases around script selection, schema
context, duplicate JSON keys, tie determinism, normalized amenity conflicts,
unidentified capture keys and diagnostic amplification. The helpers now use the
pinned Bun HTMLRewriter to select actual `script[type="application/ld+json"]`
elements outside inert HTML templates, require a trusted schema.org context and
exact known lodging type names/IRIs, reject URL ASCII controls/spaces and duplicate
object keys, bind positional
missing-`@id` identities to exact page URL + capture hash + JSON-LD path, and use
deterministic full-observation tie ordering. Unmapped
amenity conflicts share the selection normalization. Traversal visits and emitted
issues have fixed caps. Exact safe page query/fragment bytes are preserved because
they may identify otherwise un-ID'd captures; credential-like parameter keys
remain rejected.

Permanent regression coverage now includes false/inert script markup, evil contexts
and type IRIs, duplicate keys, URL ASCII whitespace, deep nested null arrays,
content-bound positional identities, reversed contradictory same-provenance
observations and case-normalized unknown amenity conflicts. Focused profile plus
established market suites pass 65/0 (331 assertions), typecheck passes, and import
boundaries pass with 207 files.
The real named-cohort CLI rerun remains incomplete: Aketa retains hash
ef5fa4176c751865fdee738f624361f692ce0af11c397714e889e4ebc300a749, 47,375 bytes,
one lodging observation, eight amenity claims and three image URLs; Headingley
retains hash d436ac5638de3c89c87d5ed017ba9d5571175d5e1e70da8a7b50833fa86e5857,
24,706 bytes and zero lodging observations. Safe summary receipts are under
`/workspace/yellow-coordination/profile-proof/`.

Updated source and tests are frozen for the independent reviewer. This checkpoint
does not claim full OTA coverage, full-resolution media, profile approval, provider
activation, referee result, release or deployment.

## Independent final source checkpoint

Reviewer personally accepts frozen pure foundation after74/0/380 focused/market tests,32hostile probes, types/boundaries207 and actual CLI/nooverwrite checks. Coordinator unchanged canonical setup11/11 and real input hashes/facts are verified. Exact11-file staging/whitespace checkpoint remains before local commit; no full provider/profile/STR cohort or release claim. Earlier builder-only receipts remain historical and are not rewritten.
