import { afterEach, expect, test } from "bun:test";
import { createWorkspaceNavigation, readWorkspaceRoute, softWorkspaceHref } from "../frontend/yellow/src/workspace-navigation";
import { createAuthSession } from "../frontend/yellow/src/auth-session";

const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const BASE = `https://yellow.example/p/${PROPERTY}`;
const controllers: Array<{ dispose(): void }> = [];
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); });

// Controlled History/EventTarget transport; it does not start a browser or fetch.
function browser(initial = `${BASE}/today?lane=in_house`) {
  const events = new EventTarget();
  const document = new EventTarget();
  const entries = [new URL(initial)];
  let index = 0;
  const native: string[] = [];
  const location = {
    get href() { return entries[index]!.href; }, get pathname() { return entries[index]!.pathname; },
    get search() { return entries[index]!.search; }, get hash() { return entries[index]!.hash; },
    assign(href: string) { native.push(href); },
  };
  const history = {
    pushState(_state: unknown, _title: string, href: string) { entries.splice(index + 1); entries.push(new URL(href, location.href)); ++index; },
    back() { if (index > 0) { --index; events.dispatchEvent(new Event("popstate")); } },
    forward() { if (index + 1 < entries.length) { ++index; events.dispatchEvent(new Event("popstate")); } },
  };
  const surface = { location, history, document,
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events) } as unknown as Window;
  return { surface, native, events, document, history, location };
}
function mount(surface: ReturnType<typeof browser>, allowed: () => boolean = () => true) {
  const routes: string[] = [];
  const controller = createWorkspaceNavigation({ browser: surface.surface, propertyId: PROPERTY, canNavigate: allowed, onNavigate: href => routes.push(href) });
  controllers.push(controller);
  return { controller, routes };
}

test("supported workspace and reservation links keep the document and preserve exact deep-link queries/hash", () => {
  const surface = browser(); const { controller, routes } = mount(surface);
  for (const suffix of ["/reservations?view=crs", "/guests?guest=Ana%20Silva#history", "/housekeeping", "/operations", "/today?workspace=rates", "/today?workspace=finance&reservation=stay-7", "/res/stay-7"]) {
    expect(controller.navigate(BASE + suffix)).toBe(true);
    expect(routes.at(-1)).toBe(`/p/${PROPERTY}` + suffix);
  }
  expect(surface.native).toEqual([]);
});

test("Back and Forward publish the correct route without reloading", () => {
  const surface = browser(); const { controller, routes } = mount(surface);
  controller.navigate(BASE + "/reservations?view=crm#groups");
  controller.navigate(BASE + "/today?workspace=finance&reservation=stay-2");
  surface.history.back(); expect(routes.at(-1)).toBe(`/p/${PROPERTY}/reservations?view=crm#groups`);
  surface.history.back(); expect(routes.at(-1)).toBe(`/p/${PROPERTY}/today?lane=in_house`);
  surface.history.forward(); expect(readWorkspaceRoute(routes.at(-1)!)).toMatchObject({ workspace: "reservations", search: "?view=crm" });
  expect(surface.native).toEqual([]);
});

test("expiry/lifecycle/recovery locks block explicit navigation and Back, retaining the accepted URL/workspace", () => {
  const surface = browser(); let allowed = true; const { controller, routes } = mount(surface, () => allowed);
  controller.navigate(BASE + "/res/pending-stay"); allowed = false;
  expect(controller.navigate(BASE + "/today")).toBe(false);
  expect(controller.navigate("/p/other/today")).toBe(false);
  surface.history.back(); expect(surface.location.href).toBe(BASE + "/res/pending-stay");
  expect(routes).toEqual([`/p/${PROPERTY}/res/pending-stay`]); expect(surface.native).toEqual([]);
  allowed = true; surface.history.back(); expect(routes.at(-1)).toBe(`/p/${PROPERTY}/today?lane=in_house`);
});

test("existing group/property beforeunload prevention also protects soft links and history", () => {
  const surface = browser(); const { controller, routes } = mount(surface);
  controller.navigate(BASE + "/reservations?view=groups");
  const protect = (event: Event) => event.preventDefault(); surface.events.addEventListener("beforeunload", protect);
  expect(controller.navigate(BASE + "/today")).toBe(false);
  surface.history.back(); expect(surface.location.href).toBe(BASE + "/reservations?view=groups");
  expect(routes).toEqual([`/p/${PROPERTY}/reservations?view=groups`]);
  surface.events.removeEventListener("beforeunload", protect);
  expect(controller.navigate(BASE + "/today")).toBe(true);
});

test("cross-property, legacy and external destinations stay with native navigation", () => {
  const surface = browser(); const { controller, routes } = mount(surface);
  for (const href of ["/p/other/today?lane=due_in", BASE + "/rates?legacy=1#policies", BASE + "/inventory", BASE + "/today?legacy=1", "https://external.example/", "/client/locanda-homes"]) {
    expect(softWorkspaceHref(href, surface.location.href, PROPERTY)).toBeNull();
    expect(controller.navigate(href)).toBe(true);
  }
  expect(surface.native).toHaveLength(6); expect(routes).toEqual([]);
});

