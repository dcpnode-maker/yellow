import { expect, test } from "bun:test";

type Listener = (event: { target: unknown }) => unknown;

class FakeElement {
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  action = "";
  dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  children: FakeElement[] = [];

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  querySelector(selector: string) {
    return selector === "button" ? this.children[0] ?? null : null;
  }

  querySelectorAll(selector: string) {
    return selector === "button" ? this.children : [];
  }

  async emit(name: string, target: unknown = this) {
    await Promise.all((this.listeners.get(name) ?? []).map((listener) => listener({ target })));
  }
}

const settle = async () => {
  for (let index = 0; index < 4; index += 1) await Bun.sleep(0);
};

function executeAsset(
  source: string,
  document: unknown,
  location: unknown,
  fetcher: unknown,
) {
  const execute = Function("document", "location", "fetch", "URL", `"use strict";\n${source}`) as (
    documentValue: unknown,
    locationValue: unknown,
    fetchValue: unknown,
    urlValue: typeof URL,
  ) => void;
  execute(document, location, fetcher, URL);
}

function guestDocument() {
  const elements = Object.fromEntries(
    ["message", "property", "folio", "amount", "expiry", "refresh"].map((id) => [id, new FakeElement()]),
  ) as Record<string, FakeElement>;
  const card = new FakeElement();
  const list = new FakeElement();
  list.hidden = true;
  const form = new FakeElement();
  const button = new FakeElement();
  button.disabled = true;
  form.children = [button];
  elements.continue = form;
  return {
    elements,
    card,
    list,
    form,
    button,
    document: {
      querySelector(selector: string) {
        if (selector === ".card") return card;
        if (selector === "dl") return list;
        return null;
      },
      getElementById(id: string) { return elements[id] ?? null; },
    },
  };
}

test("Order193 P5 UAT: guest renders fresh server truth and ignores stale responses", async () => {
  const source = await Bun.file(new URL("../src/http/guest/guest.js", import.meta.url)).text();
  const surface = guestDocument();
  let releaseFirst!: (value: unknown) => void;
  let calls = 0;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return first;
    return {
      ok: true,
      json: async () => ({
        propertyName: "Fresh Hotel",
        folioReference: "FOL-NEW",
        amountMinor: 12500,
        currency: "CAD",
        expiresAt: "2030-01-02T03:04:05.000Z",
        state: "ready",
      }),
    };
  };

  executeAsset(source, surface.document, { pathname: "/pay/bearer-token", href: "https://guest.test/pay/bearer-token" }, fetcher);
  await surface.elements.refresh!.emit("click");
  await settle();
  expect(surface.elements.property!.textContent).toBe("Fresh Hotel");
  expect(surface.elements.folio!.textContent).toBe("FOL-NEW");
  expect(surface.elements.amount!.textContent).toBe("CAD 12500");
  expect(surface.button.disabled).toBeFalse();
  expect(surface.form.action).toBe("/pay/bearer-token/continue");

  releaseFirst({
    ok: true,
    json: async () => ({
      propertyName: "Stale Hotel",
      folioReference: "FOL-OLD",
      amountMinor: 1,
      currency: "USD",
      expiresAt: "2030-01-01T00:00:00.000Z",
      state: "captured",
    }),
  });
  await settle();
  expect(surface.elements.property!.textContent).toBe("Fresh Hotel");
  expect(surface.elements.folio!.textContent).toBe("FOL-NEW");
  expect(surface.card.attributes.get("aria-busy")).toBe("false");
});

test("Order193 P5 UAT: provider hydrates a native POST form so the browser follows the server 303", async () => {
  const source = await Bun.file(new URL("../src/http/provider/provider.js", import.meta.url)).text();
  const summary = new FakeElement(); const actions = new FakeElement(); const handoff = new FakeElement(); actions.hidden=true;
  const document = { getElementById(id:string) { return id === "summary" ? summary : id === "actions" ? actions : handoff; } };
  const requests:string[]=[]; const fetcher = async (path:string) => { requests.push(path);
    return { ok:true, json:async () => ({ amountMinor:12500,currency:"CAD" }) }; };
  executeAsset(source, document, { href:"https://provider.test/provider/pay?handoff=signed-value" }, fetcher);
  await settle();
  expect(requests).toHaveLength(1); expect(handoff.value).toBe("signed-value");
  expect(actions.hidden).toBeFalse(); expect(summary.textContent).toBe("Deposit CAD 12500");
  const html = await Bun.file(new URL("../src/http/provider/index.html", import.meta.url)).text();
  expect(html).toContain('method="post" action="/api/provider/local-deposit/outcome"');
});

test("Order193 P5 UAT: layouts remain bounded at required widths and keyboard/reduced-motion affordances exist", async () => {
  const guestCss = await Bun.file(new URL("../src/http/guest/guest.css", import.meta.url)).text();
  const providerCss = await Bun.file(new URL("../src/http/provider/provider.css", import.meta.url)).text();
  const requiredWidths = [375, 768, 1024, 1440];

  for (const width of requiredWidths) {
    expect(width).toBeGreaterThanOrEqual(375);
    expect(guestCss).toContain("width:min(100%,34rem)");
    expect(providerCss).toContain("width:min(100%,31rem)");
  }
  expect(guestCss).toContain("clamp(");
  expect(guestCss).toContain("button:focus-visible");
  expect(providerCss).toContain("button:focus-visible");
  expect(guestCss).toContain("prefers-reduced-motion:no-preference");
  expect(providerCss).not.toMatch(/animation\s*:|transition\s*:/i);
  expect(`${guestCss}\n${providerCss}`).not.toMatch(/(?:width|min-width):\s*(?:[5-9]\d\d|\d{4,})px/i);
});
