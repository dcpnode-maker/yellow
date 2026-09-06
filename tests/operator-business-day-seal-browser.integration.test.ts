import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const root = resolve(import.meta.dir, "..");
const operator = await Bun.file(resolve(root, "src/http/operator/operator.js")).text();
const markup = await Bun.file(resolve(root, "src/http/operator/index.html")).text();
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

function slice(start: string, end: string) {
  const from = operator.indexOf(start), to = operator.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`production UI boundary missing: ${start}`);
  return operator.slice(from, to);
}

const declarations = slice(" const dayCloseSeal =", " const dayCloseCarryKeys");
const behavior = slice(" function dayCloseSealIsCurrent", " async function runDayCloseApprovalAction");
const dialogMarkup = markup.match(/<dialog class="day-close-seal-dialog"[\s\S]*?<\/dialog>/)?.[0];
if (!dialogMarkup) throw new Error("production seal dialog is missing");

async function chromium(html: string, width: number, theme: string) {
  if (!browser) throw new Error("Chrome or Edge is required for Order389 browser proof");
  const dir = await mkdtemp(resolve(tmpdir(), "yellow-389-ui-"));
  const file = resolve(dir, "proof.html");
  await writeFile(file, html.replace("THEME", theme));
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", `--user-data-dir=${resolve(dir, "profile")}`, `--window-size=${width},900`, "--virtual-time-budget=4000", "--dump-dom", file], { timeoutMs: 8_000 });
    const output = result.stdout;
    expect(result.exitCode).toBe(0);
    const encoded = output.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!encoded) throw new Error(`browser proof did not complete: ${output.slice(-600)}`);
    return JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&")) as Record<string, unknown>;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const fixture = `<!doctype html><html data-theme="THEME"><head><meta charset="utf-8"><link rel="stylesheet" href="file:///${css}"></head><body>
<select id="property-select"><option value="property-a">Hotel</option></select><select id="day-close-date"><option value="2026-09-02">2026-09-02</option></select>
<section class="card day-close-seal" id="day-close-seal"><div><h3>Seal selected business day</h3><p>Permanent.</p></div><button class="danger day-close-seal-open" id="day-close-seal-open" type="button" data-business-date="2026-09-02">Seal business day</button></section>
<p id="day-close-status"></p>${dialogMarkup}<pre id="proof"></pre>
<script>
const $=s=>document.querySelector(s), enc=encodeURIComponent, propertySelect=$("#property-select"), dayCloseDate=$("#day-close-date"), dayCloseStatus=$("#day-close-status");
let activeView="day-close", dayCloseRequestGeneration=7, mode="success"; const calls=[], refreshes=[];
const request=async(url,options={})=>{calls.push({url,method:options.method,key:options.headers?.["Idempotency-Key"],hasBody:Object.prototype.hasOwnProperty.call(options,"body")});if(mode==="ambiguous")throw new Error("network");if(mode==="definitive"){const e=new Error("not permitted");e.status=403;throw e;}return {sealed:true};};
const loadDayCloseWorkbench=async options=>{refreshes.push(options)};
${declarations}
${behavior}
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{const out={};
dayCloseSealOpen.click();out.open=dayCloseSealDialog.open;out.initialFocus=document.activeElement===dayCloseSealCancel;out.minHeight=Math.min(dayCloseSealOpen.getBoundingClientRect().height,dayCloseSealCancel.getBoundingClientRect().height,dayCloseSealConfirm.getBoundingClientRect().height);dayCloseSealCancel.click();await tick();out.cancelCalls=calls.length;out.cancelFocus=document.activeElement===dayCloseSealOpen;
const staleBefore=calls.length;
for(const stale of ["view","property","date","generation"]){dayCloseSealOpen.click();if(stale==="view")activeView="folios";if(stale==="property")propertySelect.value="";if(stale==="date")dayCloseDate.value="";if(stale==="generation")dayCloseRequestGeneration+=1;dayCloseSealForm.requestSubmit();await tick();activeView="day-close";propertySelect.value="property-a";dayCloseDate.value="2026-09-02";dayCloseRequestGeneration=7;}out.staleSuppressed=calls.length===staleBefore;
dayCloseSealOpen.click();dayCloseSealDialog.close();await tick();out.nativeCloseCalls=calls.length;out.nativeCloseFocus=document.activeElement===dayCloseSealOpen;
dayCloseSealOpen.click();mode="ambiguous";dayCloseSealForm.requestSubmit();await tick();await tick();const first=calls.at(-1);out.ambiguousRefresh=refreshes.length;out.ambiguousFocus=document.activeElement===dayCloseSealOpen;
dayCloseSealOpen.click();dayCloseSealForm.requestSubmit();await tick();await tick();const second=calls.at(-1);out.retrySame=first.key===second.key;out.zeroBytes=!first.hasBody;out.post=first.method;out.path=first.url;out.ascii=/^[\\x20-\\x7e]{8,200}$/.test(first.key);
dayCloseSealOpen.click();mode="definitive";dayCloseSealForm.requestSubmit();await tick();await tick();const definitive=calls.at(-1);
dayCloseSealOpen.click();mode="success";dayCloseSealForm.requestSubmit();await tick();await tick();const success=calls.at(-1);out.definitiveClears=definitive.key!==success.key;out.everyResultRefreshes=refreshes.length===4;out.dialogClosed=!dayCloseSealDialog.open;
out.theme=document.documentElement.dataset.theme;out.overflow=document.documentElement.scrollWidth<=innerWidth;
$("#proof").textContent=JSON.stringify(out);})();
</script></body></html>`;

test("Order389 executes deliberate seal retry, refresh, focus and six-theme geometry in Chromium", async () => {
  expect(operator).toContain("dayCloseSeal.hidden = result.readiness.ready !== true");
  expect(operator).toContain("recoverSealed && businessDate && error?.status === 404");
  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    for (const width of [390, 1280]) {
      const proof = await chromium(fixture, width, theme);
      expect(proof).toMatchObject({ open: true, initialFocus: true, cancelCalls: 0, cancelFocus: true, staleSuppressed: true, nativeCloseCalls: 0, nativeCloseFocus: true, ambiguousRefresh: 1, ambiguousFocus: true, retrySame: true, zeroBytes: true, post: "POST", path: "/api/v1/properties/property-a/business-days/2026-09-02/seal", ascii: true, definitiveClears: true, everyResultRefreshes: true, dialogClosed: true, theme, overflow: true });
      expect(Number(proof.minHeight)).toBeGreaterThanOrEqual(theme === "android" ? 48 : 44);
    }
  }
}, 90_000);
