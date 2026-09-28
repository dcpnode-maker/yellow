import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

// Execute the actual allowlist, handler and registered listener. Other workspace
// state is frozen, and any attempt to use rendering, navigation or a request fails.
function createHarness() {
  const allowlist = script.match(/const WORKSPACE_SKINS = new Set\([^;]+;/)?.[0];
  const handler = script.match(/function applyWorkspaceSkin\(skin\) \{[\s\S]*?\n \}/)?.[0];
  const listener = script.match(/workspaceSkinSelect\.addEventListener\("change",[^\n]+/)?.[0];
  if (!allowlist || !handler || !listener) throw new Error("Workspace skin source is missing");

  const touches: string[] = [];
  const forbidden = (operation: string) => () => {
    touches.push(operation);
    throw new Error(`Skin switching must not ${operation}`);
  };
  const nameInput = Object.freeze({ value: "Mira Fernandes", selectionStart: 5, selectionEnd: 9 });
  const reasonInput = Object.freeze({ value: "Keep the room beside the lift for arrival." });
  const confirmInput = Object.freeze({ checked: true });
  const roomSelect = Object.freeze({ value: "room-412" });
  const partyInput = Object.freeze({ value: "party-mira" });
  const form = Object.freeze({
    elements: Object.freeze({ name: nameInput, reason: reasonInput, confirm: confirmInput, room: roomSelect, primaryPartyId: partyInput }),
    reset: forbidden("reset a form"),
    replaceChildren: forbidden("replace form controls"),
  });
  const workspace = Object.freeze({
    form, selectedSubject: "reservation-mira-412", selectedTask: "arrival-cleaning-412",
    requestKey: "arrival-request-original-key", activeView: "reservations", propertyId: "property-mumbai",
    replaceChildren: forbidden("replace workspace contents"),
  });
  const dataset: Record<string, string> = { theme: "glass", experience: "advanced", workspaceSkin: "calm" };
  const guardedDataset = new Proxy(dataset, {
    set(target, property, value: unknown) {
      if (property !== "workspaceSkin") forbidden(`change ${String(property)}`)();
      touches.push("presentation");
      target[String(property)] = String(value);
      return true;
    },
  });
  const listeners = new Map<string, () => void>();
  const select = {
    value: "calm",
    addEventListener(event: string, callback: () => void) { listeners.set(event, callback); },
  };
  const document = Object.freeze({
    documentElement: Object.freeze({ dataset: guardedDataset }),
    activeElement: select,
    querySelector: forbidden("query and replace an existing workspace"),
    querySelectorAll: forbidden("query and replace form controls"),
  });
  const build = new Function(
    "document", "workspaceSkinSelect", "fetch", "request", "setView", "transitionWorkspace", "renderPartyProfiles", "workspace",
    `"use strict"; ${allowlist}\n${handler}\n${listener}\nreturn applyWorkspaceSkin;`,
  );
  const apply = build(document, select, forbidden("fetch"), forbidden("send a request"), forbidden("navigate"),
    forbidden("transition and repaint the workspace"), forbidden("render profiles"), workspace) as (skin: unknown) => void;
  return {
    workspace, document, select, dataset, touches, apply,
    change(skin: string) {
      select.value = skin;
      const change = listeners.get("change");
      if (!change) throw new Error("Skin change listener was not registered");
      change();
    },
  };
}

describe("Order442 workspace skins preserve active work", () => {
  test("the native selector advertises three skins independently of appearance and detail", () => {
    const choices = html.match(/<select id="workspace-skin-select"[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(choices).toContain('aria-label="Workspace skin"');
    expect([...choices.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
      .map((match) => [match[1], match[2]])).toEqual([
        ["calm", "Calm Workbench"], ["precision", "Precision Desk"], ["timeline", "Service Timeline"],
      ]);
    expect(html).toContain('data-workspace-skin="calm"');
    expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
    expect(script).toContain("applyWorkspaceSkin(workspaceSkinSelect.value);");
  });

  test("the registered change handler preserves filled fields, selected subject and request identity", () => {
    const harness = createHarness();
    const form = harness.workspace.form;
    const fields = form.elements;
    for (const skin of ["precision", "timeline", "calm", "timeline", "precision"]) {
      harness.change(skin);
      expect(harness.dataset).toEqual({ theme: "glass", experience: "advanced", workspaceSkin: skin });
      expect(harness.select.value).toBe(skin);
      expect(harness.document.activeElement).toBe(harness.select);
      expect(harness.workspace.form).toBe(form);
      expect(harness.workspace.form.elements).toBe(fields);
      expect(fields.name).toEqual({ value: "Mira Fernandes", selectionStart: 5, selectionEnd: 9 });
      expect(fields.reason.value).toBe("Keep the room beside the lift for arrival.");
      expect(fields.confirm.checked).toBe(true);
      expect(fields.room.value).toBe("room-412");
      expect(fields.primaryPartyId.value).toBe("party-mira");
      expect(harness.workspace.selectedSubject).toBe("reservation-mira-412");
      expect(harness.workspace.selectedTask).toBe("arrival-cleaning-412");
      expect(harness.workspace.requestKey).toBe("arrival-request-original-key");
      expect(harness.workspace.activeView).toBe("reservations");
      expect(harness.workspace.propertyId).toBe("property-mumbai");
    }
    expect(harness.touches).toEqual(Array.from({ length: 5 }, () => "presentation"));
  });

  test("unknown values fall back to Calm without changing appearance or active work", () => {
    const harness = createHarness();
    for (const value of ["", "glass", "Precision", "__proto__", "constructor", null, undefined, { skin: "timeline" }]) {
      harness.apply(value);
      expect(harness.dataset.workspaceSkin).toBe("calm");
      expect(harness.select.value).toBe("calm");
      expect(harness.dataset.theme).toBe("glass");
      expect(harness.dataset.experience).toBe("advanced");
      expect(harness.workspace.form.elements.confirm.checked).toBe(true);
      expect(harness.workspace.requestKey).toBe("arrival-request-original-key");
    }
    harness.change("invented-skin");
    expect(harness.dataset.workspaceSkin).toBe("calm");
    expect(harness.select.value).toBe("calm");
    expect(harness.touches.every((touch) => touch === "presentation")).toBe(true);
  });

  test("session-only presentation uses no browser storage or network assets", () => {
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    expect(`${html}\n${css}\n${script}`).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  });

  test("the light Glass palette retains readable text, focus and control boundaries", () => {
    const glass = css.slice(css.indexOf("/* Order 442:"));
    const token = (name: string) => {
      const value = glass.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      if (!value) throw new Error(`Missing light Glass token: ${name}`);
      return value;
    };
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
    };
    const contrast = (a: string, b: string) => {
      const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
      return (high! + .05) / (low! + .05);
    };
    for (const background of [token("--paper"), token("--card"), token("--surface-subtle")]) {
      expect(contrast(token("--ink"), background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token("--muted"), background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token("--focus"), background)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(token("--accent"), token("--accent-ink"))).toBeGreaterThanOrEqual(4.5);
    const controlBorder = glass.match(/--material-control-border:\s*1px solid (#[0-9a-f]{6})/)?.[1];
    if (!controlBorder) throw new Error("Missing light Glass control border");
    expect(contrast(controlBorder, token("--material-control"))).toBeGreaterThanOrEqual(3);
    expect(contrast(controlBorder, token("--paper"))).toBeGreaterThanOrEqual(3);
  });
});
