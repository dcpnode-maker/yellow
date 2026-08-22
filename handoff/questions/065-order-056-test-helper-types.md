# Question 065 — Order 056 test-helper types

**Status:** ANSWERED
**Order:** 056
**Raised by:** OpenAI Codex, builder

The first implemented focused proof passed 6/6, then `tsc --noEmit` rejected two test-only
expressions. The `place` helper inferred its default seed tenant/property/actor UUIDs as
literal parameter types, preventing P2's deliberate tenant-B call. P4's untyped tagged SQL
result selected a Bun overload incompatible with `toEqual([{status:"expired"}])`.

May the three helper parameters receive explicit `string` annotations and the P4 query
receive the exact `Array<{status:string}>` result type, with product code and assertions
unchanged, followed by a complete focused/typecheck/boundary restart?
