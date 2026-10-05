# Q286 — exact five-row local market metadata preservation

Order460,13 September2026. Root owns future action admission; this question
admits two inert pure files only to /root/q258_runtime_cutover after its Q283
maintenance freeze. Do not edit Q283 while root independently reviews it.

- .yellow/evidence/order460/market92-metadata-preservation.ts
- .yellow/evidence/order460/market92-metadata-preservation.test.ts

Reuse unchanged verifyMarket92Migration from the accepted market92-verify.ts.
The future registration/grant is a separate transaction after verified92. Its
only allowed initial deltas are five absent exact rows: one extension_type, two
permission and two role_permission entries for the Q285 existing local role.
Root calculated the following actual PostgreSQL16 JSONB row-text hashes using
the published75a2 schema and literal metadata, in a read-only transaction on the
exact native server. No business rows or credentials were printed and no write
occurred. These pins are not arbitrary caller-supplied allowed differences:

extension_type:0b5f33a52155aeabdaf539f4d7d368e9bc7a6bb26ad11bf649a6082f0bbad3ff
permission:629e375f26eb4301a15eecd2acaacc02483e5c6b33362e7ae53cd57f29d8595a
permission:4d3622dd474493e3a3e29f4ae374be4c31807611fad8971e7d5a8194a93a71ca
role_permission:59ffec06a46aa93af7a6fdf1e35f112b2af14a36be473458ac88b11a2c2e9051
role_permission:6d4fef08428a4d43d03396f4b0cabf0faa925f4ae4b553bba0adae06a21dcadd

Minimal composition: require the original before91/recovery91/after92/migration
inputs pass verifyMarket92Migration. Validate the registered92 capture's original
table-row counts, sorted hashes, aggregate closure and exact fields before
projecting away precisely these five additions from precisely these three tables.
All five must have been absent in the baseline and appear exactly once afterward.
Run the same accepted migration verifier against that narrowly projected capture.
Also bind registered92 against the exact supplied baseline92, ignoring only the
capture timestamp and admitted five rows; do not allow a different valid migration
time/ledger, different authority catalogue, changed companions or any other delta.
This composes existing complete capture validation rather than duplicating it.

Never mutate input captures or accept caller-defined hashes/permissions/roles.
Reject removed/changed/preexisting/duplicate hashes, bad aggregate/counts/fields,
extra permissions or grant rows, any other table/counter/catalogue/global/companion
change, absent/mismatched baseline proof, or malformed registered capture. Return
an explicit source-only verification receipt with runtimeLaunchAuthorized=false.
Tests must cover these exact boundaries and the composition with actual accepted
verifier; reuse fixture patterns but no modification of frozen Q282/Q279 sources.
No connections, credentials, native DB/process/runtime/Git actions, output roots
or live registration/grants follow from this source preparation.

Root independently inspects and executes focused proof before separate metadata
action admission. All18 phases and fiscal/11→13→17 scope remain unchanged.
