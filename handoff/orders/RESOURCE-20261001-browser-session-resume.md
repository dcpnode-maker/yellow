# Browser session continuity after normal credential login

## Authority and base

Root authorized reversible internal proposal work to preserve the approved original navigation flow after normal credential sign-in. This is an artifact-only proposal awaiting root's exact source-scope admission before implementation. Candidate/canonical, runtime/public assets, database/roles/migrations, credentials, dependencies/locks and Git actions remain outside this lane.

Base is clean444072 plus the independently reviewed combined auth/reference UI freeze `ab0d4ae8bbaa1cab4cd3f1251683706fabf745178a5ff0b8f681c50ba501cc31`. Root is integrating those41 paths separately. This proposal retains the original shell/navigation/design and every domain command, identity/property lock and recovery marker. Root owns integration/runtime configuration and independent review.

## Exact proposed scope

- src/contexts/identity/browser-session.ts (new, active actor identity read through existing Database tenant transaction)
- src/http/browser-session.ts (new, bounded cookie transport, login response capture, resume and logout)
- src/app.ts (narrow existing local-login wrapper and two explicit browser session routes)
- src/server.ts (explicit origin/policy configuration and existing token/DB wiring)
- frontend/yellow/src/auth-session.ts (memory-only bootstrap/adoption/logout generation)
- frontend/yellow/src/AuthenticationGate.tsx (single initial bootstrap before lazy App, actual logout and removal of the interim navigation warning)
- tests/browser-session-http.test.ts (new, real signed JWT/route/cookie/expiry/origin/authority proof)
- tests/browser-session-identity.test.ts (new, active actor tenant-bound reader proof)
- tests/yellow-react-browser-session.test.tsx (new, fresh page resume, remaining lifetime, actor/grant/currentness and gate proof)

No LocalLoginService/password/TokenSigner/BearerTenantResolver/kernel changes. No schema/session table, CORS allowance, cookie API authorization, automatic-demo fallback, token storage API or source outside these nine paths.

## Existing-source feasibility

Credential POST local:login already returns signedJWT, Bearer, expiresInSeconds900 and user identity; password verification and rate limits are established. Hs256TokenSigner retains signed `tid/sub/scp/exp`; issue is always900 seconds. Current verify permits60 seconds after exp as clock-skew tolerance. Resume must additionally require `now < exp`, return the exact same token bytes with positive remaining seconds, and never call issue or refresh the cookie. Existing BearerTenantResolver reads only Authorization; unchanged ordinary API requests cannot gain identity from a cookie.

The new identity reader uses existing Database.withTenantTransaction with transaction-local tenant setting and app_role. It reads only the exact active app_user for verified tid/sub and returns id/displayName. The client then fetches existing authoritative me/properties using the resumed memory bearer before admitting lazy App. DB grants/RBAC/RLS and scopes remain current server authority.

## Cookie and origin contract

Cookie name `__Host-yellow-browser-session`, host-only (no Domain), Path=/, HttpOnly, Secure, SameSite=Strict and Max-Age no longer than the original signed token's remaining life. Only an explicit browser credential-login request with a custom same-origin marker and exact configured Origin may receive it. Existing native credential login without the browser marker retains its current bearer-only contract. Browser local-login, resume and logout reject cross-origin/null Origin, conflicting Fetch Metadata, wrong Content-Type/shape, query strings and unsupported transport. No wildcard CORS or trusted forwarded-origin header is added. Duplicate same-name cookies are rejected; signature/issuer/audience/claim validation is the existing signer.

Resume is POST `/api/v1/auth/browser:resume`, JSON {}, explicit custom header, same-origin credentials and no-store response. Missing/invalid/expired cookie is unauthenticated. Valid cookie is verified, active actor is read, then exact originalJWT and positive remainingTTL are returned. Resume does not set/extend a cookie. Logout is POST `/api/v1/auth/browser:logout` with the same browser-origin constraints; it expires that cookie using identical attributes and sends no-store. Clearing the cookie does not revoke already-issued bearer tokens in other tabs; their established lifetime remains bounded900 seconds.

