# Question 015 — Live public-demo contact-free preflight failure

## Evidence

On 2026-09-20 the read-only preflight for Order 491 against the locally hosted
`yellow_public_demo` database returned:

```text
migration=91; party=29; contact_point=3; payment_instrument=0; journal=0;
reservation=28; Yellow House Mumbai=1
```

The required `G:` backup target is also currently not mounted; available local file
systems are C:, D:, and E: only.

## Decision required

Before any target migration or colleague-share readiness claim, decide the governed
contact-free reconciliation path for the three public-database contact points and
their related parties. It must preserve required audit/financial/statutory records,
never delete protected history, and prove the final public dataset is synthetic and
contact-free. A separate scoped order and independent review are required.

Order 491 is paused before backup/migration. No public database mutation occurred.

## Additional relationship trace (read-only, 2026-09-20)

The three contact points resolve to **one** active `person` party.  No contact values
were selected or recorded.  The following affected-party reference counts were
obtained through a read-only, target-bound query:

| Reference | Count |
| --- | ---: |
| Reservation primary/booker/guest | 0 / 0 / 0 |
| Account / folio account | 0 / 0 |
| Membership / message / identity document | 0 / 0 / 0 |
| Preference / address / consent / erasure request | 0 / 0 / 0 / 0 |
| Party role | 1 |

This establishes that a narrowly scoped contact-free reconciliation need not alter
reservation, operational, financial, statutory, or payment history.  It does **not**
authorize a direct SQL update or deletion: the final implementation still needs a
separate order, a verified external backup target, and independent target-bound
review.

## Restorable backup receipt (2026-09-20)

A PostgreSQL custom-format dump was created from the target without reading its data:

```text
path: D:\Yellow\backups\yellow-public-demo-pre-reconcile-20260920-155230.dump
bytes: 2,220,754
sha256: D72F9662A2B14CE4332D2ABCF78A644536B1770C9BDD13D452B6E59FB9F9ED61
format: pg_dump custom; 2,072 TOC entries
```

`pg_restore -l` was independently run against a temporary container copy and listed
the archive successfully.  The file remains local pending upload to the founder's
selected private Google Drive account; it has not been shared or inspected.
