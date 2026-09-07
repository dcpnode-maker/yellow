import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

function requireMatch(source: string, pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (!match?.[0]) throw new Error(`Missing ${label}`);
  return match[0];
}

function workspaceSkinHarness(script: string) {
  const declarations = requireMatch(
    script,
    /const WORKSPACE_SKINS = new Set\(\[[^\n]+\]\);/,
    "workspace skin allowlist",
  );
  const setter = requireMatch(
    script,
    /function applyWorkspaceSkin\(skin\) \{[\s\S]*?\n \}/,
    "workspace skin setter",
  );
  const listener = requireMatch(
    script,
    /workspaceSkinSelect\.addEventListener\("change", \(\) => \{[\s\S]*?\n \}\);/,
    "workspace skin listener",
  );

  const writes: Array<[PropertyKey, unknown]> = [];
  const dataset = new Proxy<Record<string, string>>({ workspaceSkin: "calm" }, {
    set(target, property, value) {
      if (property !== "workspaceSkin") throw new Error(`Unexpected dataset write: ${String(property)}`);
      writes.push([property, value]);
      return Reflect.set(target, property, String(value));
    },
  });
  const focusTarget = Object.freeze({ id: "invoice-provider-option" });
  const document = Object.freeze({
    documentElement: Object.freeze({ dataset }),
    activeElement: focusTarget,
  });
  const listeners = new Map<string, () => void>();
  const workspaceSkinSelect = {
    value: "calm",
    addEventListener(type: string, handler: () => void) {
      listeners.set(type, handler);
    },
  };
  const forbidden = (operation: string) => () => {
    throw new Error(`Workspace layout attempted ${operation}`);
  };
  const program = new Function(
    "document",
    "workspaceSkinSelect",
    "fetch",
    "localStorage",
    "sessionStorage",
    "history",
    "transitionWorkspace",
    `"use strict";\n${declarations}\n${setter}\n${listener}\nreturn { applyWorkspaceSkin };`,
  ) as (...args: unknown[]) => { applyWorkspaceSkin: (skin: string) => void };
  const localStorage = Object.freeze({
    getItem: forbidden("localStorage read"),
    setItem: forbidden("localStorage write"),
  });
  const sessionStorage = Object.freeze({
    getItem: forbidden("sessionStorage read"),
    setItem: forbidden("sessionStorage write"),
  });
  const history = Object.freeze({
    pushState: forbidden("navigation"),
    replaceState: forbidden("navigation"),
  });
  const api = program(
    document,
    workspaceSkinSelect,
    forbidden("network access"),
    localStorage,
    sessionStorage,
    history,
    forbidden("workspace transition"),
  );

  return { api, dataset, focusTarget, listeners, workspaceSkinSelect, writes };
}

