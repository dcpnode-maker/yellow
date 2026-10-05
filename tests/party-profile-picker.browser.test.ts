import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "..");
const modulePath = resolve(repository, "src/http/operator/party-profile-picker.js");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

type CdpSend = <Result>(method: string, params?: Record<string, unknown>) => Promise<Result>;

async function withOwnedCdp<Result>(profile: string, url: string, run: (send: CdpSend) => Promise<Result>): Promise<Result> {
  if (!browser) throw new Error("Chrome or Edge is required for the Order 445 picker proof");
  const child = Bun.spawn([
    browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdout: "ignore", stderr: "ignore" });
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? "";
      } catch (error) {
        if (!(typeof error === "object" && error !== null && ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code)))) throw error;
      }
      if (port || child.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${child.exitCode ?? "unknown"})`);
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Chromium debugger socket failed")), { once: true });
      socket.addEventListener("message", event => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
        if (!message.id) return;
        const command = pending.get(message.id);
        if (!command) return;
        pending.delete(message.id);
        if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed"));
        else command.resolve(message.result);
      });
    });
    const send: CdpSend = <Result>(method: string, params: Record<string, unknown> = {}) => new Promise<Result>((resolveCommand, rejectCommand) => {
      nextId += 1;
      pending.set(nextId, { resolve: value => resolveCommand(value as Result), reject: rejectCommand });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
    try {
      return await run(send);
    } finally {
      socket.close();
    }
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

function page(): string {
  return String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body><main><form id="allocation-form"><div id="parent-host"></div><div id="nfkc-host"></div><div id="guard-host"></div><div id="search-host"></div><div id="duplicate-host"></div><div id="retry-host"></div><div id="late-host"></div><div id="stale-host"></div><button id="save-allocation" type="submit">Save guests and shares</button></form></main>
  <script type="module">
  import { createPartyProfilePicker } from "/assets/operator-party-profile-picker.js";
  const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const waitFor=async check=>{for(let i=0;i<200;i+=1){if(check())return;await sleep(10)}throw new Error('browser proof condition timed out')};
  const fail=(status,type,candidates)=>{const error=new Error(type);error.status=status;error.problem={type,...(candidates?{candidates}:{})};throw error};
  const calls=[];const selected=[];let clears=0;let current=true;let resolveLate;let duplicateCreates=0;let retryCreates=0;let parentSubmits=0;
  document.querySelector('#allocation-form').addEventListener('submit',event=>{event.preventDefault();parentSubmits+=1});
  const excluded=uuid(1);
  const candidates=[
    {partyId:uuid(3),displayNameHint:'A••• R•••',reasons:['exact email'],contacts:[{kind:'email',hint:'a•••@example.test',value:'never-render@example.test'}]},
    {partyId:excluded,displayNameHint:'P•••••• G••••',reasons:['exact phone'],contacts:[{kind:'phone',hint:'+91 ••••••0101',value:'+919999990101'}]},
  ];
  async function request(path,init={}){
    const body=init.body?JSON.parse(init.body):null;const headers={...(init.headers||{})};calls.push({path,method:init.method||'GET',body,headers});
    if(path.endsWith('parties:search')){
      if(body.query==='slow')return await new Promise(resolve=>{resolveLate=resolve});
      if(body.query==='denied')return fail(403,'forbidden');
      if(body.query==='offline')throw new TypeError('Failed to fetch');
      if(body.query==='none')return {profiles:[]};
      return {profiles:[
        {partyId:excluded,kind:'person',displayName:'Primary Guest',roles:['guest'],contacts:[{kind:'email',hint:'p•••@example.test',value:'primary@example.test'}]},
        {partyId:uuid(2),kind:'person',displayName:'Asha Rivera with a long but fully wrapping guest name',roles:['guest'],contacts:[{kind:'email',hint:'a•••@example.test',value:'asha@example.test'}]},
      ]};
    }
    if(path.endsWith('/parties')){
      if(body.displayName==='Duplicate Guest'){
        duplicateCreates+=1;
        if(body.acknowledgedDuplicatePartyIds.length===0)return fail(409,'profiles/duplicate_review_required',candidates);
        if(duplicateCreates===2)throw new TypeError('Connection lost after submit');
        return {party:{partyId:uuid(4),kind:'person',displayName:'Duplicate Guest',roles:['guest'],contacts:[{kind:'email',hint:'d•••@example.test',value:'duplicate@example.test'}]}};
      }
      retryCreates+=1;
      if(body.displayName==='Uncertain Guest')throw new TypeError('Connection lost after submit');
      return {party:{partyId:uuid(5),kind:'person',displayName:body.displayName,roles:['guest'],contacts:[]}};
    }
    throw new Error('unexpected request '+path);
  }
  const mount=(id,extra={})=>createPartyProfilePicker({host:document.querySelector(id),request,propertyId:uuid(20),isCurrent:()=>current,
    isExcluded:partyId=>partyId===excluded,onSelect:profile=>selected.push(profile),onClear:()=>{clears+=1},...extra});
  try{
    const parent=mount('#parent-host');
    const parentDisplay=document.querySelector('#parent-host .party-profile-picker-create-display-name');
    const parentEmail=document.querySelector('#parent-host .party-profile-picker-create-email');
    parentDisplay.value='Invalid Contact';parentDisplay.dispatchEvent(new Event('input',{bubbles:true}));
    parentEmail.value='not-an-email';parentEmail.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#save-allocation').click();await sleep(0);
    const callsBeforeInvalidCreate=calls.length;
    document.querySelector('#parent-host .party-profile-picker-create-action').click();await sleep(20);
    const invalidCreateRejected=calls.length===callsBeforeInvalidCreate&&/valid email/i.test(document.querySelector('#parent-host .party-profile-picker-message').textContent)&&parentEmail.getAttribute('aria-invalid')==='true';
    const pickerFieldsDetached=[...document.querySelectorAll('#parent-host input')].every(input=>input.form===null);

    const nfkc=mount('#nfkc-host');
    const nfkcDisplay=document.querySelector('#nfkc-host .party-profile-picker-create-display-name');
    const nfkcEmail=document.querySelector('#nfkc-host .party-profile-picker-create-email');
    const nfkcAddress='ａｓｈａ＠ｅｘａｍｐｌｅ．ｔｅｓｔ';
    nfkcDisplay.value='NFKC Contact';nfkcDisplay.dispatchEvent(new Event('input',{bubbles:true}));
    nfkcEmail.value=nfkcAddress;nfkcEmail.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#nfkc-host .party-profile-picker-create-action').click();await sleep(30);
    const nfkcCall=calls.find(call=>call.path.endsWith('/parties')&&call.body.displayName==='NFKC Contact');
    const nfkcEmailAccepted=Boolean(nfkcCall)&&selected.some(profile=>profile.partyId===uuid(5));
    const nfkcEmailPreserved=nfkcCall?.body.contacts[0]?.value===nfkcAddress;

    const guard=mount('#guard-host');const guardInput=document.querySelector('#guard-host .party-profile-picker-search-input');guardInput.value='Asha';
    document.querySelector('#guard-host .party-profile-picker-search-action').click();await waitFor(()=>document.querySelectorAll('#guard-host .party-profile-picker-result').length===2);
    const selectionsBeforeGuard=selected.length;current=false;document.querySelectorAll('#guard-host .party-profile-picker-result-action')[1].click();await sleep(0);
    const staleSelectionBlocked=selected.length===selectionsBeforeGuard&&!document.querySelector('#guard-host .party-profile-picker-selected').hidden===false;
    current=true;

    const search=mount('#search-host',{initialProfile:{partyId:uuid(9),displayName:'Current accompanying guest',contacts:[]}});
    document.querySelector('#search-host .party-profile-picker-change').click();
    const searchInput=document.querySelector('#search-host .party-profile-picker-search-input');
    const initialFocus=document.activeElement===searchInput;
    const blankCalls=calls.length;const blankPrevented=!searchInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await sleep(0);const blankRejected=calls.length===blankCalls&&/name, email, or phone/i.test(document.querySelector('#search-host .party-profile-picker-message').textContent);
    searchInput.value='Asha';searchInput.dispatchEvent(new Event('input',{bubbles:true}));
    const searchPrevented=!searchInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    const selectionsBeforeSearch=selected.length;
    await waitFor(()=>document.querySelectorAll('#search-host .party-profile-picker-result').length===2);
    const resultButtons=[...document.querySelectorAll('#search-host .party-profile-picker-result-action')];
    const noAutoSelection=selected.length===selectionsBeforeSearch;const excludedDisabled=resultButtons[0].disabled;
    resultButtons[1].click();await sleep(0);
    const selectedText=document.querySelector('#search-host .party-profile-picker-selected').textContent;
    const safeSelectedText=!selectedText.includes(uuid(2))&&!selectedText.includes('asha@example.test')&&selectedText.includes('a•••@example.test');
    document.querySelector('#search-host .party-profile-picker-change').click();
    searchInput.value='none';document.querySelector('#search-host .party-profile-picker-search-action').click();
    await waitFor(()=>/No guest profiles matched/i.test(document.querySelector('#search-host .party-profile-picker-results').textContent));
    searchInput.value='denied';document.querySelector('#search-host .party-profile-picker-search-action').click();
    await waitFor(()=>/permission/i.test(document.querySelector('#search-host .party-profile-picker-message').textContent));
    searchInput.value='offline';document.querySelector('#search-host .party-profile-picker-search-action').click();
    await waitFor(()=>document.querySelector('#search-host .party-profile-picker-search-action').textContent==='Retry search');

    const duplicate=mount('#duplicate-host');
    const display=document.querySelector('#duplicate-host .party-profile-picker-create-display-name');display.value='Duplicate Guest';display.dispatchEvent(new Event('input',{bubbles:true}));
    const legal=document.querySelector('#duplicate-host .party-profile-picker-create-legal-name');legal.value='Duplicate Guest Legal';legal.dispatchEvent(new Event('input',{bubbles:true}));
    const email=document.querySelector('#duplicate-host .party-profile-picker-create-email');email.value='duplicate@example.test';email.dispatchEvent(new Event('input',{bubbles:true}));
    const phone=document.querySelector('#duplicate-host .party-profile-picker-create-phone');phone.value='+919876540445';phone.dispatchEvent(new Event('input',{bubbles:true}));
    const whatsapp=document.querySelector('#duplicate-host .party-profile-picker-create-whatsapp');whatsapp.value='+919876540446';whatsapp.dispatchEvent(new Event('input',{bubbles:true}));
    const createPrevented=!display.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await waitFor(()=>!document.querySelector('#duplicate-host .party-profile-picker-duplicate-review').hidden);
    const firstKey=calls.filter(call=>call.path.endsWith('/parties')&&call.body.displayName==='Duplicate Guest')[0].headers['idempotency-key'];
    const duplicateText=document.querySelector('#duplicate-host .party-profile-picker-duplicate-review').textContent;
    const safeDuplicateText=!duplicateText.includes('never-render@example.test')&&!duplicateText.includes('+919999990101')&&!duplicateText.includes(uuid(3));
    const candidateButtons=[...document.querySelectorAll('#duplicate-host .party-profile-picker-duplicate-candidates .party-profile-picker-result-action')];
    const sortedCandidates=candidateButtons.map(button=>button.dataset.partyId);
    const duplicateExcluded=candidateButtons.find(button=>button.dataset.partyId===excluded).disabled;
    const confirm=document.querySelector('#duplicate-host .party-profile-picker-duplicate-confirm');confirm.click();
    const distinct=document.querySelector('#duplicate-host .party-profile-picker-create-distinct');distinct.click();
    await waitFor(()=>/retry/i.test(document.querySelector('#duplicate-host .party-profile-picker-message').textContent));
    const uncertainCopy=document.querySelector('#duplicate-host .party-profile-picker-message').textContent;
    distinct.click();await waitFor(()=>selected.some(profile=>profile.partyId===uuid(4)));
    const duplicateCalls=calls.filter(call=>call.path.endsWith('/parties')&&call.body.displayName==='Duplicate Guest');
    const sameDuplicateKey=duplicateCalls.length===3&&duplicateCalls.every(call=>call.headers['idempotency-key']===firstKey);
    const exactAcknowledgement=duplicateCalls.slice(1).every(call=>JSON.stringify(call.body.acknowledgedDuplicatePartyIds)===JSON.stringify([uuid(3),excluded].sort()));

    const retry=mount('#retry-host');
    const retryDisplay=document.querySelector('#retry-host .party-profile-picker-create-display-name');retryDisplay.value='Uncertain Guest';retryDisplay.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#retry-host .party-profile-picker-create-action').click();
    await waitFor(()=>/retry/i.test(document.querySelector('#retry-host .party-profile-picker-message').textContent));
    const uncertainKey=calls.filter(call=>call.path.endsWith('/parties')&&call.body.displayName==='Uncertain Guest')[0].headers['idempotency-key'];
    retryDisplay.value='Changed Guest';retryDisplay.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#retry-host .party-profile-picker-create-action').click();
    await waitFor(()=>selected.some(profile=>profile.partyId===uuid(5)));
    const changedKey=calls.filter(call=>call.path.endsWith('/parties')&&call.body.displayName==='Changed Guest')[0].headers['idempotency-key'];

    const late=mount('#late-host');const lateInput=document.querySelector('#late-host .party-profile-picker-search-input');lateInput.value='slow';
    document.querySelector('#late-host .party-profile-picker-search-action').click();await waitFor(()=>typeof resolveLate==='function');late.destroy();
    resolveLate({profiles:[{partyId:uuid(8),displayName:'Late Guest',roles:['guest'],contacts:[]}]});await sleep(30);

    let staleResolve;const staleRequest=async(path,init)=>{const body=JSON.parse(init.body);calls.push({path,method:init.method,body,headers:{...(init.headers||{})}});return await new Promise(resolve=>{staleResolve=resolve})};
    const stale=createPartyProfilePicker({host:document.querySelector('#stale-host'),request:staleRequest,propertyId:uuid(20),isCurrent:()=>current,isExcluded:()=>false,onSelect:profile=>selected.push(profile),onClear:()=>{clears+=1}});
    const staleInput=document.querySelector('#stale-host .party-profile-picker-search-input');staleInput.value='stale';document.querySelector('#stale-host .party-profile-picker-search-action').click();
    await waitFor(()=>typeof staleResolve==='function');current=false;staleResolve({profiles:[{partyId:uuid(7),displayName:'Stale Guest',roles:['guest'],contacts:[]}]});await sleep(30);

    window.__proof={parentSubmits,invalidCreateRejected,pickerFieldsDetached,nfkcEmailAccepted,nfkcEmailPreserved,staleSelectionBlocked,
      helpCopy:document.querySelector('#parent-host .party-profile-picker-help').textContent,
      uncertainCopySafe:/uncertain/i.test(uncertainCopy)&&!/rolled back|nothing (?:was )?saved/i.test(uncertainCopy),
      initialFocus,blankPrevented,blankRejected,searchPrevented,createPrevented,noAutoSelection,excludedDisabled,safeSelectedText,
      clears,safeDuplicateText,sortedCandidates,duplicateExcluded,sameDuplicateKey,exactAcknowledgement,changedKeyDiffers:changedKey!==uncertainKey,
      searchBody:calls.find(call=>call.path.endsWith('parties:search')&&call.body.query==='Asha').body,
      createBody:duplicateCalls[0].body,lateHostEmpty:document.querySelector('#late-host').childElementCount===0,
      staleResults:document.querySelector('#stale-host .party-profile-picker-results').childElementCount,
      requestPaths:[...new Set(calls.map(call=>call.path))],hasForm:Boolean(document.querySelector('.party-profile-picker form')),
      hasSelect:Boolean(document.querySelector('.party-profile-picker select')),selectedIds:selected.map(profile=>profile.partyId)};
    stale.destroy();parent.destroy();nfkc.destroy();guard.destroy();search.destroy();duplicate.destroy();retry.destroy();
    document.body.dataset.ready='true';
  }catch(error){document.body.dataset.error=String(error&&error.stack||error);document.body.dataset.ready='true'}
  </script></body></html>`;
}

