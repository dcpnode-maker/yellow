import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`async function ${name}`);
  if (start < 0) throw new Error(`${name} was not found`);
  const end = script.indexOf("\n  function setView", start);
  if (end < 0) throw new Error(`${name} boundary was not found`);
  return script.slice(start, end).trim();
}

function listenerSource(control: "dayCloseRefresh" | "dayCloseRetry"): string {
  const start = script.indexOf(`${control}.addEventListener("click"`);
  if (start < 0) throw new Error(`${control} listener was not found`);
  const end = script.indexOf(";", start);
  return script.slice(start, end + 1);
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type Harness = {
  calls: string[];
  history: string[];
  renders: unknown[];
  load(options?: { businessDate?: string | null; focus?: boolean }): Promise<void>;
  click(control: "refresh" | "retry"): void;
  bumpGeneration(): void;
  setView(view: string): void;
  setProperty(property: string): void;
  ui: {
    content: { hidden: boolean };
    error: { hidden: boolean; message: { textContent: string } };
    status: { textContent: string };
  };
};

function createHarness(request: (url: string) => Promise<unknown>, routeDate: string | null = null): Harness {
  const loader = functionSource("loadDayCloseWorkbench");
  const refreshListener = listenerSource("dayCloseRefresh");
  const retryListener = listenerSource("dayCloseRetry");
  const build = new Function("request", "initialRouteDate", `
    const calls = [], historyCalls = [], renders = [], listeners = {};
    let activeView = "day-close", dayCloseRequestGeneration = 0;
    const propertySelect = { value: "property-a" };
    const dayCloseWorkbench = { setAttribute() {} };
    const dayCloseLoading = { hidden: true };
    const dayCloseContent = { hidden: true };
    const errorMessage = { textContent: "" };
    const dayCloseError = { hidden: true, querySelector() { return errorMessage; } };
    const dayCloseRefresh = { disabled: false, addEventListener(_event, listener) { listeners.refresh = listener; } };
    const dayCloseRetry = { addEventListener(_event, listener) { listeners.retry = listener; }, focus() {} };
    const dayCloseDate = { value: "", disabled: false, replaceChildren() {} };
    const dayCloseStatus = { textContent: "" };
    const dayCloseSeal = { hidden: true };
    const dayCloseSealOpen = { disabled: true };
    const enc = encodeURIComponent;
    const dayCloseRouteDate = () => initialRouteDate;
    const renderDayClose = (result, focus) => {
      renders.push({ result, focus });
      historyCalls.push(result.businessDate);
    };
    const trackedRequest = (url) => { calls.push(url); return request(url); };
    ${loader.replaceAll("await request(", "await trackedRequest(")}
    ${refreshListener}
    ${retryListener}
    return {
      calls, history: historyCalls, renders,
      load: loadDayCloseWorkbench,
      click(control) { listeners[control](); },
      bumpGeneration() { dayCloseRequestGeneration += 1; },
      setView(view) { activeView = view; },
      setProperty(property) { propertySelect.value = property; },
      ui: { content: dayCloseContent, error: Object.assign(dayCloseError, { message: errorMessage }), status: dayCloseStatus },
    };
  `);
  return build(request, routeDate) as Harness;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Order394 executable close-workbench entry behavior", () => {
  for (const change of ["generation", "view", "property"] as const) {
    test(`settled discovery is discarded after independent ${change} change`, async () => {
      const discovery = deferred<{ businessDate: string }>();
      const harness = createHarness(() => discovery.promise);
      const loading = harness.load();
      expect(harness.calls).toEqual([
        "/api/v1/properties/property-a/business-days/close-workbench",
      ]);

      if (change === "generation") harness.bumpGeneration();
      if (change === "view") harness.setView("folios");
      if (change === "property") harness.setProperty("property-b");
      discovery.resolve({ businessDate: "2026-09-02" });
      await loading;

      expect(harness.calls).toHaveLength(1);
      expect(harness.renders).toEqual([]);
      expect(harness.history).toEqual([]);
    });
  }

  test("discovery failure renders a closed error and never requests a dated snapshot", async () => {
    const harness = createHarness(async () => { throw new Error("discovery unavailable"); });
    await harness.load({ focus: true });
    expect(harness.calls).toEqual([
      "/api/v1/properties/property-a/business-days/close-workbench",
    ]);
    expect(harness.renders).toEqual([]);
    expect(harness.history).toEqual([]);
    expect(harness.ui.content.hidden).toBe(true);
    expect(harness.ui.error.hidden).toBe(false);
    expect(harness.ui.error.message.textContent).toBe("discovery unavailable");
    expect(harness.ui.status.textContent).toBe("Close readiness is unavailable. No changes were made.");
  });

  test("a dated deep link bypasses discovery and renders only its exact date", async () => {
    const harness = createHarness(
      async (url) => ({ businessDate: url.match(/business-days\/(\d{4}-\d{2}-\d{2})/)?.[1] }),
      "2026-09-01",
    );
    await harness.load({ focus: true });
    expect(harness.calls).toEqual([
      "/api/v1/properties/property-a/business-days/2026-09-01/close-workbench",
    ]);
    expect(harness.renders).toHaveLength(1);
    expect(harness.history).toEqual(["2026-09-01"]);
  });

  for (const control of ["refresh", "retry"] as const) {
    test(`absent-date ${control} performs fresh discovery before the dated request`, async () => {
      const discovery = deferred<{ businessDate: string }>();
      const harness = createHarness((url) => url.endsWith("/business-days/close-workbench")
        ? discovery.promise
        : Promise.resolve({ businessDate: "2026-09-04" }));
      harness.click(control);
      await settle();
      expect(harness.calls).toEqual([
        "/api/v1/properties/property-a/business-days/close-workbench",
      ]);
      discovery.resolve({ businessDate: "2026-09-04" });
      await settle();
      expect(harness.calls).toEqual([
        "/api/v1/properties/property-a/business-days/close-workbench",
        "/api/v1/properties/property-a/business-days/2026-09-04/close-workbench",
      ]);
      expect(harness.renders).toHaveLength(1);
      expect(harness.history).toEqual(["2026-09-04"]);
    });
  }
});
