# Independent review — Orders 171/173/174/175 reservation-to-folio journey

**Verdict:** APPROVED
**Reviewed candidate:** `6870692cc998a2fe200f3dfefd486cd30d8cf153`
**Product executable:** `453a2b6c08e74f05d1ec841949074333cc76ec51`
**Original Order171 Base:** `c830c9ebb80dcceb4d70d54784d7f17427ddf02a`
**Immediate Order175 Base:** `b8c1b94c73c1f3b491794cead03c658113e8892c`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-26

## Independence, admission and scope

I did not implement Orders171, 173, 174 or 175. I read `PROJECT.md`, ran
`./state.sh`, read all four orders and D-440/D-442 through D-448, and applied the
Yellow entity, PostgreSQL and compliance review rules. No stopped candidate evidence
is counted as approval; P1-P6 were restarted on exact immutable candidate `6870692`.

The candidate was clean. It retains the approved Order171 product plus the Order173
exact-replay correction, Order174 singular UUID shell and Order175 responsive
containment. Immediate Base-to-product scope is exactly two files:

- `src/http/operator/operator.css`;
- `tests/operator-folio-workspace.integration.test.ts`.

The production delta only adds `min-width: 0`, `max-width: 100%` and local
`overflow: auto` through the real folio statement grid-item/wrapper chain. The
semantic `.folio-lines` minimum width remains 900 pixels, the below-768 card
breakpoint is unchanged, and no HTML, JavaScript, route, API, finance, schema,
permission, dependency, protected test or runtime input changed in Order175.

## Sole isolated reviewer stack

All database, API and Browser proof ran sequentially on one disposable Compose stack,
`yellow-o175-ir-6870692`, with exact image
`sha256:de1a20ecce7e427f351e661fc0450ec91558bb6557186da1b1402a152f010035`.
It had only app, PostgreSQL 16.15 and Valkey 8.1.9 containers, bound only to
loopback reviewer ports 3123/5573/6423. Ports 3000/3002 were unbound and untouched.

The ignored reviewer credential file contained only the expected password/token keys,
had one owner-only ACL rule and was never printed. All six generated database and
application secret values were distinct and strong. Exact-value scans found zero
tracked-file matches and zero reviewer-container-log matches.

## P1-P4 — authority, journey, replay and hostile finance

Fresh canonical setup on the sole stack applied migrations 0001-0018, produced 85
public tables with 75 RLS tables and returned **11 passed, 0 failed of 11** from
`./setup.sh --db-only` before the app started.

Personally executed fresh PostgreSQL suites:

- review seed: **12/12**, 40 assertions;
- founder journey: **1/1**, 210 assertions;
- financial folios: **12/12**, 90 assertions;
- financial postings: **10/10**, 111 assertions;
- folio statements: **9/9**, 36 assertions;
- operator folio workbench: **13/13**, 111 assertions.

The complete journey passed login -> Party -> five current offers -> hold ->
reservation -> explicit primary folio -> UUID statement -> empty balance -> governed
ROOM charge -> refreshed `12500` balance. It proved one account/window/folio/number/
fact/outbox effect, then one balanced immutable two-line journal, with no payment,
tax, document, fiscal, cashier, AR or trust artifact.

First folio creation returned 201. Twenty same-key retries retained the exact original
status and byte-identical body, with replay truth only in the response header. Twenty
new-key existing-folio calls returned 200 `changed:false`; changed actor/body on the
original key returned 409. All converged on one durable effect. Injected rollback left
no partial artifact or skipped number. The hostile suites preserved denial and zero
partial work for tenant/property/grant violations, inconsistent references,
missing/ambiguous/fiscal series, sealed/missing business day and bad routes. Posting
stress created 500 charges/1,000 balanced immutable lines with zero drift; the
statement proof bounded and indexed a 10,000-line source.

The served independent script returned:

`login=200, properties=1, offers=5, reservation=201, open=201, exactRetries=20,
retryBytes=true, existingLookups=20, changedActor=409, deepLink=200,
deepRefresh=200, emptyBalance=0, charge=201, finalBalance=12500, piiGetUrls=0`.

Singular `/p/{property}/folio/{uuid}` and plural shell routes returned byte-identical
200 HTML. Malformed/extra/unknown neighbors stayed 404. Served HTML/CSS/JS were
byte-identical to candidate source.

## P5 — exact Browser and accessibility proof

The updated Browser connector was unavailable in this reviewer's binding after its
mandated setup (`No browser is available`). The independent non-implementing Codex
coordinator therefore operated Browser against this exact reviewer-owned sole stack;
I retained stack and approval ownership and accepted only its exact measurements.

Normal Reservations -> drawer -> Open folio reached the exact UUID with
`?tab=postings`. Direct refresh signed out as designed; credential re-login restored
the same UUID, FOL-1 and balance 12500.

Exact root/client/scroll measurements were:

- 375: `375/360/360`, one card column, table wrapper hidden;
- 720: `720/705/705`, one card column, table wrapper hidden;
- 768: `768/753/753`, wrapper client 687, wrapper/table scroll width 900;
- 1024: `1024/1009/1009`, wrapper client 653, wrapper/table width 900;
- 1440: `1440/1425/1425`, wrapper/table width 1046.

At every width there were 17 visible controls, minimum target size 44 pixels, zero
undersized controls, no clipped head/tabs/summary/panel, and one statement row/card
(bounded below 50). A user wheel moved only the 768 local wrapper from scrollLeft 0
to 212.8 of 213 while the document stayed contained.

Pixel theme at 1024 with reduced motion stayed `1009=1009`; loader animation names
were all `none`. Apple theme at 1440 stayed `1425=1425`. At explicit page scale 2,
the visual viewport was 712.4 pixels while root client/scroll remained `1425=1425`.
Postings ArrowRight moved both focus and selection to Add charge. Entering amount 99
and selecting Postings raised the explicit discard confirmation; cancellation retained
the charge tab/value and balance. After clearing, Back returned to plural `/folios`,
hid the workspace and restored focus to the reference input. No Browser finding.

## P6 — standing gates

- focused folio/reservation/assets proof: **37/37**, 572 assertions;
- focused folio workspace proof: **8/8**, 90 assertions;
- full suite: **213 passed, 480 skipped, 0 failed**, 2,612 assertions across 105
  files;
- typecheck and 66-file boundary check: pass;
- frozen install: 23 packages, no change; licence policy: pass;
- dependency audit: no vulnerabilities;
- schema: exact match to `tests/schema/expected.sql`;
- focused JWT/assets/headers/token security: **33/33**, 289 assertions;
- gzip level 9: HTML 18,543 + CSS 12,719 + JS 53,832 = **85,094 bytes**, below
  the 92,160-byte cap;
- protected SHA-256: baseline
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
  `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
  `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`;
- fresh canonical referee: **11 passed, 0 failed of 11**.

One initial `bun audit` invocation stopped on `ConnectionRefused: audit request
failed`; it is not counted green. The immediate independent rerun completed normally
with `No vulnerabilities found`. No other failed or stopped invocation is counted.

After Browser completion, the exact three reviewer containers, app image, network,
volume, detached worktree and credential/authority files were removed. Filters found
zero residual project containers, volumes or networks; reviewer ports and founder
ports 3000/3002 were unbound.

## Verdict boundary

Orders171, 173, 174 and 175 are approved together at exact candidate
`6870692cc998a2fe200f3dfefd486cd30d8cf153` with no finding. This approves only the
explicit reservation-to-primary-folio-to-untaxed-charge founder journey, exact replay,
UUID shell and responsive containment. It does not approve automatic folio creation,
payments/deposits/refunds, settlement, tax/fiscal/document/cashier/checkout, transfers,
production role grants, local promotion, merge, push, deployment or Phase completion.
