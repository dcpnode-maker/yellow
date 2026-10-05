# Order569 — independent read-only public postflight

Date:2026-09-21. Reviewer: OpenAI Codex independent Astra agent `/root/astra_review`, not the release executor.

## Verdict: ACCEPT

Personally read Order569 and accepted Review568, verified the public deployment chain and performed the actual public375px cashier journey. No deployment, database connection, operational POST, checkbox selection, amount entry, affirmative confirmation or charge/replay was performed. Automatic demo authentication alone established the ordinary read-only session; credentials/tokens were not recorded.

## Deployment and identity evidence

Personally executed `docker inspect ... --format '{{.Name}} {{.Id}} {{.Image}} {{.State.Status}} ...'` and `docker image inspect ... --format '{{.Id}}'`:

| Target | Exact observed identity | State |
| --- | --- | --- |
| Public app | a56f342e705f213c4b0a7feb0664f662624a736da20bcc6e42fcb989d2e30675 | running/healthy |
| App image / latest | sha256:1da7b814d0e77c8334a6afeb53c940140732d6a178f5b6e54aa275ad499cfb03 | current |
| pre-order569 rollback image | sha256:f52aeae902a3af00c14d76c06d4bc77c1fa62a979c767dad5fa5c9ae0c29f122 | retained; matches Review566 prior app |
| PostgreSQL | 9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5 | running/healthy, identical Review566 |
| Valkey | 781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b | running/healthy, identical Review566 |
| tunnel | e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a | running, identical Review566 |

Initial inspection guessed a Compose-style `yellow-public-demo-tunnel-1` name and returned no object; subsequent inspection used the exact baseline ID and verified actual name `yellow-public-demo-tunnel`. This was a reviewer selector mistake, not an infrastructure failure.

`Get-FileHash` confirms accepted source remains exact: App95A1E263…BFD949, CSSAE334F9E…663E3F, focused test9A139D14…88FB59; full hashes are in Review568. No new source acceptance is inferred merely from the image tag.

## Personally executed HTTP/artifact checks

`bun D:/Yellow/temp/astra566-http.ts` was reused read-only against local `http://127.0.0.1:3010` and public `https://editing-alto-artists-quilt.trycloudflare.com`. Health, property Today page and all five referenced assets returned200. A separate Bun GET/hash comparison verified exact health/page byte parity as well:

- `/health`: SHA256 `a29ee2b15c494311c52521766e44af56a3ad2248e7a8ab465e5206463c13d288` at both origins.
- `/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today`: `bf85f9d3faa8bf4d6081c4443f5cfa6d9cc83fa4662ab61449a4d9244c782e71` at both origins.
- `index-H3MwgIXN.js`: `8D4EBF7BF0060B947A512DE6C84691E3281E0B304EE793EB3FCE363AF8A27F1F`.
- `index-BOgxiBmJ.css`: `3712E63C85C784822949683642CC3A63EAF4BAFF7019BA0AB46FC4717FAC4880`.
- rolldown/react/vendor chunks also return200 with matching origin hashes. Main JS/CSS also match local artifacts personally built during Review568.

## Actual public rendered proof

CUA inventory returned `apps:[], browsers:[]`. Used existing bundled Playwright with installed Chrome, without installing dependencies:

`node D:/Yellow/temp/astra569-public.cjs`

Flow: public Today → Ask Yellow → type **Open cashier for Omar Siddiqui** → inspect live cashier. Network interception allowed only GET/HEAD/OPTIONS plus ordinary `/auth/demo:enter`, aborting any operational method before transmission. Final run: exit0; **zero operational requests attempted and zero page errors**. Only horizontal scrolling and keyboard focus followed the read command; no charge-group choice, checkbox, amount or yes was entered.

- Exact target: current Omar Siddiqui, L3R-DI-0015, L3R-FOL-1, In house/occupied, open window. Status containers remain visibly labelled with positive/attention/neutral classes and canonical data-status values.
- Exactly one visible immutable ledger row: L3R_LAUNDRY, Laundry, **SAR25**, quantity1.000,2026-09-21, running balanceSAR25; folio balanceSAR25.
- All six group buttons present: All, Food & beverage, Guest services, Other, Wellness, Rooms. Every button measured height44px, width≥85.609px. Exactly one `aria-pressed=true` (All), remaining five false. All six decorative SVGs have `aria-hidden=true`, `focusable=false`; active check mark is present.
- Active All computed white background/dark text. Inactive groups compute transparent backgrounds over rail `rgb(233,233,228)` with their intended dark foregrounds; the black-background cascade regression is absent. Far-end horizontal scrolling/focus succeeds (Other focus true, rect23.125..108.734px).
- Width/scrollWidth **375/375** at375×812; **1440/1440** at1440×900. Reduced-motion computed animation none, transition0s on the group control.
- Checked checkbox count0 and **Post confirmed charge disabled** at both sizes. Empty amount remained untouched. Drawer message clearly reads Cash drawer not configured, followed by cash-custody unavailable / governed room, service and non-cash folio charges can still be posted above.

Reviewer personally inspected `D:/Yellow/temp/astra569-public-375.png`; desktop screenshot retained as `astra569-public-1440.png`. Structured measurements in `astra569-public-results.json` SHA256 `A2CCBA90A6155DF2F7488EBA9B0AFF9D64BD31196F7B3D0C7C96BE321CFCFB07`; harness SHA256 `4E53C290E3AD60034A694674EB43048581D71C7DC260FE5E057781D17C799EBC`.

Initial harness incorrectly required case-sensitive rendered badge text although CSS uppercases it, then used an exact paragraph locator for a sentence fragment. It failed before any operation; corrected only the reviewer oracle to case-insensitive badge matching and substring paragraph wait, then reran. These were not product defects or waived missing copy.

## Boundaries

This verifies the actual released affordance, exact reviewed artifact parity, retained rollback image and unchanged non-app container identities. No SQL/full-table snapshot was requested or executed in this bounded postflight; unchanged container IDs are **not** misrepresented as proof of full historical data equality. The existing SAR25 statement is verified read-only, not re-posted or replayed. No further financial action, public migration, settlement, fiscal issuance, complete cashiering or whole-PMS readiness is authorized by this acceptance.
