import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const start = script.indexOf("function renderReservationAlerts(result)");
const end = script.indexOf("function renderReservationDetail(result)", start);
const code = script.slice(start, end);
const id = "00000000-0000-4000-8000-000000000001";

class Element {
  children: Element[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, (event: unknown) => unknown>();
  className = ""; textContent = ""; value = ""; hidden = false; disabled = false;
  isConnected = true; focused = false;
  classList = { add() {}, remove() {} };
  constructor(readonly tag: string) {}
  append(...items: Element[]) { this.children.push(...items); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  addEventListener(name: string, action: (event: unknown) => unknown) { this.listeners.set(name, action); }
  querySelectorAll(selector: string): Element[] {
    const tags = selector.split(",");
    return this.children.flatMap(child => [...(tags.includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  focus() { this.focused = true; }
  reportValidity() { return true; }
  setCustomValidity() {}
}

function fixture(canManage = true) {
  const requests: Array<{ path: string; options: { headers: Record<string, string>; body: string } }> = [];
  let nextRequest: (path: string, options: unknown) => Promise<unknown> = async () => ({
    alert: { id, active: false }, changed: true, replayed: false,
  });
  const result = { reservation: { reservationId: id, alerts: [
    { alertId: id, active: true, showOn: "checkin", code: "VIP", message: "<img src=x onerror=alert(1)>" },
  ] }, actions: { canManageAlerts: canManage } };
  const context = {
    node: (tag: string, className = "", text = "") => Object.assign(new Element(tag), { className, textContent: text }),
    el: (tag: string) => new Element(tag),
    propertySelect: { value: id }, reservationRouteReservationId: id, reservationDetailData: result,
    reservationDetailGeneration: 3, accessToken: "session-A", reservationDetailDrawer: { hidden: false },
    reservationDetailContent: { hidden: false, querySelector: () => null },
    reservationDetailStatus: { textContent: "" }, pendingKeys: new Map<string, string>(),
    canonicalUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value),
    enc: encodeURIComponent, crypto: { randomUUID: () => "command-key-00001" },
    request: async (path: string, options: { headers: Record<string, string>; body: string }) => {
      requests.push({ path, options }); return nextRequest(path, options);
    },
    loadReservationDetail: async (_reservation: string) => { context.reservationDetailGeneration++; },
  };
  const render = runInNewContext(`${code}\nrenderReservationAlerts`, context) as (input: unknown) => Element;
  const section = render(result);
  return { context, section, requests, respond: (fn: typeof nextRequest) => { nextRequest = fn; } };
}
function deactivate(section: Element) { return section.querySelectorAll("button").find(button => button.textContent === "Deactivate")!; }

test("alert controls are hidden from read-only users and notes are plain text", () => {
  const { section } = fixture(false);
  expect(section.querySelectorAll("button,form")).toHaveLength(0);
  expect(section.querySelectorAll("span")[0]!.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(section.querySelectorAll("span")[0]!.textContent).toContain("VIP");
  expect(code).not.toContain("innerHTML");
});

test("alert command uses scoped URL, empty deactivate body and authoritative refresh", async () => {
  const { section, requests, context } = fixture();
  await deactivate(section).listeners.get("click")!({});
  expect(requests).toHaveLength(1);
  expect(requests[0]!.path).toBe(`/api/v1/properties/${id}/reservations/${id}/alerts/${id}/deactivate`);
  expect(JSON.parse(requests[0]!.options.body)).toEqual({});
  expect(context.pendingKeys.size).toBe(0);
  expect(context.reservationDetailGeneration).toBe(4);
  expect(context.reservationDetailStatus.textContent).toBe("Alert saved. Reservation details refreshed.");
});

test("uncertain retry retains key; malformed success is not shown as saved", async () => {
  const { section, requests, context, respond } = fixture();
  respond(async () => ({ alert: { id, active: true }, changed: true, replayed: false }));
  await deactivate(section).listeners.get("click")!({});
  expect(context.pendingKeys.size).toBe(1);
  expect(context.reservationDetailGeneration).toBe(3);
  respond(async () => ({ alert: { id, active: false }, changed: true, replayed: true }));
  await deactivate(section).listeners.get("click")!({});
  expect(requests).toHaveLength(2);
  expect(requests[1]!.options.headers["idempotency-key"]).toBe(requests[0]!.options.headers["idempotency-key"]);
  expect(context.pendingKeys.size).toBe(0);
});

test("a stale reservation, property or session cannot submit", async () => {
  for (const drift of ["property", "session", "generation", "permission"] as const) {
    const { context, section, requests } = fixture();
    if (drift === "property") context.propertySelect.value = "different-property";
    if (drift === "session") context.accessToken = "session-B";
    if (drift === "generation") context.reservationDetailGeneration++;
    if (drift === "permission") context.reservationDetailData.actions.canManageAlerts = false;
    await deactivate(section).listeners.get("click")!({});
    expect(requests).toHaveLength(0);
  }
});

test("double click runs one command; a late response cannot refresh another session", async () => {
  const { section, context, requests, respond } = fixture();
  let release!: (value: unknown) => void;
  respond(() => new Promise(resolve => { release = resolve; }));
  const first = deactivate(section).listeners.get("click")!({});
  await deactivate(section).listeners.get("click")!({});
  expect(requests).toHaveLength(1);
  expect(section.attributes.get("aria-busy")).toBe("true");
  context.accessToken = "new-session";
  release({ alert: { id, active: false }, changed: true, replayed: false });
  await first;
  expect(context.reservationDetailGeneration).toBe(3);
  expect(context.reservationDetailStatus.textContent).toBe("");
});

test("editor has labelled bounded fields, progressive disclosure and keyboard targets", () => {
  const { section } = fixture();
  expect(section.querySelectorAll("summary")[0]!.textContent).toBe("Add an alert");
  expect(section.querySelectorAll("label").map(label => label.textContent)).toEqual(["Staff note", "Code (optional)", "Show this alert"]);
  expect(section.querySelectorAll("option").map(option => option.value)).toEqual(["always", "checkin", "checkout"]);
  expect(section.querySelectorAll("p").some(item => item.attributes.get("aria-live") === "polite")).toBe(true);
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
  expect(css).toContain(".reservation-alerts :is(input,textarea,select,button,summary)");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain(".reservation-alerts :is(button,summary):focus-visible");
});

function fillEditor(section: Element, note = "  Arrival\nPlease call the guest.  ", codeValue = " VIP ") {
  section.querySelectorAll("textarea")[0]!.value = note;
  section.querySelectorAll("input")[0]!.value = codeValue;
  section.querySelectorAll("select")[0]!.value = "checkout";
  return () => section.querySelectorAll("form")[0]!.listeners.get("submit")!({ preventDefault() {} });
}

test("create submits trimmed note/code and selected trigger, then refreshes authoritative detail", async () => {
  const { section, requests, context, respond } = fixture();
  respond(async (_path, options) => ({ alert: { id, ...JSON.parse((options as { body: string }).body), active: true }, changed: true, replayed: false }));
  await fillEditor(section)();
  expect(requests).toHaveLength(1);
  expect(requests[0]!.path).toBe(`/api/v1/properties/${id}/reservations/${id}/alerts`);
  expect(JSON.parse(requests[0]!.options.body)).toEqual({ code: "VIP", message: "Arrival\nPlease call the guest.", showOn: "checkout" });
  expect(requests[0]!.options.headers["idempotency-key"]).toBe("command-key-00001");
  expect(context.pendingKeys.size).toBe(0);
  expect(context.reservationDetailGeneration).toBe(4);
});

test("create uncertain retry keeps the key and blank optional code becomes null", async () => {
  const { section, requests, context, respond } = fixture();
  const submit = fillEditor(section, "A note", "   ");
  respond(async () => { throw new Error("Connection interrupted"); });
  await submit();
  expect(context.pendingKeys.size).toBe(1);
  expect(context.reservationDetailGeneration).toBe(3);
  respond(async (_path, options) => ({ alert: { id, ...JSON.parse((options as { body: string }).body), active: true }, changed: true, replayed: true }));
  await submit();
  expect(requests).toHaveLength(2);
  expect(JSON.parse(requests[0]!.options.body).code).toBeNull();
  expect(requests[1]!.options.headers["idempotency-key"]).toBe(requests[0]!.options.headers["idempotency-key"]);
  expect(context.pendingKeys.size).toBe(0);
});

test("blank create notes and stale sessions do not submit", async () => {
  const { section, requests, context } = fixture();
  await fillEditor(section, " \n ")();
  expect(requests).toHaveLength(0);
  const submit = fillEditor(section);
  context.accessToken = "session-B";
  await submit();
  expect(requests).toHaveLength(0);
});

test("double create submits once and ignores a response after property navigation", async () => {
  const { section, context, requests, respond } = fixture();
  let release!: (value: unknown) => void;
  respond(() => new Promise(resolve => { release = resolve; }));
  const submit = fillEditor(section);
  const first = submit();
  await submit();
  expect(requests).toHaveLength(1);
  context.propertySelect.value = "another-property";
  release({ alert: { id, ...JSON.parse(requests[0]!.options.body), active: true }, changed: true, replayed: false });
  await first;
  expect(context.reservationDetailGeneration).toBe(3);
  expect(context.reservationDetailStatus.textContent).toBe("");
});
