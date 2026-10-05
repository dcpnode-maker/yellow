# Order 728 — actual Antigravity-assisted Dubai metro accommodation sample

Date: 25 September 2026. Builder: Codex agent `antigravity_dubai728`.
Scope: bounded public OSM base sample only. Root owns independent verification.

## Outcome

An actual single Overpass POST returned **1,233 accommodation POIs**, all retained,
zero excluded. This is an open accommodation base sample, **not** active OTA
inventory, Airbnb identity, full Dubai STR coverage, October rates or calendars.
No app, database, existing PriceLabs export, public tunnel or Drive upload changed.

| OSM tourism kind | Returned / retained |
| --- | ---: |
| hotel | 927 |
| apartment | 164 |
| hostel | 75 |
| guest_house | 55 |
| motel | 12 |

Bounding box south/west/north/east: `24.80,54.85,25.45,55.65`. This is a selected
Dubai metropolitan sample rectangle, **not an administrative boundary**: adjacent
municipalities can be included and areas outside it are not covered. Record presence
does not establish active operation or sellable inventory. OSM node positions are
mapped points; way/relation positions are bounding-box centres, not exact entrances.
Node/way/relation identities are distinct. Physical property deduplication across
different OSM identities is not attempted; POI count is not a verified hotel count.

## Antigravity actually used

Installed CLI: `C:/Users/astha/AppData/Local/agy/bin/agy.exe`.
Workspace: `D:/Yellow/temp/antigravity-quota-check-20260925/`.
Invocation flags: `--sandbox --mode plan --effort low --model gemini-3.8-flash-low
--print-timeout 60s --output-format json --print <sanitized code-generation prompt>`.

- Conversation: `e78867ff-45dd-4830-9413-bc0dbe18170d`.
- Result: `SUCCESS`, one turn, 18.2062061 seconds.
- CLI-reported usage: 14,191 input +2,202 output =16,393 tokens, no thinking/cache
  tokens reported. This is Antigravity-reported usage, not Codex usage or billing.
- Existing sign-in/model used. No paid API key, fallback, account, permission or
  quota change. No claim that free limits were exhausted.
- Prompt requested code only, explicitly no tools/network/files. Shared only public
  endpoint and sanitized requirements; no credentials, repository or private data.
- Generated query, urllib transport, coordinate/name/tourism normalization and CLI
  scaffold. Proposal preserved at `D:/Yellow/temp/order728/antigravity-proposal.py`
  (executable logic transcribed with compact formatting/comments), with result
  metadata in `antigravity-result-metadata.json`.

**Execution distinction:** Antigravity proposed the code; Codex reviewed/hardened it,
applied repository source and tests with `apply_patch`, then the Python interpreter
performed the one actual API request. Antigravity itself did not fetch the dataset.

Review fixes before execution: strict integer IDs and finite non-boolean coordinates;
reject any incomplete-response remark and malformed metadata/duplicate JSON keys;
explicit redirect/content-type/encoding rejection; cap normalizer as well as HTTP;
privacy-filter source persistence; distinct response versus filtered-extract hashes;
durable one-attempt run directory and failure receipt; unknown activity/rates explicit.
The original generated proposal was **not executed**.

## Source and request

- Endpoint: `https://overpass-api.de/api/interpreter`.
- [Official documented POST endpoint](https://dev.overpass-api.de/overpass-doc/en/full_data/area.html).
- [Official Commons/quotas](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- [Official bounding-box convention](https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html).
- [OSM attribution/license](https://www.openstreetmap.org/copyright).
- Attribution: OpenStreetMap contributors; ODbL-1.0, link retained in both datasets.

Query: tourism hotel/motel/hostel/guest_house/apartment nodes, ways and relations in
the finite bbox; `out center`. Server timeout30s, server memory64MiB; client socket
timeout45s; response cap8MiB; transparent `Yellow-OpenData-Sample/1.0` user agent.
No cookies/auth/proxy/redirect/retry/concurrency or scheduler. The query does not
request OSM user/edit metadata. The model's previous bnbme denial and the Google
route restriction were not altered, retried or routed around.

Actual run command, after tests:

```powershell
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' scripts/market-prototype/osm_accommodation.py --output-dir D:/Yellow/temp/order728/actual-run-20260925
```

Exit0, one request, HTTP200, approximately4.93s command wall time. Read timestamp
`2026-09-25T15:41:53.727533+00:00`; source OSM snapshot `2026-09-25T15:40:58Z`.
Original response:541,873 bytes, SHA256
`b6cfbf14e5f684093a8a95a2b7648808e2b3a3e860f332dca4dbf6cb798ab660`.

**Original response bytes were not persisted** because source tags can contain
contacts. Only the whitelisted retained source extract is saved; response SHA is
acquisition metadata, not an independently replayable raw-response artifact.

## Local files

Directory: `D:/Yellow/temp/order728/actual-run-20260925/`.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| osm_accommodations_filtered_source.json | 254837 | `eaf0f50354b35c480662b8a268fadcdac0b4c4f64403c820b2e3f02079ddb24d` |
| osm_accommodations_normalized.json | 730836 | `265ef46e07794ab8e96515daa67b90e445794040abec83ad6a2a6cbfd33ae9c3` |
| attempt.json | 330 | one-request intent, endpoint and exact query |
| result.json | 952 | successful counts/hash/time/attribution receipt |

Normalized schema: `yellow.osm-accommodation-sample.v1`, `metadata` plus
`accommodations`. Source IDs are strings to avoid JavaScript integer coercion.
Sample: OSM node `315482350`, Coral Deira Hotel, `25.2660218,55.3256435`,
`osm_node_point`, [source](https://www.openstreetmap.org/node/315482350).
`source_status=mapped_accommodation_unverified`; active_inventory, ota_identity,
exact_entrance, prices and calendar are each `unknown`. No invented PriceLabs
schema, prices, bedrooms or OTA affiliations. This file is not yet an app importer.

## Proof

```powershell
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' -m unittest discover -s tests/market-prototype -p test_osm_accommodation.py -v
```

Builder result: **18 tests passed**, 0.151s. Tests are network-isolated and cover
normalization, strict IDs, duplicate IDs, coordinate range/type, bbox exclusion,
missing names, all five tourism kinds, malformed/partial/duplicate-key JSON,
source timestamp, privacy whitelist and distinct hash correctness, size/header/body
limits, timeout, HTTP failures, 429/504, redirects, no auth/cookie/proxy handler,
single request, no retry and fresh-directory/no-overwrite behavior.

Source SHA256: `3dc2ed62bf2590ce116867ae405bc082edc126a8786f4453cdb9a3a8cf3e8699`.
Test SHA256: `eea85b3cd9c03c0c9c764760a9d609b3226bd1db8cbf6ca8d571f6ed59aa1e67`.
Adjacent builder regression: **90 tests passed**, 4.551s, by running the same command
without the `-p` filter. Root separately reported personally running the full
90-test suite successfully; retained-source/normalized consistency check remains
root-owned at this builder handoff. No TypeScript/app/schema changes, deployment or financial
operation; no database referee claim.

## Remaining scope

This delivers real base data with explicit provenance; it does **not** finish the
founder's requested active Dubai OTA dataset or one-month per-listing rates. Provider
access, source rights, property matching, active status, missing inventory, rate
comparability and persistent map ingestion remain separate unfinished work. No
external upload, new public service dependency or continuing background scrape.
