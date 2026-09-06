import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const root = resolve(import.meta.dir, "..");
const markup = await Bun.file(resolve(root, "src/http/operator/index.html")).text();
const operator = await Bun.file(resolve(root, "src/http/operator/operator.js")).text();
const css = resolve(root, "src/http/operator/operator.css").replaceAll("\\", "/");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"),
  Bun.which("chromium"),
  Bun.which("chromium-browser"),
].find((path): path is string => Boolean(path && existsSync(path)));

const trustMarkup = markup.match(/<section id="trust-view"[\s\S]*?<section id="status-view"/)?.[0].replace(/<section id="status-view"$/, "");
if (!trustMarkup) throw new Error("production owner-trust workbench is missing");

async function chromium(width: number, theme: string) {
  if (!browser) throw new Error("Chrome or Edge is required for Order386 browser proof");
  const dir = await mkdtemp(resolve(tmpdir(), "yellow-386-ui-"));
  const file = resolve(dir, "proof.html");
  const html = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="file:///${css}"></head><body><main>${trustMarkup}</main><pre id="proof"></pre><script>
  const view=document.querySelector('#trust-view');view.hidden=false;const account=document.querySelector('#trust-account');account.disabled=false;account.replaceChildren(new Option('Owner ledger · Riverstone Holdings · USD','account-a'));const amount=document.querySelector('#trust-amount'),reason=document.querySelector('#trust-reason'),preview=document.querySelector('#trust-preview-action');amount.disabled=false;reason.disabled=false;preview.disabled=false;account.focus();const visibleButtons=[...document.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height).filter(Boolean);document.querySelector('#proof').textContent=JSON.stringify({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth<=innerWidth,focus:document.activeElement===account,minHeight:Math.min(...visibleButtons),labels:[...document.querySelectorAll('label')].every(x=>x.control),noIdPaste:![...document.querySelectorAll('input')].some(x=>/approval|account.*id/i.test(x.name||x.id)),inbox:!!document.querySelector('#trust-approval-inbox')});
  </script></body></html>`;
  await writeFile(file, html);
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", `--user-data-dir=${resolve(dir, "profile")}`, `--window-size=${width},900`, "--virtual-time-budget=2000", "--dump-dom", file], { timeoutMs: 8_000 });
    const output = result.stdout; expect(result.exitCode).toBe(0);
    const encoded = output.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1]; if (!encoded) throw new Error("browser proof did not complete");
    return JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  } finally { await rm(dir, { recursive:true, force:true }); }
}

test("Order386 UI binds only minimized routes with stale and ambiguous retry controls", () => {
  expect(operator).toContain("trustIsCurrent(generation, property, identity)");
  expect(operator).toContain('activeView !== "trust"');
  expect(operator).toContain("trustMutationKeys.get(identity) || crypto.randomUUID()");
  expect(operator).toContain("if (error?.status) trustMutationKeys.delete(identity)");
  expect(operator).toContain('/trust/accounts/${enc(draft.accountId)}/preview');
  expect(operator).toContain('/trust/approval-requests/${enc(approval.approvalId)}/${action}');
  expect(operator).toContain("approvalRequestId: preview.approvalId");
  expect(operator).not.toContain("payableAccountId");
});

test("Order386 workbench is keyboard-labelled and contained across six appearances", async () => {
  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) for (const width of [390,1280]) {
    const proof = await chromium(width, theme);
    expect(proof).toMatchObject({ theme, overflow:true, focus:true, labels:true, noIdPaste:true, inbox:true });
    expect(Number(proof.minHeight)).toBeGreaterThanOrEqual(theme === "android" ? 48 : 44);
  }
}, 90_000);