Configured HTTPS origin is required for production. Development may explicitly admit `http://localhost:<port>` only when a separate localhost-HTTP option is enabled, the listener is loopback and the actual peer is loopback. Secure is never removed. `http://127.0.0.1`, remote HTTP, implicit localhost aliases and forwarded-header trust are not fallbacks. Root would need to use localhost for this bounded laptop policy or an actual approved HTTPS origin; reverse-proxy transport admission is separate if the actual Request URL differs. Cookie browser acceptance remains unverified until approved browser access succeeds.

MDN documents Secure cookies' localhost exception and notes Safari does not support it: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies . Host prefix attributes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie . SameSite is not the sole CSRF control; exact Origin and a non-simple custom header are required per the primary OWASP guidance: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html . These references support policy, not actual browser acceptance.

## Client continuity and recovery

The gate performs one coalesced initial bootstrap. It never mounts lazy App or fetches operational data before verified identity and actual property grants. Cookie handling is browser-managed; JS keeps only the returned bearer in memory and does not read/write localStorage/sessionStorage/document.cookie. A resume lifetime is anchored conservatively to request start and cannot reset900 seconds. Expiry still demands credentials. Existing same-actor AND tenant renewal/current-property membership checks apply before commit, and late responses cannot overwrite a newer generation.

Logout increments the generation, stops token timers and clears the memory bearer immediately while retaining the existing principal/recovery binding and mounted work in a locked state. It clears the browser cookie through the explicit endpoint. A failed logout transport is reported and does not claim cookie removal. Pending mutation proposals/keys are not cleared or rebound to another actor; same-principal credential renewal remains required in the retained document. The active module's existing locks and recovery selectors stay unchanged.

## Meaningful proof and freeze

Use real signer tokens with controlled clocks. Prove exact cookie attributes, no cookie on failed/native login, duplicate/tampered/expired/wrong-audience cookie rejection, strict exp despite signer skew, repeated bootstrap's identicalJWT/no issue/no Set-Cookie/remainingTTL reduction, exact-origin/custom-header/HTTPS and loopback policy, logout expiry, and ordinary cookie-only API 401. Prove active actor tenant/id predicates through the existing Database transaction boundary with no schema/write changes.

Factory tests create a fresh memory session representing module navigation, resume identity/grants and retain requested route. Prove wrong actor/tenant or revoked property cannot replace mounted recovery state, coalesced bootstrap and late login/resume/logout generations, conservative expiration, failure without demo/storage fallback and password sign-in after expiry. Retain all prior auth/domain/reference UI tests and compiled lazy-entry VM proof; run strict root/frontend types, boundaries and real Vite asset graph with shared dependencies only. Preserve original failures and exact protected-path/backprojection hashes. No browser bypass/headless/live claim. Root must independently review and execute proof before integration.

## Root admission amendment
Root admits the nine paths above, plus src/contexts/identity/index.ts for public context exports and src/http/security-headers.ts for microphone=(self) only. All other permission-policy directives remain exact; browser gestures/disclosure/draft approval remain required. Root admits reversible internal artifact implementation and requires independent backend/source/header review before integration. No candidate, DB or runtime changes.

Root admission amendment: actual HTTP and ecosystem flow evidence authorizes frontend/yellow/src/App.tsx only for finance alias to existing guarded cashiers mapping; src/app.ts operations route must use current publicOperatorHtml selection, preserving legacy option. No preview metadata HTTP routes are added. New tests must exercise actual routes and captured guarded workflow. Candidate root now 326e80; isolated overlay retains exact matching restored41 base.

Actual Elysia proof correction: new sibling colon endpoints conflict in Memoirist parameter parsing. New endpoints use literal /api/v1/auth/browser/resume and /api/v1/auth/browser/logout; existing local:login is unchanged. session-second.log retains original composition RED. No router/dependency changes.
