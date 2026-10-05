# Order: temporary automatic sign-in for the React public preview

**Purpose:** Restore the temporarily requested auto-login behavior for Yellow's mobile-first React preview while preserving the actual configured database actor, grants, bearer validation, browser Origin checks and session cookie. This is a source patch proposal for root admission; it has not been applied to the candidate.

## Exact scope

Candidate baseline: `E:\YellowWorkspace\Worktrees\phase-7-resource-receiving-20261001`, HEAD `35d2f1c2f1dfba3c6f6353103bdc91e3526b982b`.

Only these paths may change:

- `src/app.ts`
- `src/server.ts`
- `frontend/yellow/src/auth-session.ts`
- `tests/yellow-react-auth-session.test.ts`
- `tests/browser-session-http.test.ts`

Before and proposed SHA-256 values are in `freeze.json`. Apply `preview-autologin.patch` only if all before hashes still match and the candidate remains clean at the pinned HEAD.

## Behavior and boundary

The separate opt-in is `YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN=1`. Server startup accepts it only for an operator workbench bound to loopback, with an explicit browser-session origin policy, and the code-owned synthetic account `yellow-demo` / `preview.operator@yellow.local`. Its password comes from the existing server-only `YELLOW_LOCAL_REVIEW_PASSWORD` variable. The loader refuses any mismatched account, hosted-provider-only mode, non-loopback host, missing password or missing/empty browser-session origin policy. Keep `YELLOW_LOCAL_REVIEW_PREFILL=0`; the legacy prefill helper remains unchanged.

React first calls existing browser resume. Only an initial 401/404 and the meta opt-in may call `POST /api/v1/auth/preview:enter`. This request is the existing browser-session `{}` + marker + same-origin/no-store contract. The server route independently requires the flag, server-held credentials, exact synthetic tenant/email, browser admission and an exact empty JSON object; it calls the canonical `OperatorHttpApi.login` and `BrowserSessionHttpApi.captureCredentialLogin`, deriving login-guard identity only from the peer address. Credentials never enter the browser document, script, request body, URL or storage.

The ordinary login response follows existing React identity parsing and the fresh `/api/v1/me/properties` read. Existing token-generation, requested-property, token TTL and memory-only rules remain in force. Normal cookie resume, all ordinary `createAuthSession()` instances, manual sign-in, explicit sign-out, expiry behavior, business operations, UI theme and navigation remain unchanged. Sign-out waits for any in-flight preview credential response before clearing the browser cookie; later bootstrap in that document cannot auto-enter again.

## Validation

On the isolated artifact verification worktree, run:

- `bun test tests/yellow-react-auth-session.test.ts tests/browser-session-http.test.ts`
- `bun run typecheck`

The patch's focused tests cover resume-first behavior, 401/404-only fallback, normal login response and live grants, default-off instances, successful cookie resume, sign-out race, real browser-session admission/cookie wrapping, fixed account and loopback/origin configuration, forwarded-IP spoof resistance, disabled HTML byte equality, and no credential in HTML/response. The built Vite output and hashes are listed in `asset-manifest.json`.

This proof does not include a real database actor/property-grant review, live server, or browser. Before activating the flag, root must verify the configured synthetic account is active and grants only the intended preview properties using the separate authorized live proof. No business command should be executed as part of sign-in validation.

## Apply sequence

1. Compare every `beforeSha256` and verify the clean pinned candidate identity.
2. Inspect `preview-autologin.patch`; `git apply --check` must pass.
3. Apply exactly the patch; verify every `afterSha256` and confirm no paths outside the five-file allowlist changed.
4. Run the focused tests and typecheck on the admitted candidate; rebuild the React assets from that candidate and record exact outputs.
5. Only after independent source review, root may enable the separate flag on the isolated loopback runtime. Keep the existing real database, actor grants and browser-session origin/cookie settings. Never print the password or place it in command arguments.
