# Order 653 — governed cashier posting command

## Scope

- Extend the explicit public-demo fixture with only the accounting objects needed for bounded cashier posting.
- Add a confirmation-gated cashier posting command route for the fixed public-demo folio.
- Permit only a finite demo charge catalog so repeated public calls cannot create arbitrary postings.
- Update action-safety/proof/readiness/share evidence after implementation and independent review.

## Acceptance

- Unconfirmed calls return before opening the database.
- Unsupported confirmation/folio/charge keys return before opening the database.
- Supported confirmed calls require the explicit public-demo fixture and refuse rather than creating it inside the command.
- Each allowed charge key posts at most once; replay rereads state without duplicating journal/posting rows.
- Successful first posting:
  - inserts one balanced `journal` of kind `charge`;
  - inserts exactly two `posting_line` rows in one transaction;
  - debits the guest folio/account and credits the demo revenue account using bigint minor units;
  - rereads `folio_balance`;
  - writes one `folio.charge_posted` outbox event in the same transaction;
  - does not write reservation state, occupancy, payment, payment instrument, document, statutory submission or business-day seal state.
- Focused tests, typecheck, import boundaries and PG18 referee pass.
- Because journal/posting/folio state is high-risk, a non-implementing independent reviewer must personally execute proof and record it in `handoff/reviews/653-governed-cashier-posting-command.md`.
