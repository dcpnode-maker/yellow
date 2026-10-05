import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../src/http/operator/index.html");
const operator = read("../src/http/operator/operator.js");
const layouts = read("../src/http/operator/operator-layouts.js");
const interfaces = read("../src/http/operator/operator-interfaces.js");
const css = read("../src/http/operator/operator-interfaces.css");
const assets = read("../src/http/operator.ts");
const app = read("../src/app.ts");

const skins = ["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"] as const;
const groups = {
  "front-desk": [["nav-today", "today"], ["nav-availability", "availability"], ["nav-reservations", "reservations"]],
  finance: [["nav-folios", "folios"], ["nav-invoices", "invoices"], ["nav-cashiers", "cashiers"], ["nav-day-close", "day-close"], ["nav-trust", "trust"]],
  operations: [["nav-operations", "operations"], ["nav-housekeeping", "housekeeping"], ["nav-vehicles", "vehicles"]],
  revenue: [["nav-inventory", "inventory"], ["nav-restrictions", "restrictions"], ["nav-rates", "rates"]],
  system: [["nav-status", "status"]],
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("Order459 registers one local presentation controller after the existing operator assets", () => {
  expect(html.indexOf('/assets/operator.js')).toBeLessThan(html.indexOf('/assets/operator-interfaces.js'));
  expect(html.indexOf('/assets/operator-interfaces.js')).toBeLessThan(html.indexOf('/assets/operator-layouts.js'));
  expect(html.match(/<script src="\/assets\/operator-layouts\.js" defer><\/script>/g)).toHaveLength(1);
  expect(assets).toContain('layoutsJs: new URL("./operator/operator-layouts.js", import.meta.url)');
  expect(app).toContain('.get("/assets/operator-layouts.js", () => operatorAssets.layoutsJs())');
  expect(layouts).toContain('root.dataset.layoutController = "ready"');
  expect(layouts).toContain('workbench.classList.add("layout-composition")');
  expect(layouts).toContain("workbench.dataset.layoutSkin = skin");
});

test("Order459 groups the original 15 destinations exactly once in five native disclosures", () => {
  expect(html).toContain('<details class="workspace-navigation-disclosure" id="workspace-navigation" open>');
  expect(html).toContain('<summary><span>Workspaces</span><span id="workspace-navigation-current">Today</span></summary>');
  const nav = html.match(/<nav class="domain-nav"[\s\S]*?<\/nav>/)?.[0];
  expect(nav).toBeDefined();
  const found = [...nav!.matchAll(/<details class="workspace-group" data-workspace-group="([^"]+)"(?: open)?>([\s\S]*?)<\/details>/g)];
  expect(found.map(match => match[1])).toEqual(Object.keys(groups));
  for (const [index, [key, expectedButtons]] of Object.entries(groups).entries()) {
    const body = found[index]?.[2] ?? "";
    expect(body.match(/<summary><span>[^<]+<\/span><span class="workspace-group-count">\d+<\/span><\/summary>/g)).toHaveLength(1);
    expect(body.match(/<div class="workspace-group-items">/g)).toHaveLength(1);
    expect([...body.matchAll(/<button[^>]+id="([^"]+)"[^>]+data-view="([^"]+)"[^>]+aria-controls="([^"]+)"/g)]
      .map(match => [match[1], match[2], match[3]])).toEqual(expectedButtons.map(([id, view]) => [id, view, `${view}-view`]));
    expect(Number(body.match(/workspace-group-count">(\d+)/)?.[1])).toBe(expectedButtons.length);
    expect(found[index]?.[1]).toBe(key);
  }
  for (const expectedButtons of Object.values(groups)) for (const [id, view] of expectedButtons) {
    expect(html.match(new RegExp(`id="${escapeRegExp(id)}"`, "g"))).toHaveLength(1);
    expect(html).toContain(`id="${id}" type="button" data-view="${view}" aria-controls="${view}-view"`);
  }
  expect(nav!.match(/<button[^>]+data-view=/g)).toHaveLength(15);
  expect(`${html}\n${operator}\n${layouts}`).not.toMatch(/secondary-workspaces|secondary-workspaces-toggle|More workspaces/);
});

test("Order459 active groups reveal without replacing navigation or weakening keyboard behavior", () => {
  for (const contract of [
    'const workspaceGroups = [...document.querySelectorAll(".workspace-group")]',
    "function resetWorkspaceGroups()", 'group.dataset.workspaceGroup === "front-desk"',
    "function revealWorkspaceGroup(view)", 'group.classList.toggle("contains-current", current)',
    "group.open = current", 'if (event.key !== "Escape" || !group.open) return',
    "group.open = false", 'group.querySelector("summary")?.focus({ preventScroll: true })',
    "function syncWorkspaceGroupPresentation()", 'group.removeAttribute("name")',
    'group.setAttribute("name", "ledger-workspace-rail")',
    'workspaceSkinSelect.addEventListener("change", syncWorkspaceGroupPresentation)',
    'workspaceNavigation.open = !compactWorkspaceNavigation.matches',
    'workspaceNavigationCurrent.textContent = workbenchTitle.textContent',
    'compactWorkspaceNavigation.addEventListener("change"',
  ]) expect(operator).toContain(contract);
  expect(operator).toContain("revealWorkspaceGroup(activeView)");
  expect(operator).toContain("finishWorkspaceNavigation(tab.dataset.view)");
  expect(layouts).toContain("groupDisclosure = new Map");
  expect(layouts).toContain("for (const group of groupDisclosure.keys()) group.open = true");
  expect(layouts).toContain("closeLauncher({ restoreDisclosure: false, restoreFocus: false })");
  expect(layouts).toContain("closeLauncher({ restoreFocus: true })");
});

test("Order459 controller only annotates live source nodes and owns presentation-only controls", () => {
  for (const contract of [
    'tools.className = "operator-layout-tools"', "tools.dataset.layoutOwned", 'launcher.id = "layout-workspace-launcher"',
    'launcher.textContent = "Find a workspace"', 'chapterNav.setAttribute("role", "tablist")',
    "button.dataset.layoutChapterChoice", 'focusAction.className = "quiet layout-focus-action"',
    'mark(route, "record")', 'route.classList.add("is-layout-active")', "route.dataset.layoutView",
    'mark(lane, "chapter")', "lane.dataset.layoutChapter", 'skin === "journey" && id === chapter',
    'workbench.dataset.layoutLauncher = "open"', 'attributeFilter: ["hidden"]',
    'attributeFilter: ["data-workspace-skin"]',
  ]) expect(layouts).toContain(contract);
  expect(layouts.match(/new MutationObserver/g)).toHaveLength(2);
  expect(layouts).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie/);
  expect(layouts).not.toMatch(/history\.|location\.|requestSubmit|\.submit\s*\(|cloneNode|replaceChildren|innerHTML|outerHTML/);
  expect(layouts).not.toMatch(/appendChild\s*\(\s*(?:domainBar|domainNav|workbench)|insertBefore\s*\(\s*(?:domainBar|domainNav|workbench)/);
  expect(layouts).toContain("tools.append(launcher, chapterNav, focusAction)");
  expect(layouts).toContain("domainBar.before(tools)");
  expect(interfaces).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
});

test("Order459 keeps approved 03–10 composition references explicit and excludes 01/02", () => {
  const references = {
    ledger: ["03-ledger.html", "Ledger reservation record", "Folio 1 of 1"],
    aura: ["04-aura.html", "Everything around one arrival", "A quiet floor"],
    relay: ["05-dispatch.html", "The arrival handoff", "Room inspection"],
    journey: ["06-canvas.html", "One arrival, in chapters", "Prepare the stay"] ,
    orbit: ["07-orbit.html", "Ask once. Inspect everything", "command concierge"],
    atlas: ["08-atlas.html", "Atlas portfolio map", "Willow 14"],
    focus: ["09-focus.html", "Focus mobile operations", "Room turn"],
    index: ["10-index.html", "Room tape", "Your whole house"],
  } as const;
  expect(Object.keys(references)).toEqual([...skins]);
  for (const [skin, [file, ...markers]] of Object.entries(references)) {
    const prototype = read(`../docs/design/prototypes/light-explorations/${file}`);
    expect(prototype.length).toBeGreaterThan(1_000);
    for (const marker of markers) expect(prototype.toLowerCase()).toContain(marker.toLowerCase());
    expect(file).toMatch(/^(?:0[3-9]|10)-/);
    expect(skin).not.toMatch(/^(?:01|02)$/);
  }
});

test("Order459 CSS declares desktop topology plus responsive, reduced-motion and forced-colour fallbacks", () => {
  const compact = css.replace(/\s+/g, " ");
  const topology = {
    ledger: [
      'grid-template-areas: "ledger-head" "ledger-tools" "ledger-rail" "ledger-record"',
      'grid-template-areas: "ledger-master ledger-context ledger-detail-pane"',
      'grid-template-areas: "ledger-queue ledger-detail"',
    ],
    aura: [
      'grid-template-areas: "aura-dock aura-head" "aura-dock aura-tools" "aura-dock aura-record"',
      'grid-template-areas: "aura-leaf aura-centre aura-folio"',
      'grid-template-areas: "aura-queue aura-detail"',
      '[data-workspace-skin="aura"] .today-lane:nth-child(3) { transform: translateY(48px)',
    ],
    relay: [
      'grid-template-areas: "relay-rail relay-head" "relay-rail relay-tools" "relay-rail relay-record"',
      'grid-template-areas: "relay-due-in relay-due-out relay-in-house"',
      'grid-template-areas: "relay-queue relay-detail"',
    ],
    journey: [
      'grid-template-areas: "journey-chapters journey-head" "journey-chapters journey-tools" "journey-chapters journey-record"',
      'grid-template-areas: "journey-queue journey-detail"',
      '[data-workspace-skin="journey"] .today-lane.is-layout-current',
    ],
    orbit: [
      'grid-template-areas: "orbit-head" "orbit-command" "orbit-navigation" "orbit-record"',
      'grid-template-areas: "orbit-queue orbit-detail"',
      '[data-workspace-skin="orbit"] .today-lane[data-today-lane="in_house"] { grid-column: 3 / span 8',
    ],
    atlas: [
      'grid-template-areas: "atlas-portfolio atlas-head" "atlas-portfolio atlas-tools" "atlas-portfolio atlas-record"',
      'grid-template-areas: "atlas-arrivals atlas-arrivals atlas-arrivals atlas-arrivals atlas-arrivals atlas-arrivals atlas-arrivals atlas-arrivals atlas-turns atlas-turns atlas-turns atlas-turns" ". . . atlas-stays atlas-stays atlas-stays atlas-stays atlas-stays atlas-stays atlas-stays atlas-stays atlas-stays"',
      'grid-template-areas: "atlas-queue atlas-queue atlas-queue atlas-detail atlas-detail atlas-detail atlas-detail atlas-detail atlas-detail atlas-detail atlas-detail atlas-detail"',
    ],
    focus: [
      'grid-template-areas: "focus-tasks focus-head" "focus-tasks focus-tools" "focus-tasks focus-record"',
      'grid-template-areas: "focus-queue" "focus-detail"',
      '[data-workspace-skin="focus"] .layout-focus-action',
    ],
    index: [
      'grid-template-areas: "index-rail index-head" "index-rail index-tools" "index-rail index-record"',
      'grid-template-areas: "index-due-in index-due-out index-in-house"',
      'grid-template-areas: "index-queue index-detail"',
    ],
  } as const;
  expect(Object.keys(topology)).toEqual([...skins]);
  for (const fragments of Object.values(topology)) for (const fragment of fragments) {
    expect(compact.includes(fragment), fragment).toBe(true);
  }
  for (const skin of skins) for (const role of ["queue", "detail"] as const) {
    const fragment = `[data-workspace-skin="${skin}"] .invoice-workbench__layout > [data-layout-role="${role}"] { grid-area: ${skin}-${role}`;
    expect(compact.includes(fragment), fragment).toBe(true);
  }
  expect(css).toContain('@media (min-width: 1021px)');
  expect(css).toContain('@media (max-width: 1020px)');
  expect(css).toContain('@media (max-width: 680px)');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('[data-interface-motion="reduced"]');
  expect(css).toContain('.workspace-navigation-disclosure:not([open]) > .domain-nav');
  expect(css).toContain('.workspace-navigation-disclosure[open] > .domain-nav');
  expect(css).toContain('max-height: 60dvh');
});
