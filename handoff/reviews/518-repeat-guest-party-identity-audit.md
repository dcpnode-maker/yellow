# Review — Order 518 repeat-guest Party identity audit

## Verdict

Audit complete. The repeated guest search result is caused by deterministic
scenario generation, not by the Guest UI or search endpoint.

## Source proof

`scripts/provision-two-property-operating-scenario.ts` currently derives:

- Party ID from `${property.key}/party/${index}`;
- display name from `NAMES[index % NAMES.length]` (with a London offset);
- reservation, primary Party and primary reservation-guest row one-for-one.

The provisioner returns early when a property already exists, so merely changing
future source would not repair the published database.

## Database proof

Read-only queries against `yellow-public-demo` showed:

- Locanda: 131 reservations, 131 primary Party IDs, 24 display names;
- London: 251 reservations, 251 primary Party IDs, 24 display names;
- zero Parties with more than one reservation; maximum one stay per Party;
- zero missing primary reservation-guest links;
- scenario Party references are limited to `party_role`,
  `reservation.primary_party` and `reservation_guest` among the audited guest
  data tables; contact/fiscal/payment/account/preference/history-side tables are
  empty for these Parties.

For Locanda specifically, each roster name owns five or six separate Party IDs.
`Meera Iyer` owns five, explaining the repeated inline search results.

## Required next step

Question 016 defines an idempotent, evidence-writing, merge-preserving
reconciliation. No data was modified by this audit. Because the repair changes
Party identity and reservation relationships, it must receive independent
reviewer-executed proof before public application.
