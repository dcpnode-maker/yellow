# Yellow activation record

Updated 2026-09-24. One serving source: `D:/Yellow/git-live-order611-source-v2`.
One app process: `yellow-public-demo-app-1`, local port 3010. This is the current
review deployment with synthetic hotel data, not a claim of production acceptance.
The public Cloudflare quick-tunnel address is temporary.

## What the status labels mean

The current registry has 69 capability entries: 14 live, 5 beta, 24 preview,
16 planned and 10 blocked (including the shared-search and group-overview betas).
These are navigation/product labels, **not 69 completed or independently accepted
modules**. An available screen does not prove every mutation, permission and
reconciliation path behind it. Do not enable future capabilities by changing labels.

| Area | Current evidence | Next activation proof / dependency |
| --- | --- | --- |
| Today, reservations, guest context | Serving React routes restored in 666; Today capacity clarified in 667 | Continue real journey checks; no full-PMS acceptance claimed |
| Shared hotel search | 668 browser-verified on desktop/mobile: existing property-scoped reads, no LLM; opens profiles, stays and linked cashier | Separate folio/group/task/catalog indexes remain outside this beta |
| Room preparation and assignment | Existing candidate/readiness APIs, 667 retry and blocker recovery | Independent execution of eligible assignment/check-in and denial paths on isolated test data |
| Cashier / folios / checkout | Existing finance route and governed APIs; search links to the exact stay | End-to-end posting, bill-window split, settlement and checkout proof; retain role and financial gates |
| Housekeeping | Existing task and inspection workspaces | Verify task ownership, cleaning/inspection transitions and arrival refresh together |
| Group blocks | Existing read-only `GroupBlockWorkbenchPanel`; two groups with allotment, pickup and linked rooming-list stays verified in serving board; 669 adds an ecosystem entry | Full sales/contracts, group editing and rooming-list editing cannot be inferred from this panel |
| Client website / booking engine | `/client/locanda-homes` route remains linked | Verify availability -> offer -> booking -> confirmation, customer identity and payment configuration |
| Revenue / commercial | Existing configured rates and performance views | Validate source freshness and metric definitions; a rate screen is not a complete RMS |
| Market data | Internal market-lab UI exists, team gated | Authorized source credentials/licences, provenance, refresh and normalization proofs; do not portray previews as live scraped inventory |
| Channel manager / ARI | Preview / blocked in registry | Approved partner contract, property mapping, acknowledgement and reconciliation proof |
| CRM service timeline / guest portal | Partial profile context, broader guest-services previews | Stay-scoped identity, requests, staff assignment/escalation and guest-visible status contract |
| POS / ancillary services | Planned | Menu/outlet/tax, inventory, fulfilment and authorized room-charge contracts |
| Loyalty / event contracts | Blocked / planned | Founder-approved benefits/liability and contract/document policies |

## Integration order

Finish connected PMS journeys before opening more shells: find guest/stay ->
prepare room -> explicit assignment/check-in -> requests and charges -> split /
settle -> checkout -> history. Each implementation order specifies files, proof,
independent review where required, and the one serving build to update.

Routine bounded matching work can use a cheaper model, while the coordinator
integrates and verifies. Order668 used a requested GPT-6 Luna worker; no local-phone
worker, free provider, Spark entitlement or automatic quota failover is claimed.
Search runtime itself uses no LLM. Do not send guest data or credentials to model
providers merely to activate a UI feature.

No schema migration, financial-policy change, database deletion, additional app
instance, secret rotation or paid external service is part of Orders668/669.
