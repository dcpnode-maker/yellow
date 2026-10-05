## conclusion

**CHANGES REQUIRED.** Fresh independent Tier-3 review of exact candidate `16c69f7f84f6f43389157d84fb05cd27214bdbe7` against approved base `809928fca3a7893441c67a876f5c48529a8c9585` found a statutory predecessor-revalidation defect and a whitespace failure. This reviewer did not implement Order 294, reviewed the candidate in a clean detached worktree, read `PROJECT.md`, `AGENTS.md`, the Yellow compliance/entity/PostgreSQL skills, Orders 291 and 294, the approved Order 291 review, and D-784/D-785 before executing the proof below.

## evidence

CGST Act section 13(2)'s Explanation (ii) defines the payment-receipt date as the earlier of the supplier-books entry and bank-credit dates; it does not privilege either ordering ([India Code, current consolidated Act, p. 26](https://www.indiacode.nic.in/indiacode/bitstream/123456789/15689/1/A2017-12.pdf)). The approved Order 291 contract makes the same requirement explicit: its database invariant is `payment_receipt_date = LEAST(supplier_books_entry_date, supplier_bank_credit_date)` and its pre-registered proof requires that source-date order in either direction yields the statutory earlier date (Order 291 lines 46-50 and 101-104). I executed the actual candidate resolver with a complete canonical full-attribution row whose books date was `2043-06-16`, bank-credit date and stored receipt date were `2043-06-15`, and all service/payment/invoice IDs, hashes, sources, legal literals, amount and currency were valid. It rejected the row with `IndiaGstAccommodationTimeOfSupplyConflictError: evidence conflicts with complete predecessor lineage`. That is a valid Order 291 payment-receipt case, not malformed or cross-lineage evidence.

The candidate/base diff is otherwise scoped to Order 294's declared migration-free surface, but `git diff --check 809928f..16c69f7f` fails for the exact added trailing-space line in `handoff/order294-intentional-red.txt`.

## files_and_lines

- `src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts:57`, `build`: `books > bank` rejects the legally permitted books-later/bank-earlier ordering before checking that `paymentDate` is the earlier value.
- `handoff/order294-intentional-red.txt:6`: exact candidate diff contains trailing whitespace.
- `tests/india-gst-accommodation-time-of-supply.test.ts`: its payment-invariant hostility coverage tests an invalid later books date against the receipt date, but has no valid books-later/bank-earlier acceptance case, so the focused suite misses the blocker.

## tests_or_checks

- Focused Order 294 intentional-red and hostile suite: `9 pass / 0 fail / 118 expectations`.
- Disposable hostile reproduction: executed the real resolver with the valid inverse source-date ordering above; it reproduced the rejection.
- `bun run typecheck`: passed.
- `bun run boundaries`: passed (`117 TypeScript files scanned`).
- `git diff --check 809928f..16c69f7f`: failed only at `handoff/order294-intentional-red.txt:6` for trailing whitespace.
- Per the review-recovery scope, I did not rerun lengthy database gates after reproducing this decisive composer blocker. No Docker, stable local service, migration, or product/test/governance file was mutated; the temporary detached worktree was clean before this sole review-record change and is removed after this commit.

## risks

The composer fails closed for a valid statutory payment-receipt ordering. Consequently an ordinary service whose bank credit precedes supplier-books entry cannot obtain the required section 13 result, despite the approved predecessor admitting that evidence. The focused tests give a false sense of coverage because they omit the accepted inverse ordering. The whitespace failure independently prevents a clean candidate diff.

## recommended_parent_action

Do not approve, merge, or promote `16c69f7f`. Return Order 294 to its implementer to remove the asymmetric `books > bank` rejection, retain only the equality of `paymentReceiptDate` to the date-only minimum of the two predecessor dates, and add executable acceptance coverage for both source-date orderings plus equal dates. Remove the intentional-red trailing whitespace, rerun focused and required live predecessor proof, then request a new independent Tier-3 review.