test("Q445 guest picker module is present before its real-browser contract runs", () => {
  expect(existsSync(modulePath)).toBe(true);
});

test("Q445 real browser isolates search, duplicate create, retry keys and stale response lifecycle", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order 445 picker proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/") return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (pathname === "/assets/operator-party-profile-picker.js") return new Response(Bun.file(modulePath), { headers: { "content-type": "text/javascript; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  } });
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-q445-picker-"));
  try {
    const proof = await withOwnedCdp(resolve(temporary, "profile"), `http://127.0.0.1:${server.port}/`, async send => {
      await send("Runtime.enable");
      for (let attempt = 0; attempt < 400; attempt += 1) {
        const state = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: "document.body?.dataset.ready || ''", returnByValue: true });
        if (state.result?.value === "true") break;
        if (attempt === 399) throw new Error("guest picker browser proof timed out");
        await Bun.sleep(25);
      }
      const error = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: "document.body?.dataset.error || ''", returnByValue: true });
      if (error.result?.value) throw new Error(error.result.value);
      const value = await send<{ result?: { value?: unknown } }>("Runtime.evaluate", { expression: "window.__proof", returnByValue: true });
      return value.result?.value as Record<string, unknown>;
    });
    expect(proof).toMatchObject({
      parentSubmits: 1, invalidCreateRejected: true, pickerFieldsDetached: true, nfkcEmailAccepted: true, nfkcEmailPreserved: true, staleSelectionBlocked: true,
      helpCopy: "Creating a profile saves it to the guest directory. The reservation changes only when you save guests and shares.",
      uncertainCopySafe: true,
      initialFocus: true, blankPrevented: true, blankRejected: true, searchPrevented: true, createPrevented: true,
      noAutoSelection: true, excludedDisabled: true, safeSelectedText: true, clears: 2, safeDuplicateText: true,
      duplicateExcluded: true, sameDuplicateKey: true, exactAcknowledgement: true, changedKeyDiffers: true,
      searchBody: { query: "Asha", limit: 20 }, lateHostEmpty: true, staleResults: 0, hasForm: false, hasSelect: false,
    });
    expect(proof.sortedCandidates).toEqual(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000003"]);
    expect(proof.createBody).toEqual({
      kind: "person", roles: ["guest"], displayName: "Duplicate Guest", legalName: "Duplicate Guest Legal",
      contacts: [
        { kind: "email", value: "duplicate@example.test", isPrimary: true },
        { kind: "phone", value: "+919876540445", isPrimary: true },
        { kind: "whatsapp", value: "+919876540446", isPrimary: true },
      ], acknowledgedDuplicatePartyIds: [],
    });
    expect(proof.selectedIds).toEqual([
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ]);
    expect(proof.requestPaths).toEqual([
      "/api/v1/properties/00000000-0000-4000-8000-000000000020/parties",
      "/api/v1/properties/00000000-0000-4000-8000-000000000020/parties:search",
    ]);
  } finally {
    server.stop(true);
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 30_000);

test("Q445 picker source retains no profile data and owns no membership request", async () => {
  const source = await Bun.file(modulePath).text();
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  expect(source).not.toMatch(/reservation_guest|guest-allocation|guest-membership|\/guests/);
  expect(source).toContain("acknowledgedDuplicatePartyIds");
  expect(source).toContain("isCurrent");
  expect(source).toContain("onClear");
});
