/** Independent Q266/Q267 browser proof: real assets, synthetic API, owned loopback only. */
import { expect, test } from "bun:test";
import { browser, browserControls, withBrowser } from "./helpers/market-browser";
import { createApp } from "../src/app";
import { buildMarketSourcePlan, type MarketCompsetPlanConditions } from "../src/contexts/distribution";
import type { OperatorHttpApi } from "../src/http/operator";

const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const propertyA = id(472), propertyB = id(473);
function discovery(label: string, large = false) {
  const count = large ? 40 : 30;
  return { discovery: { snapshots: [{ logicalId: "riyadh", sha256: "a".repeat(64),
    capturedAt: "2026-09-13T08:03:04.630Z", region: { minimumLatitude: 24.707, maximumLatitude: 24.709, minimumLongitude: 46.676, maximumLongitude: 46.678 },
    completeness: { scope: "publisher-range-extract-all-places", status: "complete", sourceRows: count, returnedRecords: count, rejectedRows: 0 },
    records: Array.from({ length: count }, (_, n) => ({
      provenance: { source: "Overture", release: "2026-08-19.0", schema: "places/place", recordId: "source-" + n + (large ? "-" + "ग".repeat(200) : ""), attribution: "Synthetic source attribution" },
      name: n === 0 ? `${label} <img src=x onerror="globalThis.injected=true">` : `${label} source ${n}`,
      coordinates: { latitude: 24.7071 + n * 0.00004, longitude: 46.6761 + n * 0.00004 },
      address: null, operatingStatus: "unknown", websites: [], categories: ["hotel"],
    })),
  }] } };
}

/** Full historical evidence, never a version-only mock or a current-catalog substitution. */
function savedFixture(propertyNode: string, version: number, historical = false, comparatorCount = 2) {
  const snapshot = discovery("Saved historical", comparatorCount > 29).discovery.snapshots[0]!;
  const evidence = (index: number) => {
    const record = structuredClone(snapshot.records[index % snapshot.records.length]!);
    record.provenance.recordId = `saved-${index}`;
    record.name = index === 0 ? "Confirmed own property" : `Persisted comparator ${index}`;
    return { reference: { logicalId: historical ? "archived-release" : snapshot.logicalId,
      sha256: historical ? "b".repeat(64) : snapshot.sha256, sourceRecordId: record.provenance.recordId },
      record, capturedAt: historical ? "2026-08-01T08:00:00.000Z" : snapshot.capturedAt,
      coordinateMethod: "source-wkb-point", completeness: { ...snapshot.completeness,
        sourceRows: Math.max(snapshot.records.length, comparatorCount + 1), returnedRecords: Math.max(snapshot.records.length, comparatorCount + 1) } };
  };
  return { extensionId: id((propertyNode === propertyA ? 14720 : 14730) + version), version,
    content: { format: "yellow/market-compset/v1", propertyNode, confirmedBy: id(1), confirmedAt: "2026-09-13T08:10:00.000Z",
      ownProperty: evidence(0), comparators: Array.from({ length: comparatorCount }, (_, index) => evidence(index + 1)) } };
}


