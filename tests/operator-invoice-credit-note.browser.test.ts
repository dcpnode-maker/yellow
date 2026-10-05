import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const repository = resolve(import.meta.dir, "..");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

function page(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/operator.css"></head>
  <body><main id="root" class="invoice-workbench"></main><pre id="proof"></pre><script type="module">
  const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const propertyA=uuid(2),propertyB=uuid(102),originalA=uuid(10),originalB=uuid(11),creditA=uuid(20),creditB=uuid(21);
  const hostileReason='कक्ष 🏨 <img src=x onerror="globalThis.creditNoteInjected=true"> & "quoted"';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(predicate,label,timeout=2500)=>{const end=performance.now()+timeout;while(performance.now()<end){if(predicate())return;await sleep(10)}throw new Error('timed out waiting for '+label)};
  const fail=(status,type)=>{const error=new Error(type);error.status=status;error.problem={type};throw error};
  const invoice=(documentId,propertyNode)=>({kind:'india_native_invoice_v1',documentId,propertyNode,reservationId:uuid(documentId===originalA?4:104),folioId:uuid(documentId===originalA?5:105),seriesId:uuid(7),documentNumber:documentId===originalA?'INV/2044/17':'INV/2044/18',businessDate:'2044-09-06',issuedAt:'2044-09-06T10:00:00.000001Z',recipientRegistrationId:uuid(documentId===originalA?6:106),sourceEvidenceHash:'a'.repeat(64),documentSha256:documentId===originalA?'b'.repeat(64):'c'.repeat(64),previousHash:null,contentJson:'{}'});
  const credit=(original,documentId,reason=hostileReason)=>({documentId,documentKind:'credit_note',originalDocumentId:original.documentId,originalDocNo:original.documentNumber,originalSha256:original.documentSha256,correctionJournalId:uuid(30),seriesId:uuid(31),docNo:documentId===creditA?'CRN/2044/1':'CRN/2044/2',propertyNode:original.propertyNode,reservationId:original.reservationId,folioId:original.folioId,supplierRegistrationId:uuid(8),recipientRegistrationId:original.recipientRegistrationId,financialYearStart:'2044-04-01',currency:'INR',status:'issued',businessDate:'2044-09-07',issuedAt:'2044-09-07T11:12:13.000Z',prevHash:'d'.repeat(64),sha256:documentId===creditA?'e'.repeat(64):'f'.repeat(64),sourceEvidenceHash:'1'.repeat(64),totalMinor:'10500',reason});
  const deliveryFor=(note,variant='pending')=>{const base={submissionId:uuid(40),tenantId:uuid(1),propertyNode:note.propertyNode,documentId:note.documentId,documentSha256:note.sha256,wireSha256:'2'.repeat(64),providerKey:'india-irp',attemptId:uuid(41),attemptNumber:1,transitionSeq:1};let receipt;
    if(variant==='rejected')receipt={...base,kind:'rejected',status:'rejected',disposition:'none',environment:'production',responseSha256:'3'.repeat(64),errorCodes:['IRN-1']};
    else if(variant==='cancelled')receipt={...base,kind:'provider_cancelled',status:'error',disposition:'none',environment:'production',responseSha256:'3'.repeat(64),providerStatus:'CNL'};
    else if(variant==='accepted-sandbox'||variant==='accepted-production')receipt={...base,kind:'accepted_signed_v1',status:'accepted',disposition:'none',environment:variant==='accepted-sandbox'?'sandbox':'production',responseSha256:'3'.repeat(64),irn:'4'.repeat(64),ackNo:'90071992547409991',ackDt:'2044-09-07 12:34:56',signedInvoice:'e30.e30.YQ',signedQRCode:'e30.eyJxciI6MX0.YQ',signedInvoiceSha256:'5'.repeat(64),signedQrSha256:'6'.repeat(64),verification:{profileVersion:'yellow_native_india_1_1_v1',issuer:'YELLOW-TEST-IRP',verificationUnixMs:1800000000000,invoiceKeyId:'invoice-key',invoiceKeySpkiSha256:'7'.repeat(64),invoiceBundleVersion:'bundle-v1',qrKeyId:'qr-key',qrKeySpkiSha256:'8'.repeat(64),qrBundleVersion:'bundle-v1'}};
    else receipt={...base,kind:'pending',status:'pending',disposition:'send'};
    return {delivery:{kind:'receipt',documentId:note.documentId,receipt}}};
  const calls=[];
  function makeRequest(scenario,propertyNode){
    let discoveryReads=0;
    return async(path,options={})=>{const method=options.method||'GET';calls.push({scenario,propertyNode,path,method});
      if(path.endsWith('/search'))return {invoices:{items:[],matchingCount:'0',nextCursor:null}};
      const first=invoice(propertyNode===propertyA?originalA:originalB,propertyNode),second=invoice(propertyNode===propertyA?originalB:originalA,propertyNode);
      if(path.endsWith('/receipt'))return {delivery:{kind:'ambiguous',documentId:path.includes(first.documentId)?first.documentId:second.documentId}};
      if(path.endsWith('/'+first.documentId))return {invoice:first};
      if(path.endsWith('/'+second.documentId))return {invoice:second};
      const note=credit(first,propertyNode===propertyA?creditA:creditB);
      if(path.endsWith('/invoices/'+first.documentId+'/credit-notes')){
        discoveryReads+=1;if(scenario==='refresh-denied'&&discoveryReads>1)fail(403,'auth/scope_missing');
        if(scenario==='late-discovery'||scenario==='late-disposed'){await sleep(220);return note}
        if(scenario==='empty')fail(404,'fiscal/credit_note_not_found');
        if(scenario==='permission')fail(403,'auth/scope_missing');
        if(scenario==='unavailable')fail(503,'service/unavailable');
        if(scenario==='network')throw new TypeError('Failed to fetch');
        if(scenario==='malformed')return {...note,propertyNode:uuid(999)};
        if(scenario==='duplicate')await sleep(80);
        return note;
      }
      if(path.endsWith('/credit-notes/'+note.documentId+'/delivery')){
        if(scenario==='delivery-permission')fail(403,'auth/scope_missing');
        if(scenario==='delivery-empty')fail(404,'fiscal/credit_delivery_not_found');
        if(scenario==='delivery-unavailable')fail(503,'service/unavailable');
        if(scenario==='delivery-malformed')return {delivery:{kind:'not_requested',documentId:uuid(999)}};
        if(scenario==='delivery-hostile-receipt')return {delivery:{kind:'receipt',documentId:note.documentId,receipt:{}}};
        if(scenario==='late-delivery')await sleep(220);
        const variant=scenario.startsWith('status-')?scenario.slice(7):'pending';return deliveryFor(note,variant);
      }
      throw new Error('unexpected request '+method+' '+path);
    };
  }
  const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');
  const root=document.querySelector('#root');let workbench=null;
  const mount=(scenario,propertyNode=propertyA)=>{workbench?.dispose();root.hidden=false;workbench=createInvoiceWorkbench({root,request:makeRequest(scenario,propertyNode),propertyNode,timezone:'Asia/Kolkata',navigate:()=>{}});return workbench};
  const button=()=>root.querySelector('.invoice-workbench__credit-note-intent');
  const summary=()=>root.querySelector('.invoice-workbench__credit-note-summary');
  const message=()=>root.querySelector('.invoice-workbench__credit-note-message');
  const proof={};
  try{
    mount('success');await workbench.show(originalA);
    proof.lazy={heading:root.textContent.includes('Existing credit note'),button:button()?.textContent,type:button()?.type,
      discovery:calls.filter(call=>call.scenario==='success'&&call.path.endsWith('/credit-notes')).length,
      creditDelivery:calls.filter(call=>call.scenario==='success'&&call.path.includes('/credit-notes/')&&call.path.endsWith('/delivery')).length};
    button().click();await until(()=>summary(),'credit note summary');await until(()=>root.textContent.includes('Registration pending'),'credit delivery');
    proof.success={summary:!!summary(),text:summary().textContent,reasonExact:summary().textContent.includes(hostileReason),money:summary().textContent.includes('₹105.00'),originalNumber:summary().textContent.includes('INV/2044/17'),creditNumber:summary().textContent.includes('CRN/2044/1'),pending:root.textContent.includes('Registration pending'),registered:root.textContent.includes('IRP registered'),injected:globalThis.creditNoteInjected===true||!!summary().querySelector('img'),htmlEscaped:summary().innerHTML.includes('&lt;img'),summaryOverflow:Math.max(0,summary().scrollWidth-summary().clientWidth),valueOverflow:[...summary().querySelectorAll('dd')].filter(node=>node.scrollWidth>node.clientWidth+1).length,calls:calls.filter(call=>call.scenario==='success'&&call.path.includes('credit-notes')).map(call=>({path:call.path,method:call.method}))};
    button().click();await until(()=>calls.filter(call=>call.scenario==='success'&&call.path.endsWith('/delivery')).length===2,'credit refresh');
    proof.refresh={summaries:root.querySelectorAll('.invoice-workbench__credit-note-summary').length,deliveries:root.querySelectorAll('.invoice-workbench__credit-note-delivery').length};

    mount('refresh-denied');await workbench.show(originalA);button().click();await until(()=>summary(),'refresh-denied initial summary');await until(()=>root.textContent.includes('Registration pending'),'refresh-denied initial delivery');button().click();await until(()=>message()?.textContent.includes('permission')&&button()?.disabled===false,'refresh denied');proof.refreshDenied={summary:!!summary(),message:message().textContent};

    mount('duplicate');await workbench.show(originalA);const duplicateButton=button();duplicateButton.click();proof.loading={message:message().textContent,disabled:duplicateButton.disabled};duplicateButton.click();
    await until(()=>summary(),'duplicate summary');await until(()=>root.textContent.includes('Registration pending'),'duplicate delivery');
    proof.duplicate={discovery:calls.filter(call=>call.scenario==='duplicate'&&call.path.endsWith('/credit-notes')).length,delivery:calls.filter(call=>call.scenario==='duplicate'&&call.path.endsWith('/delivery')).length,disabledAfter:duplicateButton.disabled};

    proof.failures={};
    for(const scenario of ['empty','permission','unavailable','network','malformed']){mount(scenario);await workbench.show(originalA);button().click();await until(()=>message()?.textContent&&button()?.disabled===false,scenario+' status');proof.failures[scenario]={message:message().textContent,summary:!!summary()}}

    proof.deliveryFailures={};
    for(const scenario of ['delivery-permission','delivery-empty','delivery-unavailable','delivery-malformed','delivery-hostile-receipt']){mount(scenario);await workbench.show(originalA);button().click();await until(()=>summary(),scenario+' summary');await until(()=>message()?.textContent&&button()?.disabled===false,scenario+' status');proof.deliveryFailures[scenario]={message:message().textContent,summary:summary().textContent.includes('CRN/2044/1'),reason:summary().textContent.includes(hostileReason)}}

    proof.registrationStates={};
    for(const [variant,label] of Object.entries({rejected:'Registration rejected — not registered',cancelled:'Registration cancelled by provider — not registered','accepted-sandbox':'SANDBOX — not a production registration','accepted-production':'IRP registered'})){const scenario='status-'+variant;mount(scenario);await workbench.show(originalA);button().click();await until(()=>message()?.textContent===label,scenario+' label');proof.registrationStates[variant]=message().textContent}

    mount('late-discovery');await workbench.show(originalA);button().click();await sleep(10);await workbench.show(originalB);await sleep(260);
    proof.navigationStale={current:root.textContent.includes('INV/2044/18'),oldSummary:root.textContent.includes('CRN/2044/1'),followup:calls.filter(call=>call.scenario==='late-discovery'&&call.path.endsWith('/delivery')).length};

    mount('late-discovery');await workbench.show(originalA);button().click();await sleep(10);workbench.suspend();await sleep(260);
    proof.suspended={hidden:root.hidden,summary:!!summary(),followup:calls.filter(call=>call.scenario==='late-discovery'&&call.propertyNode===propertyA&&call.path.endsWith('/delivery')).length};

    mount('late-disposed');await workbench.show(originalA);button().click();await sleep(10);workbench.dispose();await sleep(260);
    proof.disposed={state:root.dataset.invoiceState,hidden:root.hidden,summary:!!summary(),followup:calls.filter(call=>call.scenario==='late-disposed'&&call.path.endsWith('/delivery')).length};

    mount('late-discovery');await workbench.show(originalA);const detached=root.querySelector('.invoice-workbench__credit-note');button().click();await sleep(10);detached.remove();await sleep(260);
    proof.detached={connected:detached.isConnected,summary:!!detached.querySelector('.invoice-workbench__credit-note-summary'),followup:calls.filter(call=>call.scenario==='late-discovery'&&call.path.endsWith('/delivery')).length};

    mount('late-discovery',propertyA);await workbench.show(originalA);button().click();await sleep(10);mount('property-current',propertyB);await workbench.show(originalB);await sleep(260);
    proof.propertyStale={current:root.textContent.includes('INV/2044/18'),oldSummary:root.textContent.includes('CRN/2044/1'),followup:calls.filter(call=>call.scenario==='late-discovery'&&call.propertyNode===propertyA&&call.path.endsWith('/delivery')).length};

    mount('late-delivery');await workbench.show(originalA);button().click();await until(()=>summary(),'late delivery summary');await workbench.show(originalB);await sleep(260);
    proof.deliveryStale={current:root.textContent.includes('INV/2044/18'),oldRegistration:root.textContent.includes('Registration pending')};

    workbench.dispose();
    proof.boundary={creditCalls:calls.filter(call=>call.path.includes('/credit-notes')),providerCalls:calls.filter(call=>call.path.includes('provider')||call.path.includes('fiscal-submissions')),mutatingCredit:calls.filter(call=>call.path.includes('/credit-notes')&&call.method!=='GET'),location:location.pathname+location.search+location.hash,localStorage:localStorage.length,sessionStorage:sessionStorage.length,reasonInUrl:location.href.includes('कक्ष')||location.href.includes('quoted')};
  }catch(error){proof.driverError=String(error?.stack||error)}
  document.querySelector('#proof').textContent=JSON.stringify(proof);
  </script></body></html>`;
}

test("Order466 existing credit note disclosure is lazy, immutable and stale-safe in Chromium", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order466 browser proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    const assets: Record<string, string> = {
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator-invoice-print.js": "src/http/operator/invoice-print.js",
      "/assets/vendor/qrcodegen-v1.8.0-es6.js": "src/http/operator/vendor/qrcodegen-v1.8.0-es6.js",
      "/assets/operator.css": "src/http/operator/operator.css",
    };
    if (assets[path]) return new Response(Bun.file(resolve(repository, assets[path]!)), { headers: { "content-type": path.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order466-credit-note-"));
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, "profile")}`, "--window-size=1280,900", "--virtual-time-budget=9000", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 25_000 });
    expect(result.exitCode, result.stderr.slice(-1_000)).toBe(0);
    const encoded = result.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!encoded) throw new Error(`Order466 browser proof did not complete: ${result.stderr.slice(-1_000)}`);
    const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    expect(proof.driverError).toBeUndefined();
    expect(proof.lazy).toEqual({ heading: true, button: "View credit note", type: "button", discovery: 0, creditDelivery: 0 });
    expect(proof.success).toMatchObject({ summary: true, reasonExact: true, money: true, originalNumber: true,
      creditNumber: true, pending: true, registered: false, injected: false, htmlEscaped: true,
      summaryOverflow: 0, valueOverflow: 0 });
    expect(proof.success.calls).toEqual([
      { path: `/api/v1/properties/${uuid(2)}/invoices/${uuid(10)}/credit-notes`, method: "GET" },
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/delivery`, method: "GET" },
    ]);
    expect(proof.refresh).toEqual({ summaries: 1, deliveries: 1 });
    expect(proof.refreshDenied).toEqual({ summary: false, message: "You do not have permission to view this credit note." });
    expect(proof.loading).toEqual({ message: "Loading existing credit note…", disabled: true });
    expect(proof.duplicate).toEqual({ discovery: 1, delivery: 1, disabledAfter: false });
    expect(proof.failures.empty).toMatchObject({ message: "No credit note available to view.", summary: false });
    for (const scenario of ["permission", "unavailable", "network", "malformed"]) {
      expect(proof.failures[scenario].summary).toBe(false);
      expect(proof.failures[scenario].message).not.toBe(proof.failures.empty.message);
    }
    expect(proof.failures.permission.message).not.toBe(proof.failures.unavailable.message);
    expect(proof.failures.malformed.message).not.toBe(proof.failures.permission.message);
    expect(proof.failures.malformed.message).not.toBe(proof.failures.unavailable.message);
    for (const scenario of ["delivery-permission", "delivery-empty", "delivery-unavailable", "delivery-malformed", "delivery-hostile-receipt"]) {
      expect(proof.deliveryFailures[scenario]).toMatchObject({ summary: true, reason: true });
      expect(proof.deliveryFailures[scenario].message.toLowerCase()).toContain("registration");
      expect(proof.deliveryFailures[scenario].message.toLowerCase()).toContain(scenario.includes("malformed") || scenario.includes("hostile") ? "invalid" : "unavailable");
    }
    expect(proof.deliveryFailures["delivery-permission"].message).not.toBe(proof.deliveryFailures["delivery-unavailable"].message);
    expect(proof.registrationStates).toEqual({ rejected: "Registration rejected — not registered",
      cancelled: "Registration cancelled by provider — not registered",
      "accepted-sandbox": "SANDBOX — not a production registration", "accepted-production": "IRP registered" });
    expect(proof.navigationStale).toEqual({ current: true, oldSummary: false, followup: 0 });
    expect(proof.suspended).toEqual({ hidden: true, summary: false, followup: 0 });
    expect(proof.disposed).toEqual({ state: "disposed", hidden: true, summary: false, followup: 0 });
    expect(proof.detached).toEqual({ connected: false, summary: false, followup: 0 });
    expect(proof.propertyStale).toEqual({ current: true, oldSummary: false, followup: 0 });
    expect(proof.deliveryStale).toEqual({ current: true, oldRegistration: false });
    expect(proof.boundary.providerCalls).toEqual([]);
    expect(proof.boundary.mutatingCredit).toEqual([]);
    expect(proof.boundary.creditCalls.length).toBeGreaterThan(0);
    expect(proof.boundary).toMatchObject({ location: "/", localStorage: 0, sessionStorage: 0, reasonInUrl: false });
  } finally {
    server.stop(true);
    const owned = resolve(directory);
    if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith("yellow-order466-credit-note-")) throw new Error("Order466 profile containment changed");
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 40_000);
