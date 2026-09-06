import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const root = resolve(import.meta.dir, "..");
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

function slice(start: string, end: string) {
  const from = operator.indexOf(start), to = operator.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`production UI boundary missing: ${start}`);
  return operator.slice(from, to);
}

const dialogProduction = slice(" const dayCloseCarryKeys", " let dayCloseRequestGeneration")
  .replaceAll("await loadDayCloseWorkbench({ businessDate: draft.selected, focus: true })", "await refreshWorkbench(draft.selected)");
const behaviorProduction = slice(" function renderDayClose(", " async function loadDayCloseWorkbench(")
  .replaceAll("await loadDayCloseWorkbench({ businessDate: dayCloseDate.value, focus: true })", "await refreshWorkbench(dayCloseDate.value)");

async function chromium(html: string, width: number, theme: string) {
  if (!browser) throw new Error("Chrome or Edge is required for Order395 browser proof");
  const dir = await mkdtemp(resolve(tmpdir(), "yellow-395-ui-"));
  const file = resolve(dir, "proof.html");
  await writeFile(file, html.replace("THEME", theme));
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", `--user-data-dir=${resolve(dir, "profile")}`, `--window-size=${width},900`, "--virtual-time-budget=3000", "--dump-dom", file], { timeoutMs: 8_000 });
    const output = result.stdout;
    expect(result.exitCode).toBe(0);
    const encoded = output.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!encoded) throw new Error(`browser proof did not complete: ${output.slice(-500)}`);
    return JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&")) as Record<string, unknown>;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const fixture = `<!doctype html><html data-theme="THEME"><head><meta charset="utf-8"><link rel="stylesheet" href="file:///${css}"></head><body>
<select id="property"><option value="property-a">Hotel</option></select><section id="day-close-content"></section><ul id="day-close-candidates"></ul><p id="day-close-status"></p><select id="day-close-date"><option value="2026-09-02">2026-09-02</option></select><pre id="proof"></pre>
<script>
const $=s=>document.querySelector(s), enc=encodeURIComponent, propertySelect=$("#property"), dayCloseContent=$("#day-close-content"), dayCloseCandidates=$("#day-close-candidates"), dayCloseStatus=$("#day-close-status"), dayCloseDate=$("#day-close-date");
const dayCloseSelected=document.createElement("span"),dayCloseCurrent=document.createElement("span"),dayCloseReady=document.createElement("span"),dayCloseOutboxLag=document.createElement("span"),dayCloseReasons=document.createElement("ul"),dayCloseError={hidden:true}, activeView="day-close";
const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.append(document.createTextNode(text));return n};
const encCalls=[], refreshes=[]; let mode="", pending=[];
const request=(url,options={})=>{encCalls.push({url,key:options.headers?.["idempotency-key"]||"",body:options.body||""});if(mode==="fail"){mode="";return Promise.reject(new Error("ambiguous"));}if(mode==="defer")return new Promise(resolve=>pending.push(resolve));return Promise.resolve({approvals:[]});};
const refreshWorkbench=async date=>{refreshes.push(date)}; const reservationDateTime=x=>x; const history={replaceState(){}}; const dayCloseCanonicalPath=()=>"/"; const dayCloseLagLabel=()=>"none";
${dialogProduction}
${behaviorProduction}
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{const out={};
renderDayClose({businessDate:"2026-09-02",currentOpenBusinessDate:"2026-09-03",openDays:[{businessDate:"2026-09-02"}],readiness:{ready:false,outboxLag:{kind:"none"},reasons:[]},carryCandidates:[{discrepancyId:"d1",spaceCode:"101",reportedBusinessDate:"2026-09-02"}],capturedAt:"now"});
const requestButton=dayCloseCandidates.querySelector("button");requestButton.click();out.dialogOpen=dayCloseCarryDialog.open;out.dialogDisplay=getComputedStyle(dayCloseCarryDialog).display;out.requestFocus=document.activeElement===dayCloseCarryReason;
dayCloseCarryDialog.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));dayCloseCarryDialog.close();requestButton.click();dayCloseCarryCancel.click();out.cancelled=!dayCloseCarryDialog.open;
requestButton.click();dayCloseCarryReason.value="Night audit handoff";mode="fail";dayCloseCarryForm.requestSubmit();await tick();const first=encCalls.at(-1).key;out.failureFocus=document.activeElement===dayCloseCarryReason;dayCloseCarryForm.requestSubmit();await tick();const second=encCalls.at(-1).key;
requestButton.click();dayCloseCarryReason.value="Again";dayCloseCarryForm.requestSubmit();await tick();const third=encCalls.at(-1).key;out.requestRetrySame=first===second;out.requestSuccessClears=third!==second;
const approvals=[{approvalId:"a1",roomCode:"101",sourceBusinessDate:"2026-09-02",targetBusinessDate:"2026-09-03",status:"pending",reason:"r",canDecide:true,canCarry:false},{approvalId:"a2",roomCode:"102",sourceBusinessDate:"2026-09-02",targetBusinessDate:"2026-09-03",status:"approved",reason:"r",canDecide:false,canCarry:true}];
mode="defer";const stale=loadDayCloseCarryApprovals();const current=loadDayCloseCarryApprovals();pending[1]({approvals});await current;pending[0]({approvals:[]});await stale;mode="";out.staleSuppressed=dayCloseApprovalList.querySelectorAll("li").length===2;
for(const label of ["Approve","Reject","Carry"]){const b=[...dayCloseApprovalList.querySelectorAll("button")].find(x=>x.textContent===label);b.click();await tick();}out.actions=encCalls.slice(-3).map(x=>x.url.split("/").at(-1));
const approve=[...dayCloseApprovalList.querySelectorAll("button")].find(x=>x.textContent==="Approve");mode="fail";approve.click();await tick();await tick();const actionFirst=encCalls.at(-1).key;out.actionFailureFocus=document.activeElement===approve;approve.click();await tick();out.actionRetrySame=actionFirst===encCalls.at(-1).key;
out.theme=document.documentElement.dataset.theme;out.width=innerWidth;out.overflow=document.documentElement.scrollWidth<=innerWidth;out.actionMinHeight=Math.min(...[...dayCloseApprovalList.querySelectorAll("button")].map(x=>x.getBoundingClientRect().height));
$("#proof").textContent=JSON.stringify(out);
})();
</script></body></html>`;

test("Order395 executes carry workflow, retry safety, stale suppression, focus and all approved appearances in a browser", async () => {
  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    for (const width of [390, 1280]) {
      const proof = await chromium(fixture, width, theme);
      expect(proof).toMatchObject({ dialogOpen: true, requestFocus: true, cancelled: true, failureFocus: true, requestRetrySame: true, requestSuccessClears: true, staleSuppressed: true, actions: ["approve", "reject", "carry"], actionRetrySame: true, actionFailureFocus: true, theme, overflow: true });
      expect(proof.dialogDisplay).not.toBe("none");
      if (theme === "android") expect(Number(proof.actionMinHeight)).toBeGreaterThanOrEqual(48);
    }
  }
}, 60_000);
