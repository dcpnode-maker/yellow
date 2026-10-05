# Question 062 — Order 055 foreign-property helper type

## Trigger

After the focused runtime restart passed 7/7, `bun run typecheck` rejected the P5
foreign-property call. The test helper's default `property = SEED_PROPERTY.id` inferred
the parameter as that UUID literal instead of `string`, so the deliberately foreign UUID
was not assignable. No product file failed compilation.

## Proposed correction

Annotate only the test helper parameter as `property: string = SEED_PROPERTY.id`, matching
the adjacent `release` helper and earlier operator proofs. Change no runtime behavior or
assertion. Recreate the database, restart all seven focused tests, then restart typecheck
and boundaries.

## Hard-floor status

No correction followed the compiler failure. Temporary architect response required
under D-92.
