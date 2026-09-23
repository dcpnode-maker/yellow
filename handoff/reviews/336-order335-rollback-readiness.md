# Orders 335–336 different fresh independent non-operating Tier 3 rereview

**Disposition: APPROVE**

**Reviewer:** Codex `/root/order335_fresh_rereview`, different fresh independent
non-operating Tier 3 reviewer

**Governance head:** `2b5a663`

**Runtime source:** `15516170433b008411bb07e13c8001f823f8e16d`

**Running image:** `sha256:b826c789d413410db1f2bdbb67540feb15ba72d468a730760e77ec4c7da2f059`

## Finding

No finding. D940's executable healthy restart supersedes D938's readiness issue.
The exact retained Order333 rollback personally reached sole healthy3000/restart0/
exit0 during the controlled drill, proving it is executable. Its own shutdown log
explicitly reports `SIGTERM (Polite quit request)` while Docker repeatably records
exit139. The 139 is therefore retained as the observed Bun/Docker stop mapping, not
rewritten as exit0 and not treated as evidence that the rollback cannot start.

## Personally reproduced read-only evidence

- `yellow-order335-app` is the sole healthy publisher on127.0.0.1:3000,
  restart0/exit0, with the exact source/image above, inherited
  `yellow_order311_local` network, loopback bind and wget health contract.
- Exact Order333 is retained stopped/restart0/exit139. Its current log contains two
  explicit polite-SIGTERM shutdown records, coherent with D940's one-at-a-time
  start-health/stop/restore evidence. No container was operated.
- Current and rollback each have exactly24 environment entries and identical
  secret-safe sorted-value SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  PostgreSQL/provider/Valkey are healthy;3000,3001,6389 are loopback listeners and
  obsolete3002/3123/3188/3318 are closed.
- Focused Room-outages,arrival/departure,Separate-charges,Folio/app-bar proof passed
  9/0 with102 assertions in the available five-file focused subset. D938's exact
  protected login,2 properties,24/24 no-store routes,status310/311/91/P7/11,live
  Room outages/prior contracts,72/72 browser matrix,console/errors0,network-write0
  and focused15/0(162) evidence remains coherent with the unchanged exact runtime.
- A reviewer-owned `BEGIN READ ONLY`/`ROLLBACK` snapshot passed59 migrations,
  110 public base tables,2 views,100 policies and party/contact-point/party-role/
  fact-log/outbox counts8/0/8/75/22. This matches D938 before/after evidence and
  business mutations remain0.

## Boundary

**APPROVE** exact Order335 local reflection plus Order336 rollback readiness. This
rereview was strictly non-operating and grants no data,credential,status,permission,
authority,post310,public,merge,push,deployment,rollback deletion or broader product,
financial or statutory authority.