test("Order444 exposes exactly the three Astra workspace layouts", async () => {
  const [html, script] = await Promise.all([
    Bun.file(htmlFile).text(),
    Bun.file(scriptFile).text(),
  ]);

  expect(html).toContain('<html lang="en" data-theme="apple" data-workspace-skin="calm">');
  const picker = requireMatch(
    html,
    /<select id="workspace-skin-select"[\s\S]*?<\/select>/,
    "workspace skin picker",
  );
  expect(picker).toContain('aria-label="Workspace layout"');
  expect([...picker.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map((match) => match.slice(1))).toEqual([
    ["calm", "Calm Workbench"],
    ["precision", "Precision Desk"],
    ["timeline", "Service Timeline"],
  ]);
  expect(html).not.toMatch(/data-experience=|id="experience-select"|id="theme-select"/);
  expect(picker).not.toMatch(/Simple|Advanced|Expert|Apple|Android|Windows|Glass|Neo|ERP/i);
  expect(script).toContain('const WORKSPACE_SKINS = new Set(["calm", "precision", "timeline"])');
  expect(script).not.toMatch(/\b(?:THEMES|EXPERIENCES|applyTheme|applyExperience|themeSelect|experienceSelect)\b/);
});

test("Order444 keeps every mounted workspace and invoice deep-route anchor", async () => {
  const html = await Bun.file(htmlFile).text();
  const navigation = [...html.matchAll(/<button class="(?:domain-tab(?: is-active)?|day-close-nav)"[^>]*data-view="([^"]+)"/g)]
    .map((match) => match[1]);

  expect(navigation).toEqual([
    "today", "availability", "reservations", "folios", "invoices", "cashiers",
    "day-close", "trust", "operations", "housekeeping", "vehicles", "inventory",
    "restrictions", "rates", "status",
  ]);
  for (const anchor of [
    'id="invoices-view"',
    'id="invoices-mount"',
    'id="folio-invoice-review"',
    'id="secondary-workspaces-toggle"',
    'id="secondary-workspaces" hidden',
  ]) {
    expect(html).toContain(anchor);
  }
});

test("Order444 layout changes preserve the mounted subject, draft, filter, focus and request identity", async () => {
  const script = await Bun.file(scriptFile).text();
  const harness = workspaceSkinHarness(script);
  const mountedWorkflow = {
    mount: Object.freeze({ id: "invoices-mount", child: Object.freeze({ id: "invoice-subject" }) }),
    subject: "0198d353-dcb2-7000-8000-000000000042",
    values: Object.freeze({ amount: "90071992547409.91", note: "Keep this draft" }),
    filters: Object.freeze({ from: "2026-09-01", to: "2026-09-07", status: "not_requested" }),
    requestIdentity: Object.freeze({ key: "0198d353-dcb2-7000-8000-000000000099", generation: 7 }),
  };
  const before = structuredClone(mountedWorkflow);
  const mountedReference = mountedWorkflow.mount;
  const subjectReference = mountedWorkflow.mount.child;
  const change = harness.listeners.get("change");

  expect(change).toBeFunction();
  for (const skin of ["precision", "timeline", "calm"]) {
    harness.workspaceSkinSelect.value = skin;
    change?.();
    expect(harness.dataset.workspaceSkin).toBe(skin);
    expect(harness.workspaceSkinSelect.value).toBe(skin);
    expect(harness.focusTarget.id).toBe("invoice-provider-option");
    expect(mountedWorkflow).toEqual(before);
    expect(mountedWorkflow.mount).toBe(mountedReference);
    expect(mountedWorkflow.mount.child).toBe(subjectReference);
  }

  harness.workspaceSkinSelect.value = "expert";
  change?.();
  expect(harness.dataset.workspaceSkin).toBe("calm");
  expect(harness.workspaceSkinSelect.value).toBe("calm");
  expect(harness.writes.map(([, value]) => value)).toEqual(["precision", "timeline", "calm", "calm"]);
});

test("Order444 switching is page-session presentation only and contextual navigation stays uniform", async () => {
  const script = await Bun.file(scriptFile).text();
  const setter = requireMatch(
    script,
    /function applyWorkspaceSkin\(skin\) \{[\s\S]*?\n \}/,
    "workspace skin setter",
  );
  const listener = requireMatch(
    script,
    /workspaceSkinSelect\.addEventListener\("change", \(\) => \{[\s\S]*?\n \}\);/,
    "workspace skin listener",
  );

  expect(`${setter}\n${listener}`).not.toMatch(/fetch|request\(|localStorage|sessionStorage|indexedDB|cookie|history\.|setView\(|transitionWorkspace|replaceChildren|innerHTML|location\./);
  expect(script).not.toMatch(/data-experience|dataset\.experience/);
  expect(script).toContain("if (SECONDARY_VIEWS.has(activeView)) {");
  expect(script).toContain("if (SECONDARY_VIEWS.has(view)) closeSecondaryWorkspaces();");
  expect(script).toContain('secondaryWorkspacesToggle.addEventListener("click"');
  expect(script).toContain('if (event.key === "Escape")');
  expect(script).toContain("closeSecondaryWorkspaces(true)");
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
});
