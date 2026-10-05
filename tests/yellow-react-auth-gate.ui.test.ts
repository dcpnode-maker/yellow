import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createAuthSession } from "../frontend/yellow/src/auth-session";

const componentPath = "../frontend/yellow/src/AuthenticationGate";
const { AuthenticationGate } = await import(componentPath);
const ACTOR = "b2836978-73fe-58f9-b808-8b58cceac1c4";
const TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const properties = [{ id: PROPERTY, name: "Locanda", timezone: "Asia/Riyadh" }];
const token = `header.${btoa(JSON.stringify({ sub: ACTOR, tid: TENANT }))}.test`;
function response(value: unknown) { return new Response(JSON.stringify(value)); }
function location(pathname: string) { return { pathname, search: "", replace() { throw new Error("SSR must not navigate"); } }; }

test("signed-out real gate renders an accessible normal credential form without evaluating workspace children", () => {
  const auth = createAuthSession({ fetch: async () => { throw new Error("SSR must not authenticate"); } });
  let childRenders = 0;
  function Workspace() { ++childRenders; return createElement("p", null, "Operational data"); }
  try {
    const html = renderToString(createElement(AuthenticationGate, { auth, location: location(`/p/${PROPERTY}/today`) }, createElement(Workspace)));
    expect(childRenders).toBe(0);
    expect(html).toContain('for="auth-tenant"');
    expect(html).toContain('for="auth-email"');
    expect(html).toContain('for="auth-password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("Operational data");
    expect(html).not.toContain(token);
  } finally { auth.dispose(); }
});

test("accepted identity sees only actual granted choices when the requested property is unavailable", async () => {
  const auth = createAuthSession({ fetch: async url => response(url.endsWith("local:login") ?
    { accessToken: token, tokenType: "Bearer", expiresInSeconds: 900, user: { id: ACTOR, displayName: "Operator" } } : { properties }) });
  try {
    await auth.signIn({ tenant: "test", email: "test@example.invalid", password: "test-only" });
    const html = renderToString(createElement(AuthenticationGate, { auth, location: location("/p/00000000-0000-0000-0000-000000000999/today") }, createElement("p", null, "Workspace")));
    expect(html).toContain("Choose a property");
    expect(html).toContain("Locanda");
    expect(html).toContain("Asia/Riyadh");
    expect(html).not.toContain("Workspace");
    expect(html).not.toContain('type="password"');
  } finally { auth.dispose(); }
});

test("authenticated and expired render states retain the workspace under the same gate and lock it for renewal", async () => {
  let clock = 0;
  const auth = createAuthSession({ now: () => clock, fetch: async url => response(url.endsWith("local:login") ?
    { accessToken: token, tokenType: "Bearer", expiresInSeconds: 900, user: { id: ACTOR, displayName: "Operator" } } : { properties }) });
  const props = { auth, location: location(`/p/${PROPERTY}/today`) };
  const pending = createElement("p", { "data-recovery": "operation-key-retained" }, "Pending operation");
  try {
    await auth.signIn({ tenant: "test", email: "test@example.invalid", password: "test-only" });
    const signedIn = renderToString(createElement(AuthenticationGate, props, pending));
    expect(signedIn).toContain("operation-key-retained");
    expect(signedIn).toContain("Sign in again");
    expect(signedIn).not.toContain('aria-modal="true"');
    clock = 900000;
    await expect(auth.session()).rejects.toThrow("Sign in");
    const expired = renderToString(createElement(AuthenticationGate, props, pending));
    expect(expired).toContain("operation-key-retained");
    expect(expired).toContain('inert=""');
    expect(expired).toContain('role="dialog"');
    expect(expired).toContain('aria-modal="true"');
    expect(expired).toContain("same account");
    expect(expired).not.toContain(token);
    const card = /<section class="auth-card"([^>]*)>/.exec(expired)?.[1];
    expect(card).toBeDefined();
    const appSource = await Bun.file(new URL("../frontend/yellow/src/App.tsx", import.meta.url)).text();
    const start = appSource.indexOf("  const guardReservationLifecycleFlight = (event:");
    expect(start).toBeGreaterThan(0);
    const guardSource = appSource.slice(start, appSource.indexOf("\n  const dueInQuery", start));
    const javascript = new Bun.Transpiler({ loader: "tsx" }).transformSync(guardSource);
    class AuthRecoveryTarget {
      constructor(readonly attributes: string = card!) {}
      closest(selector: string) {
        return [...selector.matchAll(/\[(data-[a-z-]+)="true"\]/g)].some(match => this.attributes.includes(`${match[1]}="true"`)) ? this : null;
      }
    }
    const makeGuard = new Function("reservationLifecycleBusyRef", "voiceTransferRecoveryLockedRef", "propertyModeNavigationLocked", "Element",
      javascript + "\nreturn guardReservationLifecycleFlight;");
    const originalCardAttributes = card!.replace(/\sdata-(lifecycle-recovery|property-mode-recovery)="true"/g, "");
    for (const [lifecycle, transfer, mode] of [[true, false, false], [false, true, false], [false, false, true], [true, true, true]]) {
      let prevented = 0, stopped = 0;
      const guard = makeGuard({ current: lifecycle }, { current: transfer }, mode, AuthRecoveryTarget);
      guard({ target: new AuthRecoveryTarget(originalCardAttributes), preventDefault() { ++prevented; }, stopPropagation() { ++stopped; } });
      expect({ prevented, stopped }).toEqual({ prevented: 1, stopped: 1 });
      prevented = 0; stopped = 0;
      guard({ target: new AuthRecoveryTarget(), preventDefault() { ++prevented; }, stopPropagation() { ++stopped; } });
      expect({ prevented, stopped }).toEqual({ prevented: 0, stopped: 0 });
    }
  } finally { auth.dispose(); }
});