test("route reader matches lanes, reservation detail, guest and finance focus and market-lab admission", () => {
  expect(readWorkspaceRoute(BASE + "/today?lane=due_out")).toMatchObject({ workspace: "today", lane: "due_out" });
  expect(readWorkspaceRoute(BASE + "/res/stay-3")).toMatchObject({ reservationId: "stay-3", workspace: "today" });
  expect(readWorkspaceRoute(BASE + "/today?workspace=finance&reservation=stay-4")).toMatchObject({ workspace: "finance", financeReservation: "stay-4" });
  expect(readWorkspaceRoute(BASE + "/guests?guest=Ana%20Silva")).toMatchObject({ workspace: "guests", guest: "Ana Silva" });
  expect(readWorkspaceRoute(BASE + "/today?workspace=market-lab").workspace).toBe("today");
  expect(readWorkspaceRoute(BASE + "/today?workspace=market-lab", true).workspace).toBe("market-lab");
});

test("one resumed auth session serves multiple links with no extra login/resume or lifetime extension", async () => {
  let clock = 0; const calls: string[] = [];
  const actor = "b2836978-73fe-58f9-b808-8b58cceac1c4", tenant = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
  const token = `header.${btoa(JSON.stringify({ sub: actor, tid: tenant }))}.test`;
  const auth = createAuthSession({ now: () => clock, fetch: async url => {
    calls.push(url);
    return Response.json(url.endsWith("browser/resume") ? { accessToken: token, tokenType: "Bearer", expiresInSeconds: 5, user: { id: actor, displayName: "Operator" } } : { properties: [{ id: PROPERTY, name: "Synthetic", timezone: "UTC" }] });
  } });
  try {
    await auth.bootstrap(PROPERTY);
    const surface = browser(); const { controller } = mount(surface, () => auth.getSnapshot().status === "authenticated");
    for (const suffix of ["/reservations", "/res/stay-7", "/today?workspace=finance", "/housekeeping"]) {
      expect(controller.navigate(BASE + suffix)).toBe(true); expect(await auth.session()).toBe(token);
    }
    expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/me/properties"]);
    clock = 5000; await expect(auth.session()).rejects.toThrow();
    expect(controller.navigate(BASE + "/today")).toBe(false);
    expect(calls).toHaveLength(2); expect(surface.native).toEqual([]);
  } finally { auth.dispose(); }
});

test("dispose removes route listeners without affecting a successor controller", () => {
  const surface = browser(); const first = mount(surface); first.controller.navigate(BASE + "/reservations");
  first.controller.dispose(); const second = mount(surface); second.controller.navigate(BASE + "/housekeeping");
  surface.history.back(); expect(first.routes).toHaveLength(1); expect(second.routes.at(-1)).toBe(`/p/${PROPERTY}/reservations`);
});

test("ordinary internal anchor clicks navigate in-app; modified/new-tab/download and prevented clicks stay native", () => {
  const oldElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
  class Anchor {
    href = BASE + "/housekeeping"; target = ""; rel = ""; download = false;
    closest() { return this; } hasAttribute(name: string) { return name === "download" && this.download; }
  }
  class Click extends Event {
    button = 0; metaKey = false; ctrlKey = false; shiftKey = false; altKey = false;
    constructor(readonly anchor: Anchor) { super("click", { cancelable: true }); }
    override get target() { return this.anchor as unknown as EventTarget; }
  }
  Object.defineProperty(globalThis, "Element", { configurable: true, value: Anchor });
  try {
    const surface = browser(); const { routes } = mount(surface); const anchor = new Anchor();
    for (const mode of ["ctrl", "meta", "shift", "alt", "middle", "new-tab", "download", "prevented", "external"]) {
      const click = new Click(anchor); anchor.target = mode === "new-tab" ? "_blank" : "";
      anchor.download = mode === "download"; anchor.rel = mode === "external" ? "external" : "";
      click.ctrlKey = mode === "ctrl"; click.metaKey = mode === "meta"; click.shiftKey = mode === "shift";
      click.altKey = mode === "alt"; click.button = mode === "middle" ? 1 : 0;
      if (mode === "prevented") click.preventDefault();
      surface.document.dispatchEvent(click); expect(routes).toEqual([]);
    }
    anchor.target = ""; anchor.download = false; anchor.rel = "";
    const click = new Click(anchor); surface.document.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true); expect(routes).toEqual([`/p/${PROPERTY}/housekeeping`]); expect(surface.native).toEqual([]);
  } finally {
    if (oldElement) Object.defineProperty(globalThis, "Element", oldElement); else Reflect.deleteProperty(globalThis, "Element");
  }
});
