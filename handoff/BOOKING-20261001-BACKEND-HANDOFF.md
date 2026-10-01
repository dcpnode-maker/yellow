# Guest booking backend — laptop receiving contract

Base444072ffdff2b7745345d88f71b603c17e11ace6. Laptopcontroller source3039ac9345503b2e0aec07759d5686493b3ff3c7 and public hosting remain authoritative. Inventoryd3c1aa62ada0b44a4fd932e5b5d467cae6c96d2b at handoff/backups/444-current/module-inventory-v1/MODULE_HANDOFF.md.

## Implemented invitation flow

StaffPOST `/api/v1/properties/:property/booking-invitations`, ordinary staff auth, `Idempotency-Key` 8–128 visible transport-safe characters, exact JSON:
`{primaryPartyId,channelCode,ratePlanIds}`. One existing activeParty, channel,1–16propertyplans and all five live availability/rates/hold/reservation/Party read scopes. Returns `{token,expiresAt,replayed}`. Staffdelivery is outside backend. Keepbearer in memory; no URL/query/log/storagetoken.

PublicPOST below with `Authorization: Bearer <guesttoken>`; token cannot authenticate staff APIs. Exact JSON; no query parameters or authority/bodyextras.

| Route | Body | Result |
|---|---|---|
| `/api/public/booking/offers` | `{stayStart,stayEnd,adults,childAges}` | full canonical offer options/issues/summary; explicitly no inventorypromise |
| `/api/public/booking/quotes` | previousfields plus `sellableUnitId,ratePlanId` | `{quote,quoteToken,expiresAt,paymentAccepted:false}`; complete quote evidence, decimalbigint |
| `/api/public/booking/holds` | `{quoteToken}` | `{hold,holdToken,expiresAt,replayed}`; canonical600second hold/complete calculatedtax |
| `/api/public/booking/reservations` | `{holdToken}` | `{reservation,replayed,paymentAccepted:false}`; canonicalcommitHeld occupancy/taxlineage |

Dates canonicalUTCISO withmilliseconds; stay1–366days, adults1–99, childages0–17 up to30. Propertytimezone remains canonical. Session15minutes, quote<=5minutes. Newholdrequires>=600second session remaining; renewstaffinvitationotherwise. Exactonehold/confirmation command per session. Errors400invalid/401expiry/403authority/409stale-conflict/503unavailable; no-store responses. No PAN/payment/provider activation. Unknown/unconfigured backendroute404.

## Integration boundaries

Newmodules: identityguest-booking-token/authority, reservationsguest-booking, httpguest-booking. Public contextindex exports added. The separate `handoff/patches/BOOKING-20261001-app-server.patch` contains zero-context hunks for imports, AppOptions, five mounted routes and server dependency composition against444. The insertion contexts are AppOptions.operatorApi, the existing withOperatorTenant closure, the block before hostedDepositRoutes, and runtimeApp tenantResolver/operatorApi composition. Review these against3039; never apply by old line number blindly. DO NOT replace3039app/serverwholefiles: browsercookie/authnormalUIchanges belonglaptop. Mergeindividualhunks and rerun mountedguest+cookie/origin/sessionacceptance. FrontendApp/auth/session/header/theme/ribbons are untouched. LaptopownsguestUI in originalYellowdesign.

Reservedmigration0104 addsoneownerassertion, notables/tableDMLgrants. Source checksum and exactapplicationfrontiers are in `handoff/receipts/BOOKING-20261001/SOURCE_PROOF.json`. Onlyowneddisposablecloudproofs applied104; laptopmustcheck103ledger/checksums and independentlyadmit104. Kernel/build/CI/local-review currentfrontier literals become104; originalassertions/deadlines stay. Strict schema snapshot addsonly69function/ACLlines. Earlierunadmittedprototype/failures retained externally; no non-disposableapplication.

## Proof

Independent review `handoff/reviews/BOOKING-20261001-guest-invitation-flow.md`. Reviewer personallyrealPG18native11/0/95 plus three admission refusals, focused39/0/452, frontiermetadata10/0/126, types/boundaries. Canonicalreferee11/11; fullstanding2581/0/45297 with1618explicitDBenvironment skips, underownedsubreaper. Newbookingnative suite usesrealratequoteevaluation and canonicalhold/taxlineage/reservation/facts/outbox withsyntheticavailability/publication/taxjurisdictionports; notproductionrate/providerdata. Unchangedruntime tableACL and existingreadiness passed on104 proof.

Reproduce native tests using two secure envbindings `YELLOW_GUEST_BOOKING_DEPLOY_URL` and `YELLOW_GUEST_BOOKING_RUNTIME_URL`, matchingdedicated `yellow_guest_booking_proof*` DB with exactdeploy/runtime roles onPG18; set `YELLOW_REQUIRE_GUEST_BOOKING=1` and `bun test tests/guest-booking.integration.test.ts`. NEVER bind businessDB. Full`bun test`, strictschema and`./setup.sh --db-only` remain required on receivingtree. CI/mainmerge/deploy remain pending controller. Privatecloud53018/444 is unchanged.

## Remaining public engine

Invitationflowrequires existingParty/staffdelivery. Uninvitedshop→quote→hold→guestdetails→confirm still requires reviewed staffpublishedsitebinding and bounded guestprofilecreation/deduplication/privacy handling. No anonymousguestpermissions/globaltenantlookup/payments/newfrontpage are claimed. Nextboundedorder will use existingcore and a controller-reserved forward capability ifneeded; no independentlyallocatednumber or separatePMS.
