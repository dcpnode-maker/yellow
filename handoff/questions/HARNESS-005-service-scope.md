# HARNESS-005 service scope correction

2026-09-28. Independent review found that an orchestration:operate bridge
credential could mint primary/native grants. Correct this before activation.
The primary owner authorizes a narrow technical amendment under D-91: include
`packages/contracts/src/auth.ts` and its focused tests to add a dedicated
`harness:execute` service scope. Permission grants use existing `access:write`,
which is not issued to the bridge. HTTP bridge commands require immutable host
intent matching; ordinary UI orchestration and credentials are unchanged.
No spending, external activation or business-policy change is authorized.
