# Question 016 — repeat-guest Party reconciliation admission

## Finding

The current two-property scenario creates a deterministic Party UUID from the
reservation loop index (`${property.key}/party/${index}`). The display name is
chosen separately by cycling a 24-name roster. This guarantees one Party per
reservation and prevents every repeat-stay profile from existing.

Current authoritative counts:

| Property | Reservations | Primary Party IDs | Display names |
|---|---:|---:|---:|
| Locanda Homes · Jareed Riyadh | 131 | 131 | 24 |
| The Harrington London | 251 | 251 | 24 |
| Total | 382 | 382 | 24-name roster per property |

No current scenario Party owns more than one reservation. Every reservation has
a matching primary `reservation_guest`. The 382 Party records have 382 guest
roles, 382 primary reservations and 382 primary reservation-guest links, with
zero contacts, addresses, preferences, memberships, accounts, payment
instruments, identity documents, fiscal registrations, messages or consents.

## Proposed technical admission

Use one tenant-global deterministic scenario Party per roster identity, keyed by
the scenario key plus a normalized immutable roster key—not by property or stay.
The same Party may then truthfully show repeat history across properties.

For the already-published scenario, a dedicated reconciliation must:

1. lock the exact scenario and both exact property IDs;
2. verify every source Party is scenario-tagged, contact-free and linked to
   exactly one scenario reservation, with no references outside the enumerated
   allowed set;
3. create the 24 canonical Parties/guest roles idempotently;
4. update both `reservation.primary_party` and its primary
   `reservation_guest.party_id` together for all 382 stays;
5. mark superseded Parties `merged` with `merged_into` pointing at the canonical
   Party—never delete history;
6. write reservation/Party fact and outbox evidence in the same transaction;
7. prove all reservation counts, occupancy, confirmation numbers and non-Party
   data are byte-for-byte unchanged;
8. prove replay has zero effects and a hostile non-scenario reference fails
   before any write.

This is a high-risk identity and reservation-history correction. It requires a
separate implementation order and a non-implementing reviewer who personally
executes the database proof before the public database is changed.

No founder product-policy decision is required: the requested intent already
states that repeat guests must have one profile with current, past and future
history. The remaining gate is technical implementation and independent proof.
