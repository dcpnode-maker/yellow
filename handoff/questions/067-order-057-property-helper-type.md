# Question 067 — Order 057 malformed-property POST helper type

## Trigger

After the corrected 6/6 focused run, TypeScript rejected the P5 call that passes
`"not-a-uuid"`: the `post` test helper's default `SEED_PROPERTY.id` inferred its parameter as
that UUID literal rather than `string`.

## Requested correction

May `post` declare `property: string = SEED_PROPERTY.id`, preserving the exact runtime
request and malformed-property assertion?

## Status

ANSWERED by the temporary architect in `067-ARCHITECT-RESPONSE.md`; independent review
remains debt.
