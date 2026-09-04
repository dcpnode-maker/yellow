# Order 414 — Fresh independent Tier-3 review

**Verdict:** CHANGES REQUIRED — D1233

**Reviewed candidate:** `deb89c9`

**Approved base:** `4969c8a`

**Reviewer:** `/root/order414_fresh_tier3`, fresh independent non-implementing Tier-3 reviewer

## Finding

Order414 does not satisfy its mandatory correctly-rehashed journal-forgery proof.
The reviewer personally constructed an exact deeply frozen Order413-shaped input from
the committed fixture, changed only
`financialSource.journalLines[0].description` to `FORGED DESCRIPTION`, and recomputed
both the financial `sourceEvidenceHash` and outer Order413 `evidenceHash` with the
same tenant-bound canonical digest used by the candidate. The candidate accepted the
forgery and returned `eligible_irp_accommodation_numeric_item_sources`.

The cause is that `validateFinancialEnvelope` checks journal-line keys and scalar
types, and checks only the root keys of `taxDetail`; it does not bind the lines and
nested tax-detail values back to the exact Order367/413 posting topology, totals,
accounts, routes, component identities, jurisdiction, or balance. The committed
hostile case replaces `journalLines` with a malformed one-element array, so it does
not exercise a valid-shape, correctly rehashed nested mutation.

This contradicts required proof item 3 (lineage and journal forgeries must fail
closed) and the exact contract's claim that the complete Order413 result is
independently validated. Approval is withheld. A repaired candidate must add
mutation-sensitive exact-shape journal/tax-detail forgeries and semantically bind the
complete journal topology before a different fresh Tier-3 review.

## Reviewer-personal execution

- committed focused suites: **12 passed, 0 failed (194 assertions)**;
- independent executable adversarial probe: the correctly rehashed root-description
  forgery was **accepted**, producing the eligible state;
- scope/diff hygiene remained clean; no migration, product, test, database, stable
  local, or `.yellow/` content was changed by this review.

Because the mandatory hostile proof failed, broader PostgreSQL, acceptance, referee,
standing and static success cannot authorize approval and was not represented as a
completed approval run. No ItemList, document, provider, API/UI/local, deployment,
merge, push, Phase7, or application-completion authority follows.
