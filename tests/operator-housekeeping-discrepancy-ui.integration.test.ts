import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order 235 operator discrepancy workbench", () => {
  test("renders one explicit observation form and an independently refreshable unresolved list", () => {
    for (const hook of [
      "housekeeping-discrepancy-workbench",
      "housekeeping-discrepancy-space",
      "housekeeping-discrepancy-persons",
      "housekeeping-discrepancy-submit",
      "housekeeping-discrepancy-refresh",
      "housekeeping-discrepancy-list",
    ]) {
      expect(html).toContain(`id="${hook}"`);
    }
    expect(html).toContain("Report room observation");
    expect(html).toContain("Unresolved room discrepancies");
    const form = html.slice(html.indexOf('id="housekeeping-discrepancy-report-form"'), html.indexOf('id="housekeeping-discrepancy-status"'));
    expect(form).toContain('value="vacant"');
    expect(form).toContain('value="occupied"');
    expect(form).not.toContain("checked");
  });

  test("uses strict route/property/request-generation guards and authoritative reloads", () => {
    expect(js).toContain("housekeepingDiscrepancyIsCurrent");
    expect(js).toContain("housekeepingDiscrepancyGeneration");
    expect(js).toContain("housekeepingDiscrepancyRequestGeneration");
    expect(js).toContain('property === propertySelect.value && activeView === "housekeeping"');
    expect(js).toContain('location.pathname === `/p/${property}/housekeeping`');
    expect(js).toContain('location.search === ""');
    expect(js).toContain("loadHousekeepingDiscrepancies");
    expect(js).toContain("loadHousekeepingConditions");
  });

  test("submits only explicit observation truth with retry-stable idempotency", () => {
    expect(js).toContain("observedPresence");
    expect(js).toContain("observedPersons");
    expect(js).toContain('"idempotency-key"');
    expect(js).toContain("crypto.randomUUID()");
    expect(js).toContain("housekeepingDiscrepancyAttempts");
    expect(js).toContain("updateHousekeepingDiscrepancyPresence(true)");
    expect(js).toContain("created");
    expect(js).toContain("replayed");
    expect(js).toContain("no discrepancy was created");
  });

  test("does not poll, persist browser truth, or optimistically insert discrepancies", () => {
    const implementation = js.slice(js.indexOf("function housekeepingDiscrepancyIsCurrent"), js.indexOf("function canonicalHousekeepingTaskDetailPath"));
    expect(implementation).not.toContain("setInterval(");
    expect(implementation).not.toContain("localStorage");
    expect(implementation).not.toContain("sessionStorage");
    expect(implementation).not.toMatch(/housekeepingDiscrepancyRows\.(push|unshift|splice)\(/);
  });

  test("keeps the bounded workbench accessible and distinct across every supported theme", () => {
    for (const selector of [
      ':root[data-theme="apple"]',
      ':root[data-theme="android"]',
      ':root[data-theme="win95"]',
      ':root[data-theme="glass"]',
      ':root[data-theme="neo"]',
      ':root[data-theme="erp"]',
    ]) {
      expect(css).toContain(`${selector} .housekeeping-discrepancy-workbench`);
    }
    expect(css).toContain("@media (max-width: 780px)");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
