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
  const hostileReason='Immutable कक्ष 🏨 <img src=x onerror="globalThis.creditInjected=true"> & "quoted"';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // The owned synthetic browser controls this bounded callback queue so headless
  // virtual time cannot race the iframe's two functional RAF gates. This is not
  // a compositor or animation-performance assertion.
  const frameQueue=[];globalThis.requestAnimationFrame=callback=>{frameQueue.push(callback);return frameQueue.length};
  const flushFrames=async(rounds=3)=>{for(let round=0;round<rounds;round+=1){const callbacks=frameQueue.splice(0);for(const callback of callbacks)callback(performance.now());await Promise.resolve()}};
  const until=async(predicate,label,timeout=2600)=>{const end=performance.now()+timeout;while(performance.now()<end){if(predicate())return;await sleep(8)}throw new Error('timed out waiting for '+label)};
  const fail=(status,type)=>{const error=new Error(type);error.status=status;error.problem={type};throw error};
  const source=(kind,number,date,extra={})=>JSON.stringify({Version:'1.1',TranDtls:{TaxSch:'GST',SupTyp:'B2B'},DocDtls:{Typ:kind,No:number,Dt:date},SellerDtls:{Gstin:'29AAPFU0939F1ZR',LglNm:'Yellow Hotel',Addr1:'1 Main Road',Loc:'Bengaluru',Pin:560001,Stcd:'29'},BuyerDtls:{Gstin:'27AAPFU0939F1ZV',LglNm:'River Guest',Addr1:'1 Buyer Road',Loc:'Mumbai',Pin:400001,Stcd:'27',Pos:'27'},ItemList:[{SlNo:'1',IsServc:'Y',HsnCd:'996311',Qty:'1.000',Unit:'OTH',UnitPrice:'100.00',TotAmt:'100.00',AssAmt:'100.00',GstRt:'5.00',IgstAmt:'5.00',TotItemVal:'105.00'}],ValDtls:{AssVal:'100.00',IgstVal:'5.00',TotInvVal:'105.00'},...extra});
  const original=(documentId,propertyNode)=>({kind:'india_native_invoice_v1',documentId,propertyNode,reservationId:uuid(documentId===originalA?4:104),folioId:uuid(documentId===originalA?5:105),seriesId:uuid(7),documentNumber:documentId===originalA?'INV/2044/17':'INV/2044/18',businessDate:'2044-09-06',issuedAt:'2044-09-06T10:00:00.000001Z',recipientRegistrationId:uuid(documentId===originalA?6:106),sourceEvidenceHash:'a'.repeat(64),documentSha256:documentId===originalA?'b'.repeat(64):'c'.repeat(64),previousHash:null,contentJson:source('INV',documentId===originalA?'INV/2044/17':'INV/2044/18','06/09/2044')});
  const discovery=(originalValue,documentId)=>({documentId,documentKind:'credit_note',originalDocumentId:originalValue.documentId,originalDocNo:originalValue.documentNumber,originalSha256:originalValue.documentSha256,correctionJournalId:uuid(30),seriesId:uuid(31),docNo:documentId===creditA?'CRN/2044/1':'CRN/2044/2',propertyNode:originalValue.propertyNode,reservationId:originalValue.reservationId,folioId:originalValue.folioId,supplierRegistrationId:uuid(8),recipientRegistrationId:originalValue.recipientRegistrationId,financialYearStart:'2044-04-01',currency:'INR',status:'issued',businessDate:'2044-09-07',issuedAt:'2044-09-07T11:12:13.000Z',prevHash:'d'.repeat(64),sha256:documentId===creditA?'e'.repeat(64):'f'.repeat(64),sourceEvidenceHash:'1'.repeat(64),totalMinor:'10500',reason:hostileReason});
  const documentFor=note=>({kind:'india_native_credit_note_v1',receipt:note,contentJson:source('CRN',note.docNo,'07/09/2044',{RefDtls:{PrecDocDtls:[{InvNo:note.originalDocNo,InvDt:'06/09/2044'}]},YellowCredit:{originalDocumentId:note.originalDocumentId,originalSha256:note.originalSha256,reason:note.reason,correctionJournalId:note.correctionJournalId,sourceEvidenceHash:note.sourceEvidenceHash}})});
  const calls=[];
  function requestFor(scenario,propertyNode){let retryDocumentReads=0;return async(path,options={})=>{const method=options.method||'GET';calls.push({scenario,path,method});
    const first=original(propertyNode===propertyA?originalA:originalB,propertyNode),second=original(propertyNode===propertyA?originalB:originalA,propertyNode),note=discovery(first,propertyNode===propertyA?creditA:creditB);
    if(path.endsWith('/search'))return {invoices:{items:[],matchingCount:'0',nextCursor:null}};
    if(path.endsWith('/receipt'))return {delivery:{kind:'not_requested',documentId:path.includes(first.documentId)?first.documentId:second.documentId}};
    if(path.endsWith('/'+first.documentId))return {invoice:first}; if(path.endsWith('/'+second.documentId))return {invoice:second};
    if(path.endsWith('/invoices/'+first.documentId+'/credit-notes'))return note;
    if(path.endsWith('/credit-notes/'+note.documentId+'/document')){if(scenario==='denied')fail(403,'auth/scope_missing');if(scenario==='retry'&&++retryDocumentReads===1)fail(403,'auth/scope_missing');if(scenario==='missing')fail(404,'fiscal/credit_note_not_found');if(scenario==='malformed-source')return {...documentFor(note),contentJson:'{}'};if(scenario.startsWith('slow')||scenario==='refresh-pending')await sleep(220);return documentFor(note)};
    if(path.endsWith('/credit-notes/'+note.documentId+'/delivery')){if(scenario==='denied-delivery')fail(403,'auth/scope_missing');if(scenario==='slow-delivery')await sleep(220);return {delivery:{kind:'not_requested',documentId:note.documentId}}}
    throw new Error('unexpected request '+method+' '+path);
  }}
  const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');const root=document.querySelector('#root');let workbench,prints=0,printHooks=0,lastFrame=null;const compact=matchMedia('(max-width:680px)').matches;
  const hookFrame=frame=>{const sentinel=()=>{prints+=1};const hook=()=>{try{Object.defineProperty(frame.contentWindow,'print',{configurable:true,writable:true,value:sentinel});if(frame.contentWindow.print===sentinel&&!frame.dataset.order468PrintHook){frame.dataset.order468PrintHook='true';printHooks+=1}}catch{try{frame.contentWindow.print=sentinel;if(frame.contentWindow.print===sentinel&&!frame.dataset.order468PrintHook){frame.dataset.order468PrintHook='true';printHooks+=1}}catch{}}};hook();requestAnimationFrame(hook)};
  const printObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches?.('.invoice-workbench__print-frame'))hookFrame(node)});printObserver.observe(root,{childList:true,subtree:true});
  const mount=(scenario,propertyNode=propertyA)=>{workbench?.dispose();root.hidden=false;workbench=createInvoiceWorkbench({root,request:requestFor(scenario,propertyNode),propertyNode,timezone:'Asia/Kolkata',navigate:id=>workbench.show(id)});return workbench};
  const intent=()=>root.querySelector('.invoice-workbench__credit-note-intent');const preview=()=>root.querySelector('.invoice-workbench__credit-note-preview');const print=()=>root.querySelector('.invoice-workbench__credit-note-print');const message=()=>root.querySelector('.invoice-workbench__credit-note-message');const printStatus=()=>root.querySelector('.invoice-workbench__credit-note-print-status');const surface=()=>root.querySelector('.invoice-workbench__credit-note-print-preview');
  const creditCalls=scenario=>calls.filter(call=>call.scenario===scenario&&call.path.includes('/credit-notes/'));
  const proof={};
  try{proofRun:{
    mount('success');await workbench.show(originalA);proof.lazy={intent:intent()?.textContent,preview:!!preview(),print:!!print(),document:creditCalls('success').filter(call=>call.path.endsWith('/document')).length,delivery:creditCalls('success').filter(call=>call.path.endsWith('/delivery')).length};
    intent().click();await until(()=>preview()&&print(),'credit controls');proof.discovered={preview:preview().textContent,print:print().textContent,document:creditCalls('success').filter(call=>call.path.endsWith('/document')).length,delivery:creditCalls('success').filter(call=>call.path.endsWith('/delivery')).length};
    preview().click();await until(()=>compact?surface()?.querySelector('.invoice-workbench__print-summary'):surface()?.querySelector('.invoice-print'),'credit preview');const markup=surface().innerHTML;proof.preview={title:surface().textContent.includes('Credit note'),number:surface().textContent.includes('CRN/2044/1'),reference:surface().textContent.includes('INV/2044/17')&&surface().textContent.includes('Original invoice date'),reason:surface().textContent.includes(hostileReason),amount:surface().textContent.includes('Credit total (INR)')&&surface().textContent.includes('105.00'),escaped:markup.includes('&lt;img')&&!surface().querySelector('img')&&globalThis.creditInjected!==true};proof.mobile={compact,summary:!!surface().querySelector('.invoice-workbench__print-summary'),wording:surface().textContent.includes('credit note')&&surface().textContent.includes('Print credit note')};if(compact){workbench.dispose();break proofRun;}
    print().click();await until(()=>root.querySelector('.invoice-workbench__print-frame'),'credit print frame');const firstFrame=root.querySelector('.invoice-workbench__print-frame');if(!compact)await flushFrames();proof.refresh={document:creditCalls('success').filter(call=>call.path.endsWith('/document')).length,delivery:creditCalls('success').filter(call=>call.path.endsWith('/delivery')).length,frame:!!firstFrame,hooked:firstFrame.dataset.order468PrintHook==='true',prints,printHooks};
    proof.boundary={credit:creditCalls('success').map(call=>({path:call.path,method:call.method})),mutations:calls.filter(call=>call.path.includes('/credit-notes')&&call.method!=='GET').length,providers:calls.filter(call=>call.path.includes('provider')||call.path.includes('fiscal-submissions')).length,location:location.href,localStorage:localStorage.length,sessionStorage:sessionStorage.length};

    mount('denied');await workbench.show(originalA);intent().click();await until(()=>preview(),'denied controls');const deniedRegistration=message().textContent;preview().click();await until(()=>preview()?.disabled===false,'denied print release');proof.denied={summary:!!root.querySelector('.invoice-workbench__credit-note-summary'),preview:!!surface()?.querySelector('.invoice-print'),registration:message().textContent,status:printStatus()?.textContent,legacy:message().textContent===deniedRegistration};
    mount('retry');await workbench.show(originalA);intent().click();await until(()=>preview(),'retry controls');const retryRegistration=message().textContent;preview().click();await until(()=>preview()?.disabled===false&&printStatus()?.textContent.includes('permission'),'retry denied');preview().click();await until(()=>compact?surface()?.querySelector('.invoice-workbench__print-summary'):surface()?.querySelector('.invoice-print'),'retry success');proof.retry={registration:message().textContent===retryRegistration,status:printStatus()?.textContent,preview:!!(compact?surface()?.querySelector('.invoice-workbench__print-summary'):surface()?.querySelector('.invoice-print'))};
    proof.failures={};for(const scenario of ['denied-delivery','malformed-source','missing']){mount(scenario);await workbench.show(originalA);intent().click();await until(()=>preview(),scenario+' controls');preview().click();await until(()=>preview()?.disabled===false,scenario+' release');proof.failures[scenario]={preview:!!surface()?.querySelector('.invoice-print'),status:printStatus()?.textContent};}

    const printFollowups=()=>creditCalls('slow-document').filter(call=>call.path.endsWith('/delivery')).length-creditCalls('slow-document').filter(call=>call.path.endsWith('/document')).length;
    mount('slow-document');await workbench.show(originalA);intent().click();await until(()=>preview(),'slow controls');preview().click();await sleep(12);await workbench.show(originalB);await sleep(260);proof.navigation={current:root.textContent.includes('INV/2044/18'),oldPreview:!!surface()?.querySelector('.invoice-print'),followup:printFollowups()};
    mount('slow-document');await workbench.show(originalA);intent().click();await until(()=>preview(),'suspend controls');preview().click();await sleep(12);workbench.suspend();await sleep(260);proof.hidden={hidden:root.hidden,preview:!!surface()?.querySelector('.invoice-print'),followup:printFollowups()};
    mount('slow-document');await workbench.show(originalA);intent().click();await until(()=>preview(),'dispose controls');preview().click();await sleep(12);workbench.dispose();await sleep(260);proof.disposed={state:root.dataset.invoiceState,hidden:root.hidden,preview:!!surface()?.querySelector('.invoice-print'),followup:printFollowups()};
    mount('slow-document');await workbench.show(originalA);intent().click();await until(()=>preview(),'property controls');preview().click();await sleep(12);mount('property-current',propertyB);await workbench.show(originalB);await sleep(260);proof.property={current:root.textContent.includes('INV/2044/18'),oldPreview:!!surface()?.querySelector('.invoice-print'),followup:printFollowups()};
    mount('refresh-pending');await workbench.show(originalA);intent().click();await until(()=>preview(),'refresh controls');const oldActions=root.querySelector('.invoice-workbench__credit-note-actions');preview().click();await sleep(12);intent().click();await until(()=>!oldActions.isConnected&&root.querySelectorAll('.invoice-workbench__credit-note-actions').length===1,'refreshed controls');await sleep(260);const pendingCalls=calls.filter(call=>call.scenario==='refresh-pending');proof.refreshPending={actions:root.querySelectorAll('.invoice-workbench__credit-note-actions').length,surfaces:root.querySelectorAll('.invoice-workbench__credit-note-print-preview').length,oldActions:oldActions.isConnected,oldPreview:!!surface()?.querySelector('.invoice-print'),document:pendingCalls.filter(call=>call.path.endsWith('/document')).length,discovery:pendingCalls.filter(call=>call.path.endsWith('/credit-notes')).length,delivery:pendingCalls.filter(call=>call.path.endsWith('/delivery')).length,frame:!!root.querySelector('.invoice-workbench__print-frame')};
    mount('slow-delivery');await workbench.show(originalA);intent().click();await until(()=>preview(),'slow delivery controls');preview().click();await until(()=>creditCalls('slow-delivery').filter(call=>call.path.endsWith('/delivery')).length===2,'stale delivery started');await workbench.show(originalB);await sleep(260);proof.deliveryStale={current:root.textContent.includes('INV/2044/18'),oldPreview:!!surface()?.querySelector('.invoice-print'),frame:!!root.querySelector('.invoice-workbench__print-frame'),documents:creditCalls('slow-delivery').filter(call=>call.path.endsWith('/document')).length,deliveries:creditCalls('slow-delivery').filter(call=>call.path.endsWith('/delivery')).length};

    printObserver.disconnect();const staleObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches?.('.invoice-workbench__print-frame')){lastFrame=node;hookFrame(node);queueMicrotask(()=>{void workbench.show(originalB)})}});staleObserver.observe(root,{childList:true,subtree:true});
    mount('success');await workbench.show(originalA);intent().click();await until(()=>print(),'iframe controls');const beforeIframePrint=prints;print().click();await until(()=>root.textContent.includes('INV/2044/18'),'iframe navigation');await flushFrames();proof.iframe={hooked:lastFrame?.dataset.order468PrintHook==='true',prints:prints-beforeIframePrint,connected:!!lastFrame?.isConnected,current:root.textContent.includes('INV/2044/18')};staleObserver.disconnect();
    workbench.dispose();}
  }catch(error){proof.driverError=String(error?.stack||error)}
  document.querySelector('#proof').textContent=JSON.stringify(proof);
  </script></body></html>`;
}

test("Order468 credit-note printing is deliberate, fresh, escaped and lifecycle-safe in Chromium", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order468 browser proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    const assets: Record<string, string> = {
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator-invoice-print.js": "src/http/operator/invoice-print.js",
      "/assets/vendor/qrcodegen-v1.8.0-es6.js": "src/http/operator/vendor/qrcodegen-v1.8.0-es6.js",
      "/assets/operator.css": "src/http/operator/operator.css",
    };
    const asset = assets[path];
    return asset ? new Response(Bun.file(resolve(repository, asset)), { headers: { "content-type": asset.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" } }) : new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order468-credit-note-"));
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, "profile")}`, "--window-size=1280,900", "--virtual-time-budget=10500", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 28_000 });
    expect(result.exitCode, result.stderr.slice(-1_000)).toBe(0);
    const encoded = result.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!encoded) throw new Error(`Order468 browser proof did not complete: ${result.stderr.slice(-1_000)} ${result.stdout.slice(-1_000)}`);
    const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    expect(proof.driverError).toBeUndefined();
    expect(proof.lazy).toEqual({ intent: "View credit note", preview: false, print: false, document: 0, delivery: 0 });
    expect(proof.discovered).toEqual({ preview: "Preview credit note", print: "Print credit note", document: 0, delivery: 1 });
    expect(proof.preview).toEqual({ title: true, number: true, reference: true, reason: true, amount: true, escaped: true });
    expect(proof.refresh).toEqual({ document: 2, delivery: 3, frame: true, hooked: true, prints: 1, printHooks: 1 });
    expect(proof.boundary.credit).toEqual([
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/delivery`, method: "GET" },
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/document`, method: "GET" },
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/delivery`, method: "GET" },
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/document`, method: "GET" },
      { path: `/api/v1/properties/${uuid(2)}/credit-notes/${uuid(20)}/delivery`, method: "GET" },
    ]);
    expect(proof.boundary).toMatchObject({ mutations: 0, providers: 0, localStorage: 0, sessionStorage: 0 });
    expect(proof.boundary.location).not.toContain("Immutable");
    expect(proof.denied).toMatchObject({ summary: true, preview: false, legacy: true });
    expect(proof.denied.status.toLowerCase()).toContain("permission");
    expect(proof.retry).toEqual({ registration: true, status: "", preview: true });
    for (const scenario of ["denied-delivery", "malformed-source", "missing"]) expect(proof.failures[scenario].preview).toBe(false);
    expect(proof.failures["denied-delivery"].status.toLowerCase()).toContain("permission");
    expect(proof.failures["malformed-source"].status.toLowerCase()).toContain("invalid");
    expect(proof.failures.missing.status.toLowerCase()).toContain("no longer available");
    expect(proof.navigation).toEqual({ current: true, oldPreview: false, followup: 0 });
    expect(proof.hidden).toEqual({ hidden: true, preview: false, followup: 0 });
    expect(proof.disposed).toEqual({ state: "disposed", hidden: true, preview: false, followup: 0 });
    expect(proof.property).toEqual({ current: true, oldPreview: false, followup: 0 });
    expect(proof.refreshPending).toEqual({ actions: 1, surfaces: 1, oldActions: false, oldPreview: false,
      document: 1, discovery: 2, delivery: 2, frame: false });
    expect(proof.deliveryStale).toEqual({ current: true, oldPreview: false, frame: false, documents: 1, deliveries: 2 });
    expect(proof.iframe).toEqual({ hooked: true, prints: 0, connected: false, current: true });
    const mobile = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, "profile-mobile")}`, "--window-size=390,900", "--virtual-time-budget=10500", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 28_000 });
    expect(mobile.exitCode, mobile.stderr.slice(-1_000)).toBe(0);
    const mobileEncoded = mobile.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!mobileEncoded) throw new Error(`Order468 mobile browser proof did not complete: ${mobile.stderr.slice(-1_000)}`);
    const mobileProof = JSON.parse(mobileEncoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    expect(mobileProof.driverError).toBeUndefined();
    expect(mobileProof.mobile).toEqual({ compact: true, summary: true, wording: true });
  } finally {
    server.stop(true);
    const owned = resolve(directory);
    if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith("yellow-order468-credit-note-")) throw new Error("Order468 profile containment changed");
    await rm(owned, { recursive: true, force: true });
  }
});
