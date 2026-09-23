# Question 060 — Order 054 JSON boundary type

## Trigger

The standing self-check stopped at `bun run typecheck`. The focused runtime proofs
were green, but `OperatorHttpApi.setOosSellability` passed the named
`InventoryPolicy` interface directly into `PostgresIdempotency`. TypeScript does not
assign named interfaces without an index signature to the kernel's recursive
`JsonValue`, even though this value contains only strings.

## Proposed correction

Use the existing `jsonValue` HTTP-boundary adapter around the returned policy, matching
the adjacent operational-block commands. Do not cast, change the domain interface,
loosen `JsonValue`, or change response bytes. Restart the full standing self-check from
`bun install --frozen-lockfile` after the correction.

## Hard-floor status

No product correction followed the compiler failure. Temporary architect response
required under D-92.
