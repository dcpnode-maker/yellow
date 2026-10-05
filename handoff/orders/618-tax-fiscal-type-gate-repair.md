# Order 618 — Tax-fiscal type gate repair

## Scope

- Restore the missing tax-fiscal module surfaces referenced by existing India GST tests.
- Keep the repair source-only and bounded to compile/type safety plus focused tax-fiscal unit proof.
- Preserve tenant transaction safety in the local `Database` helper by using transaction-local tenant context and the app role.

## Out of scope

- Adding India GST production migrations.
- Claiming the gated `india-gst-registration-at-time-of-supply` PostgreSQL integration proof, because this checkout does not contain those future India GST tables in the baseline schema.
- Public demo data/runtime mutation.

## Acceptance

- `bun run typecheck` passes.
- `bun run boundaries` passes.
- Focused source-level tests for invoice timeliness and the hotel-math contract pass.
- No migration, public DB or live app state is changed.