(browser ? test : test.skip)("Q266 real shell lazy market journey, exact retry, conflict, revocation and stale-property isolation", async () => {
  const shell = createApp({ operatorApi: {} as OperatorHttpApi });
  const calls: Array<{ property: string; body: string; key: string | null }> = [];
  let assetLoads = 0, effects = 0;
  const saved = new Map<string, ReturnType<typeof savedFixture>>();
  let mode: "unknown" | "success" | "conflict" | "forbidden" | "invalid" = "unknown";
  let failDiscovery = false, large = false;
  let delayA = false, releaseA: (() => void) | undefined, delayedStarted = false;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/assets/operator-market.js") assetLoads += 1;
    if (path === "/api/v1/auth/local:login") return Response.json({ accessToken: "synthetic-q266-token", user: { id: id(1), displayName: "Synthetic operator" } });
    if (path.startsWith("/api/v1/")) {
      if (request.headers.get("authorization") !== "Bearer synthetic-q266-token") return Response.json({ detail: "Synthetic unauthorized" }, { status: 401 });
      if (path === "/api/v1/me/properties") return Response.json({ properties: [
        { id: propertyA, name: "Synthetic A", timezone: "Asia/Riyadh" }, { id: propertyB, name: "Synthetic B", timezone: "Asia/Dubai" },
      ] });
      if (path === "/api/v1/me/market-properties") return Response.json({ marketProperties: { properties: [
        { id: propertyA, name: "Synthetic A", timezone: "Asia/Riyadh", currency: "SAR" },
        { id: propertyB, name: "Synthetic B", timezone: "Asia/Dubai", currency: "AED" },
      ], nextCursor: null } });
      const market = path.match(/^\/api\/v1\/properties\/([^/]+)\/market\/(discovery|compset|compset\/confirm)$/u);
      if (market) {
        const property = market[1]!;
        if (market[2] === "discovery") {
          if (property === propertyA && delayA) { delayedStarted = true; await new Promise<void>(accept => { releaseA = accept; }); }
          if (failDiscovery) return Response.json({ detail: "Synthetic unavailable" }, { status: 503 });
          return Response.json(discovery(property === propertyA ? "Property A" : "Property B", large));
        }
        if (market[2] === "compset") return Response.json({ compset: saved.get(property) ?? null });
        const body = await request.text();
        calls.push({ property, body, key: request.headers.get("idempotency-key") });
        if (mode === "forbidden") return Response.json({ detail: "Synthetic revoked" }, { status: 403 });
        if (mode === "invalid") return Response.json({ detail: "Synthetic invalidated selection" }, { status: 400 });
        if (mode === "conflict") { saved.set(property, savedFixture(property, 2)); return Response.json({ detail: "Synthetic conflict" }, { status: 409 }); }
        if (mode === "unknown") {
          const input = JSON.parse(body) as { ownProperty: { logicalId: string; sha256: string; sourceRecordId: string }; comparators: Array<{ logicalId: string; sha256: string; sourceRecordId: string }> };
          const snapshot = discovery(property === propertyA ? "Property A" : "Property B", large).discovery.snapshots[0]!;
          const evidence = (reference: typeof input.ownProperty) => {
            const record = snapshot.records.find(item => item.provenance.recordId === reference.sourceRecordId);
            if (!record) throw new Error("Synthetic confirmation must resolve an exact admitted reference");
            return { reference, record, capturedAt: snapshot.capturedAt, coordinateMethod: "source-wkb-point", completeness: snapshot.completeness };
          };
          const receipt = savedFixture(property, 1);
          receipt.content.ownProperty = evidence(input.ownProperty); receipt.content.comparators = input.comparators.map(evidence);
          effects += 1; saved.set(property, receipt); mode = "success";
          return Response.json({ detail: "Synthetic ambiguous response" }, { status: 503 });
        }
        return Response.json({ confirmation: { version: saved.get(property), replayed: true } });
      }
      return Response.json({ detail: "Unexpected synthetic API route" }, { status: 404 });
    }
    return shell.handle(request);
  } });
  try {
    await withBrowser(async (send, errors) => {
      const { value, until, click } = browserControls(send);
      const ready = () => until('document.querySelector(".market-workspace")?.dataset.marketState === "ready"', "market ready");
      const review = () => click(".market-workspace__explicit input");
      const chooseOwn = () => click('.market-workspace__row input[name="market-own"]');
      const confirm = () => click('[data-testid="market-confirm"]');
      await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${propertyA}/market` });
      await until('document.querySelector("#login-form button[type=submit]")?.disabled === false', "login shell loaded");
      expect(assetLoads).toBe(0);
      await value(`{const form=document.querySelector("#login-form");form.elements.tenant.value="synthetic";form.elements.email.value="operator@example.test";form.elements.password.value="synthetic-only";form.requestSubmit();}`);
      await ready();
      expect(assetLoads).toBe(1);
      await click('[data-view="market"]'); await ready();
      expect(await value<number>('document.querySelectorAll(".market-workspace__row").length')).toBe(25);
      expect(await value<number>('document.querySelectorAll(".market-workspace__point").length')).toBe(30);
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-table]").querySelector("img") === null && !globalThis.injected')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-source]").textContent.includes("UTC")')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-table]").textContent.includes("unknown")')).toBe(true);
      expect(calls).toHaveLength(0);
      await click(".market-workspace__pager button:last-child");
      expect(await value<number>('document.querySelectorAll(".market-workspace__row").length')).toBe(5);
      await click(".market-workspace__pager button:first-child");
      const spread = await value<number>('(()=>{const xs=[...document.querySelectorAll(".market-workspace__point")].map(n=>parseFloat(n.style.left));return Math.max(...xs)-Math.min(...xs)})()');
      expect(spread).toBeGreaterThan(40);
      await chooseOwn(); await review();
      await click('.market-workspace__row:nth-child(2) input[type="checkbox"]');
      expect(await value<boolean>('document.querySelector(".market-workspace__explicit input").checked')).toBe(false);
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      await review(); await confirm();
      await until('document.querySelector("[data-testid=market-status]").textContent.includes("unknown")', "ambiguous response");
      expect(calls).toHaveLength(1); expect(effects).toBe(1);
      expect(await value<boolean>('document.querySelector("[data-testid=market-filter]").disabled && document.querySelector("[data-testid=market-refresh]").disabled')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-identity-suggest]").disabled && document.querySelector("[data-testid=market-property-select]").disabled')).toBe(true);
      await confirm();
      // Q267 refreshes the authoritative saved set after acknowledging a receipt.
      // Exact retry body/key/effect checks below remain unchanged.
      await until('document.querySelector(".market-workspace").dataset.marketState === "ready" && document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("Saved version 1")', "retry acknowledged and saved version refreshed");
      expect(calls).toHaveLength(2); expect(calls[0]).toEqual(calls[1]); expect(effects).toBe(1);
      expect(calls[0]!.key).toMatch(/^[0-9a-f-]{36}$/u);
      expect(JSON.parse(calls[0]!.body)).toMatchObject({ expectedActiveVersion: null, ownProperty: { sourceRecordId: "source-0" }, comparators: [{ sourceRecordId: "source-1" }] });
      mode = "conflict"; await chooseOwn(); await review(); await confirm(); await ready();
      expect(await value<boolean>('document.querySelector(".market-workspace__explicit input").checked')).toBe(false);
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      expect(calls[2]!.key).not.toBe(calls[1]!.key);
      mode = "forbidden"; await chooseOwn(); await review(); await confirm();
      await until('document.querySelector("[data-testid=market-status]").textContent.includes("no longer granted")', "revocation clears evidence");
      expect(await value<number>('document.querySelectorAll(".market-workspace__row,.market-workspace__point").length')).toBe(0);
      delayA = true; await click('[data-testid="market-refresh"]');
      const delayDeadline = Date.now() + 2_000;
      while (!delayedStarted && Date.now() < delayDeadline) await Bun.sleep(10);
      expect(delayedStarted).toBe(true);
      await until('document.querySelector("[data-testid=market-property-select]")?.options.length === 2', "independent market property choices");
      await value(`{const picker=document.querySelector("[data-testid=market-property-select]");picker.value=${JSON.stringify(propertyB)};picker.dispatchEvent(new Event("change",{bubbles:true}));}`);
      await ready(); releaseA?.(); await Bun.sleep(50);
      expect(await value<boolean>('document.querySelector("[data-testid=market-table]").textContent.includes("Property B")')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-table]").textContent.includes("Property A")')).toBe(false);
      mode = "invalid"; await chooseOwn(); await review(); await confirm();
      await until('document.querySelector("[data-testid=market-status]").textContent.includes("Reload before confirming")', "invalidated selection requires reload");
      await click('.market-workspace__row:nth-child(2) input[type="checkbox"]');
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      await click('[data-testid="market-refresh"]'); await ready(); await chooseOwn(); await review();
      const settledCalls = calls.length;
      failDiscovery = true; await click('[data-testid="market-refresh"]');
      await until('document.querySelector(".market-workspace").dataset.marketState === "error"', "failed paired reload");
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      await confirm(); expect(calls).toHaveLength(settledCalls);
      failDiscovery = false; large = true;
      await click('[data-testid="market-refresh"]'); await ready(); await chooseOwn();
      await value('document.querySelectorAll(".market-workspace__row input[type=checkbox]:not(:disabled)").forEach(input=>input.click())');
      await click(".market-workspace__pager button:last-child");
      await value('document.querySelectorAll(".market-workspace__row input[type=checkbox]:not(:disabled)").forEach(input=>input.click())');
      expect(await value<boolean>('document.querySelector("[data-testid=market-review]").textContent.includes("16 KiB")')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-confirm]").disabled')).toBe(true);
      await confirm(); expect(calls).toHaveLength(settledCalls);
      await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      expect(await value<boolean>('document.querySelector("#market-mount").scrollWidth <= document.querySelector("#market-mount").clientWidth + 1')).toBe(true);
      await click("#sign-out");
      await until('document.querySelector("#workbench-view").hidden', "sign out");
      expect(await value<number>('document.querySelector("#market-mount").childElementCount')).toBe(0);
      expect(assetLoads).toBe(1);
      expect(errors).toEqual([]);
    });
  } finally { releaseA?.(); await server.stop(true); }
}, 60_000);

(browser ? test : test.skip)("Q267 market-only shell, historical identity, saved-plan preview and stale result boundaries", async () => {
  const shell = createApp({ operatorApi: {} as OperatorHttpApi });
  const cursor = Buffer.from(id(521)).toString("base64url");
  const firstPage = Array.from({ length: 50 }, (_, index) => ({ id: id(472 + index), name: `Market property ${index + 1}`, timezone: "Asia/Riyadh", currency: "SAR" }));
  const requests: Array<{ path: string; method: string; body: string; cursor: string | null }> = [];
  let savedA = savedFixture(propertyA, 4, true), delayIdentity = false, releaseIdentity: (() => void) | undefined;
  let identityStarted = false, forgedIdentity = false, planConflict = false, denyEvidence = false;
  let delayPreview = false, previewStarted = false, releasePreview: (() => void) | undefined;
  let delayCompset = false, reloadStarted = false, releaseReload: (() => void) | undefined;
  let previewFault: "none" | "version" | "reference" | "conditions" | "counts" | "sample" | "markup" = "none";
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if (path === "/api/v1/auth/local:login") return Response.json({ accessToken: "synthetic-q267-token", user: { id: id(1), displayName: "Synthetic market-only user" } });
    if (!path.startsWith("/api/v1/")) return shell.handle(request);
    if (request.headers.get("authorization") !== "Bearer synthetic-q267-token") return Response.json({ detail: "Synthetic unauthorized" }, { status: 401 });
    const body = request.method === "POST" ? await request.text() : "";
    requests.push({ path, method: request.method, body, cursor: url.searchParams.get("cursor") });
    if (path === "/api/v1/me/properties") return Response.json({ detail: "No availability permission" }, { status: 403 });
    if (path === "/api/v1/me/market-properties") {
      if (!url.search) return Response.json({ marketProperties: { properties: firstPage, nextCursor: cursor } });
      if (url.searchParams.get("cursor") === cursor) return Response.json({ marketProperties: { properties: [{ id: id(522), name: "Market property 51", timezone: "Asia/Dubai", currency: "AED" }], nextCursor: null } });
      return Response.json({ detail: "Wrong cursor" }, { status: 400 });
    }
    const route = path.match(/^\/api\/v1\/properties\/([^/]+)\/market\/(discovery|compset|identity\/suggest|plan\/preview)$/u);
    if (!route) return Response.json({ detail: "Unexpected synthetic mutation or operation" }, { status: 400 });
    const property = route[1]!;
    const snapshot = discovery(property === propertyA ? "Property A" : "Property B").discovery.snapshots[0]!;
    if (route[2] === "discovery") return denyEvidence ? Response.json({ detail: "Synthetic revoked" }, { status: 403 }) : Response.json({ discovery: { snapshots: [snapshot] } });
    if (route[2] === "compset") {
      if (delayCompset) { reloadStarted = true; await new Promise<void>(accept => { releaseReload = accept; }); }
      return denyEvidence ? Response.json({ detail: "Synthetic revoked" }, { status: 403 }) : Response.json({ compset: property === propertyA ? savedA : null });
    }
    if (route[2] === "identity/suggest") {
      const input = JSON.parse(body) as { snapshot: { logicalId: string; sha256: string }; target: { recordId?: string; publicUrl?: string } };
      if (input.target.publicUrl?.includes("?")) return Response.json({ detail: "Unsafe URL" }, { status: 400 });
      if (delayIdentity) { identityStarted = true; await new Promise<void>(accept => { releaseIdentity = accept; }); }
      const record = snapshot.records[1]!;
      return Response.json({ suggestions: { snapshot: forgedIdentity ? { ...input.snapshot, sha256: "f".repeat(64) } : input.snapshot,
        requiresConfirmation: true, ambiguous: false,
        candidates: [{ reference: { ...input.snapshot, sourceRecordId: record.provenance.recordId }, record,
          matchedBy: ["source-record-id"], capturedAt: snapshot.capturedAt, completeness: snapshot.completeness }] } });
    }
    if (planConflict) { savedA = savedFixture(propertyA, 5, true); return Response.json({ detail: "Saved version changed" }, { status: 409 }); }
    const input = JSON.parse(body) as { expectedCompset: { extensionId: string; version: number }; comparatorIndexes: number[]; conditions: MarketCompsetPlanConditions };
    if (delayPreview) { previewStarted = true; await new Promise<void>(accept => { releasePreview = accept; }); }
    const conditions = { ...input.conditions, selectedSources: [...input.conditions.selectedSources].sort(),
      guests: { ...input.conditions.guests, childAges: [...input.conditions.guests.childAges].sort((a, b) => a - b) },
      lengthsOfStayNights: [...input.conditions.lengthsOfStayNights].sort((a, b) => a - b),
      pointOfSaleMarket: input.conditions.pointOfSaleMarket.toUpperCase(), language: Intl.getCanonicalLocales(input.conditions.language)[0]! };
    const mapping = [...input.comparatorIndexes].sort((a, b) => a - b).map(index => ({ token: `evidence:${"c".repeat(63)}${index}`,
      index, reference: { ...savedA.content.comparators[index]!.reference } }));
    const { batches, ...plan } = buildMarketSourcePlan({ ...conditions, tenantId: "synthetic-tenant", managedPropertyId: property,
      permissionScope: "rms.market.read", entitlement: "preview-only", propertyTimezone: "Asia/Riyadh", currency: "SAR",
      competitorScope: mapping.map(entry => entry.token) }, { now: "2026-09-13T08:30:00.000Z", maxRequestsThisRun: 100, maxBatchSize: 25 });
    const preview = { previewOnly: true, executable: false, compset: { ...input.expectedCompset }, conditions,
      propertyTimezone: "Asia/Riyadh", currency: "SAR", comparatorMapping: mapping, plan,
      sample: batches.flatMap(batch => batch.requests).slice(0, 10)
        .map(({ source, arrivalDate, checkoutDate, lengthOfStayNights, daysAhead, cadence }) =>
          ({ source, arrivalDate, checkoutDate, lengthOfStayNights, daysAhead, cadence })) };
    if (previewFault === "version") preview.compset.version += 1;
    if (previewFault === "reference") preview.comparatorMapping[0]!.reference.sha256 = "f".repeat(64);
    if (previewFault === "conditions") preview.conditions.destination = "Unrequested destination";
    if (previewFault === "counts") preview.plan.selectedRequestCount = -1;
    if (previewFault === "sample") preview.sample[0]!.checkoutDate = "2026-02-30";
    if (previewFault === "markup") preview.currency = '<img src=x onerror="window.previewInjected=1">';
    return Response.json({ preview });
  } });
  try {
    await withBrowser(async (send, errors) => {
      const { value, until, click, fill } = browserControls(send);
      const ready = () => until('document.querySelector(".market-workspace")?.dataset.marketState === "ready"', "market ready");
      const identityCalls = () => requests.filter(entry => entry.path.endsWith("/identity/suggest"));
      const previewCalls = () => requests.filter(entry => entry.path.endsWith("/plan/preview"));
      const started = async (condition: () => boolean, label: string) => {
        const deadline = Date.now() + 2_000;
        while (!condition() && Date.now() < deadline) await Bun.sleep(10);
        if (!condition()) throw new Error(`Expected synthetic request did not start: ${label}`);
      };
      await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${propertyA}/market` });
      await until('document.querySelector("#login-form button[type=submit]")?.disabled === false', "login shell");
      await value(`{const f=document.querySelector("#login-form");f.elements.tenant.value="synthetic";f.elements.email.value="market@example.test";f.elements.password.value="synthetic-only";f.requestSubmit();}`);
      await until('document.querySelector("[data-testid=market-property-select]")?.options.length >= 50', "market-only choices independent of availability");
      expect(await value<boolean>('document.querySelector("#property-select").disabled && !document.querySelector("#property-select").value')).toBe(true);
      await fill('[data-testid="market-property-select"]', propertyA); await ready();
      expect(await value<boolean>('!document.querySelector("[data-testid=market-property-next]").disabled')).toBe(true);
      await click('[data-testid="market-property-next"]');
      await until('document.querySelector("[data-testid=market-property-select]").options.length === 51', "second page appended");
      expect(await value<boolean>('document.querySelector("[data-testid=market-property-next]").disabled')).toBe(true);
      expect(requests.some(entry => entry.cursor === cursor)).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("saved-0")')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("archived-release")')).toBe(true);
      expect(await value<boolean>('document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("Aug") || document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("2026-08-01")')).toBe(true);
      expect(await value<number>('document.querySelectorAll(".market-workspace__plan-comparator input:checked").length')).toBe(0);
      expect(previewCalls()).toHaveLength(0);
      await fill('[data-testid="market-identity-record-id"]', "source-1");
      await click('[data-testid="market-identity-suggest"]');
      await until('document.querySelectorAll(".market-workspace__suggestion").length === 1', "explicit suggestions");
      expect(await value<number>('document.querySelectorAll(".market-workspace__suggestion input:checked,.market-workspace__row input[name=market-own]:checked").length')).toBe(0);
      expect(await value<boolean>('document.querySelector("[data-testid=market-suggestions]").textContent.includes("source-record-id")')).toBe(true);
      expect(JSON.parse(identityCalls()[0]!.body)).toEqual({ snapshot: { logicalId: "riyadh", sha256: "a".repeat(64) }, target: { recordId: "source-1" } });
      await click(".market-workspace__suggestion input"); await click('[data-testid="market-identity-apply"]');
      expect(await value<number>('document.querySelectorAll(".market-workspace__row input[name=market-own]:checked").length')).toBe(1);
      expect(await value<boolean>('document.querySelector(".market-workspace__explicit input").checked')).toBe(false);
      expect(requests.filter(entry => entry.path.endsWith("/compset/confirm"))).toHaveLength(0);

      // A response for an earlier identity target cannot become the new draft.
      delayIdentity = true; await click('[data-testid="market-identity-suggest"]');
      await started(() => identityStarted, "delayed identity");
      await fill('[data-testid="market-identity-record-id"]', "source-2");
      delayIdentity = false; releaseIdentity?.(); await Bun.sleep(60);
      expect(await value<number>('document.querySelectorAll(".market-workspace__suggestion").length')).toBe(0);
      expect(await value<boolean>('document.querySelector("[data-testid=market-identity-suggest]").disabled')).toBe(false);
      forgedIdentity = true; await click('[data-testid="market-identity-suggest"]');
      await until('!document.querySelector("[data-testid=market-identity-suggest]").disabled', "forged snapshot rejected");
      expect(await value<number>('document.querySelectorAll(".market-workspace__suggestion").length')).toBe(0);
      forgedIdentity = false;
      await fill('.market-workspace__identity-latitude', "24.708");
      const beforeHalfCoordinate = identityCalls().length;
      await click('[data-testid="market-identity-suggest"]');
      expect(identityCalls()).toHaveLength(beforeHalfCoordinate);
      await fill('.market-workspace__identity-latitude', "");

      await fill('.market-workspace__plan-destination', "Riyadh");
      await fill('.market-workspace__plan-pos', "SA"); await fill('.market-workspace__plan-language', "en");
      await fill('.market-workspace__plan-child-ages', "4,9");
      await click('.market-workspace__plan-sources input[value="booking-mcp"]');
      await click('.market-workspace__plan-comparator input[value="1"]');
      await fill('.market-workspace__plan-stays', "1,invalid");
      await click('[data-testid="market-plan-preview"]'); expect(previewCalls()).toHaveLength(0);
      await fill('.market-workspace__plan-stays', "1");
      await click('[data-testid="market-plan-preview"]');
      await until('document.querySelector("[data-testid=market-plan-result]").textContent.includes("91")', "persisted preview is visible after request settles");
      expect(JSON.parse(previewCalls()[0]!.body)).toEqual({ expectedCompset: { extensionId: savedA.extensionId, version: 4 }, comparatorIndexes: [1],
        conditions: { destination: "Riyadh", lookaheadMonths: 3, selectedSources: ["booking-mcp"], guests: { rooms: 1, adults: 2, childAges: [4, 9] },
          pointOfSaleMarket: "SA", language: "en", lengthsOfStayNights: [1] } });
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-result]").textContent.includes("no collection")')).toBe(true);
      const detail = await value<string>('document.querySelector("[data-testid=market-plan-details]").textContent');
      expect(detail).toContain("Asia/Riyadh"); expect(detail).toContain("SAR");
      expect(detail).toContain("2026-09-13"); expect(detail).toContain("2026-12-13");
      expect(detail).toContain("booking-mcp"); expect(detail).toContain("2026-09-22");
      expect(detail).not.toContain("evidence:");
      await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      expect(await value<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
      await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const fault of ["version", "reference", "conditions", "counts", "sample", "markup"] as const) {
        previewFault = fault;
        await click('[data-testid="market-plan-preview"]');
        await until('!document.querySelector("[data-testid=market-plan-preview]").disabled && document.querySelector("[data-testid=market-plan-result]").textContent.includes("unavailable or invalid")', `reject ${fault} preview`);
        expect(await value<string>('document.querySelector("[data-testid=market-plan-details]").textContent')).toBe("");
        expect(await value<boolean>('Boolean(window.previewInjected)')).toBe(false);
      }
      previewFault = "none";
      // Valid service canonicalization must not be mistaken for a request mismatch.
      await fill('.market-workspace__plan-pos', "sa"); await fill('.market-workspace__plan-language', "en-us");
      await fill('.market-workspace__plan-child-ages', "9,4"); await fill('.market-workspace__plan-stays', "2,1");
      await click('[data-testid="market-plan-preview"]');
      await until('document.querySelector("[data-testid=market-plan-details]").textContent.includes("182")', "normalized two-stay plan details");
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-details]").textContent.includes("82")')).toBe(true);
      await fill('.market-workspace__plan-pos', "SA"); await fill('.market-workspace__plan-language', "en");
      await fill('.market-workspace__plan-child-ages', "4,9"); await fill('.market-workspace__plan-stays', "1");
      delayPreview = true; await click('[data-testid="market-plan-preview"]');
      await started(() => previewStarted, "delayed preview");
      await fill('.market-workspace__plan-destination', "Changed destination");
      delayPreview = false; releasePreview?.(); await Bun.sleep(60);
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-result]").textContent.includes("91")')).toBe(false);
      expect(await value<string>('document.querySelector("[data-testid=market-plan-details]").textContent')).toBe("");
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-preview]").disabled')).toBe(false);
      previewStarted = false; delayPreview = true; delayCompset = true;
      await click('[data-testid="market-plan-preview"]'); await started(() => previewStarted, "preview before reload");
      await click('[data-testid="market-refresh"]'); await started(() => reloadStarted, "paired reload pending");
      releasePreview?.(); delayPreview = false; await Bun.sleep(60);
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-result]").textContent.includes("91")')).toBe(false);
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-preview]").disabled')).toBe(true);
      await fill('.market-workspace__plan-destination', "Still reloading");
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-preview]").disabled')).toBe(true);
      releaseReload?.(); delayCompset = false; await ready();
      expect(await value<number>('document.querySelectorAll(".market-workspace__plan-comparator input:checked").length')).toBe(0);
      await click('.market-workspace__plan-comparator input[value="1"]');
      planConflict = true; await click('[data-testid="market-plan-preview"]');
      await until('document.querySelector("[data-testid=market-plan-result]").textContent.includes("Reload")', "stale saved preview requires reload");
      const conflictCalls = previewCalls().length;
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-preview]").disabled')).toBe(true);
      await click('[data-testid="market-plan-preview"]'); expect(previewCalls()).toHaveLength(conflictCalls);
      planConflict = false; await click('[data-testid="market-refresh"]'); await ready();
      expect(await value<number>('document.querySelectorAll(".market-workspace__plan-comparator input:checked").length')).toBe(0);

      // Valid large saved sets remain visible; the planner cannot silently truncate201 to200.
      savedA = savedFixture(propertyA, 6, true, 201); await click('[data-testid="market-refresh"]'); await ready();
      expect(await value<number>('document.querySelectorAll(".market-workspace__plan-comparator").length')).toBe(201);
      await value('document.querySelectorAll(".market-workspace__plan-comparator input").forEach(input=>input.click())');
      expect(await value<boolean>('document.querySelector("[data-testid=market-plan-preview]").disabled')).toBe(true);
      await click('[data-testid="market-plan-preview"]'); expect(previewCalls()).toHaveLength(conflictCalls);
      const historyStart = requests.length;
      await value(`{history.pushState(null,"",${JSON.stringify(`/p/${propertyB}/market`)});dispatchEvent(new PopStateEvent("popstate"));}`);
      await until(`location.pathname===${JSON.stringify(`/p/${propertyB}/market`)} && document.querySelector(".market-workspace")?.dataset.marketState === "ready" && document.querySelector("[data-testid=market-table]").textContent.includes("Property B")`, "history changes exact market property");
      expect(await value<number>('document.querySelectorAll(".market-workspace__plan-comparator").length')).toBe(0);
      expect(requests.slice(historyStart).filter(entry => /\/properties\//u.test(entry.path)).every(entry => entry.path.includes(`/properties/${propertyB}/market/`))).toBe(true);
      await value('history.back()');
      await until(`location.pathname===${JSON.stringify(`/p/${propertyA}/market`)} && document.querySelector(".market-workspace")?.dataset.marketState === "ready" && document.querySelectorAll(".market-workspace__plan-comparator").length === 201`, "back restores exact historical set");
      denyEvidence = true; await click('[data-testid="market-refresh"]');
      await until('document.querySelector(".market-workspace").dataset.marketState === "error"', "read grant revoked");
      expect(await value<boolean>('!document.querySelector("[data-testid=market-saved-evidence]").textContent.includes("saved-0")')).toBe(true);
      expect(await value<string>('document.querySelector("[data-testid=market-plan-details]").textContent')).toBe("");
      expect(await value<number>('document.querySelectorAll(".market-workspace__row,.market-workspace__point,.market-workspace__plan-comparator,.market-workspace__suggestion").length')).toBe(0);
      expect(requests.every(entry => entry.path.startsWith("/api/v1/me/") || /\/market\/(discovery|compset|identity\/suggest|plan\/preview)$/u.test(entry.path))).toBe(true);
      await click("#sign-out"); await until('document.querySelector("#workbench-view").hidden', "signout");
      expect(await value<number>('document.querySelector("#market-mount").childElementCount')).toBe(0);
      denyEvidence = false;
      const routeStart = requests.length;
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${id(522)}/market` });
      await until('document.querySelector("#login-form button[type=submit]")?.disabled === false', "deep-link login");
      await value(`{const f=document.querySelector("#login-form");f.elements.tenant.value="synthetic";f.elements.email.value="market@example.test";f.elements.password.value="synthetic-only";f.requestSubmit();}`);
      await until('document.querySelector(".market-workspace")?.dataset.marketState === "property-pending"', "later-page property must not fall back");
      expect(requests.slice(routeStart).filter(entry => /\/properties\//u.test(entry.path))).toHaveLength(0);
      await click('[data-testid="market-property-next"]');
      await until('document.querySelector("[data-testid=market-property-select]").options.length === 51', "deep-link membership on later page");
      await fill('[data-testid="market-property-select"]', id(522)); await ready();
      expect(requests.slice(routeStart).filter(entry => /\/properties\//u.test(entry.path)).every(entry => entry.path.includes(`/properties/${id(522)}/market/`))).toBe(true);
      await click("#sign-out"); await until('document.querySelector("#workbench-view").hidden', "second signout");
      expect(errors).toEqual([]);
    });
  } finally { releaseIdentity?.(); releasePreview?.(); releaseReload?.(); await server.stop(true); }
}, 60_000);
