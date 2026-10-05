# Question 115 — Order 069 atomic release persistence and lifecycle

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 069

May one new `rate_plan_release` extension type be the complete immutable publish unit, referencing
exact Order 065/066 draft versions and embedding canonical Order 067/068 specs with tagged decimal
minor units; then use the documented extension draft→active→retired lifecycle, existing approval
primitive, facts and existing `extension.activated` event for conflict-free latest-version publish
and versioned undo, with no migration?

## Answer

Yes. This is the natural use of the existing lifecycle and avoids parallel rate tables. Content is
insert-only and every lifecycle status change is evidenced. Publication must re-run the exact preview,
bind approval to content and preview hashes, reject a non-latest draft, serialize per tenant/plan and
atomically retire/activate/fact/event. Undo copies historical content to a new draft; it never changes
or reactivates the old row. Package is a composition wrapper, while RMS/API remains unpublishable
until Order 070 supplies attributable recommendations and fallback.

No new event or state exists: `extension.activated` and draft→active→retired are already documented.
No schema constraint is needed because every activation path is one scoped service using the same
transaction advisory lock; the generic extension API has no activation route.
