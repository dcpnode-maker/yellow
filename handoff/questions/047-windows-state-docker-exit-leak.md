# Question 047 — Windows state proof inherits Docker probe exit code

**Status:** RESOLVED by `047-ARCHITECT-RESPONSE.md` under D-95/D-115
**Trigger:** PR #22 Windows state job, run 32506733148

The Windows job completed every inline transition assertion without a thrown diagnostic,
then exited 1. A native local reproduction that shadows `docker info` with a failing
probe makes an otherwise complete `state.ps1` return `LASTEXITCODE=1`. The script treats
Docker availability as optional but leaves the native probe's exit code in the caller.
May a separate one-file correction explicitly return native success after the report
completes, while preserving real terminating failures and every output/count rule?
