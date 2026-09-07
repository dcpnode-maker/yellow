import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

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

const fixture = `
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const content={Version:'1.1',TranDtls:{TaxSch:'GST',SupTyp:'B2B'},DocDtls:{Typ:'INV',No:'INV/2044/17',Dt:'06/09/2044'},SellerDtls:{Gstin:'29AAPFU0939F1ZR',LglNm:'Yellow Hotel',Addr1:'1 Main Road',Loc:'Bengaluru',Pin:560001,Stcd:'29'},BuyerDtls:{Gstin:'27AAPFU0939F1ZV',LglNm:'River Guest',Addr1:'1 Buyer Road',Loc:'Mumbai',Pin:400001,Stcd:'27',Pos:'27'},ItemList:[{SlNo:'1',IsServc:'Y',HsnCd:'996311',Qty:'1.000',Unit:'OTH',UnitPrice:'100.00',TotAmt:'100.00',AssAmt:'100.00',GstRt:'5.00',IgstAmt:'5.00',TotItemVal:'105.00'}],ValDtls:{AssVal:'100.00',IgstVal:'5.00',TotInvVal:'105.00'}};
const contentJson=JSON.stringify(content);
const documentValue={kind:'india_native_invoice_v1',documentId:uuid(10),propertyNode:uuid(2),reservationId:uuid(4),folioId:uuid(5),seriesId:uuid(7),documentNumber:'INV/2044/17',businessDate:'2044-09-06',issuedAt:'2044-09-06T10:00:00.000001Z',recipientRegistrationId:uuid(6),sourceEvidenceHash:'a'.repeat(64),documentSha256:'b'.repeat(64),previousHash:null,contentJson};
const summary=(n,name,no='INV/2044/17')=>({documentId:uuid(n),documentNumber:no,businessDate:'2044-09-06',issuedAt:'2044-09-06T10:00:00.000001Z',reservationId:uuid(n+20),folioId:uuid(n+30),recipientRegistrationId:uuid(n+40),buyerName:name,buyerGstin:'27AAPFU0939F1ZV',currency:'INR',taxableMinor:'10000',taxMinor:'500',totalMinor:'10500'});
const recipients=[
  {recipientRegistrationId:uuid(6),legalName:'River Guest Private Limited',gstin:'27AAPFU0939F1ZV',stateCode:'27'},
  {recipientRegistrationId:uuid(16),legalName:'River Guest Karnataka Branch',gstin:'29AAPFU0939F1ZR',stateCode:'29'},
];
const readyConfirmation={buyer:{...recipients[0],addressLine:'1 Buyer Road',locality:'Mumbai',postalCode:'400001'},seller:{legalName:'Yellow Hotel',gstin:'29AAPFU0939F1ZR',stateCode:'29',addressLine:'1 Main Road',locality:'Bengaluru',postalCode:'560001'},placeOfSupplyStateCode:'27',issueDate:'2044-09-06',timeOfSupplyDate:'2044-09-05',serviceProvisionDate:'2044-09-04',paymentReceiptDate:'2044-09-05',seriesPrefix:'INV/',financialYearStart:'2044-04-01',currency:'INR',taxableMinor:'10000',taxMinor:'500',totalMinor:'10500',configuration:{extensionId:uuid(60),version:4,contentHash:'c'.repeat(64)},roomNights:[{ordinal:0,businessDate:'2044-09-04',taxableMinor:'10000',taxMinor:'500',aggregateRateBasisPoints:500,components:[{identity:'igst',rateBasisPoints:500,taxMinor:'500'}]}]};
const issueReceipt={documentId:uuid(70),documentKind:'invoice',seriesId:uuid(7),docNo:'INV/2044/18',propertyNode:uuid(2),reservationId:uuid(4),folioId:uuid(5),supplierRegistrationId:uuid(8),recipientRegistrationId:uuid(6),financialYearStart:'2044-04-01',currency:'INR',status:'issued',businessDate:'2044-09-06',issuedAt:'2044-09-06T10:00:00.000001Z',prevHash:'d'.repeat(64),sha256:'e'.repeat(64),sourceEvidenceHash:'f'.repeat(64),preDocumentEvidenceHash:'1'.repeat(64),readinessEvidenceHash:'2'.repeat(64),replayed:false};
`;

function page(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body><button id="folio-launch">Review invoice</button><main id="root" class="invoice-workbench"></main><pre id="proof"></pre><script type="module">
  ${fixture}
  const calls=[];let mode='ready',issueAttempts=0,issueFailure='ambiguous';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const fail=(status,type)=>{const error=new Error(type);error.status=status;error.problem={type};throw error};
  async function request(path,options={}){calls.push({path,method:options.method||'GET',headers:{...(options.headers||{})},body:options.body?JSON.parse(options.body):null});
    if(path.endsWith('/search')){const body=JSON.parse(options.body);if(mode==='permission')fail(403,'forbidden');if(mode==='unsupported')fail(422,'unsupported_jurisdiction');if(mode==='offline')throw new TypeError('Failed to fetch');if(body.query==='slow'){await sleep(250);return {invoices:{items:[summary(90,'Stale guest','INV/STALE')],matchingCount:'1',nextCursor:null}}}if(body.query==='fresh')return {invoices:{items:[summary(91,'Current guest','INV/FRESH')],matchingCount:'1',nextCursor:null}};if(body.after)return {invoices:{items:[summary(12,'Second guest','INV/2044/19')],matchingCount:'2',nextCursor:null}};return {invoices:{items:[summary(10,'River Guest')],matchingCount:'2',nextCursor:'cursor_1'}}}
    if(path.endsWith('/invoice-readiness')){const body=JSON.parse(options.body);if(path.includes(uuid(98)))await sleep(220);if(path.includes(uuid(96)))return {readiness:{kind:'issued',documentId:uuid(10)}};if(path.includes(uuid(97)))return {readiness:{kind:'blocked',blocker:'working_day_calendar_required'}};if(path.includes(uuid(95)))fail(403,'forbidden');if(path.includes(uuid(94)))fail(422,'unsupported_jurisdiction');if(body.recipientRegistrationId===null)return {readiness:{kind:'selection_required',recipients}};return {readiness:{kind:'ready',selectorHash:'3'.repeat(64),evidenceHash:'4'.repeat(64),confirmation:readyConfirmation}}}
    if(path.endsWith('/invoice-issue')){issueAttempts+=1;await sleep(60);if(issueFailure==='ambiguous'&&issueAttempts===1)throw new TypeError('connection lost after submit');if(issueFailure==='stale')fail(409,'stale_invoice_evidence');return {invoice:issueReceipt}}
    if(path.endsWith('/receipt'))fail(403,'forbidden');
    if(path.includes('/invoices/')){if(path.endsWith(uuid(99))){await sleep(200);return {invoice:{...documentValue,documentId:uuid(99)}}}if(path.endsWith(uuid(70)))return {invoice:{...documentValue,documentId:uuid(70),documentNumber:'INV/2044/18'}};return {invoice:documentValue}}
    throw new Error('unexpected request '+path);
  }
  const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');
  const root=document.querySelector('#root'),folioLaunch=document.querySelector('#folio-launch');let workbench;const navigation=[],folioReturns=[];
  const navigate=id=>{navigation.push(id);return workbench.show(id)};
  const returnToFolio=id=>{folioReturns.push(id);folioLaunch.focus()};
  workbench=createInvoiceWorkbench({root,request,propertyNode:uuid(2),timezone:'Asia/Kolkata',navigate,returnToFolio});
  await workbench.show(null);
  const initial={view:root.dataset.invoiceView,state:root.dataset.invoiceState,items:root.querySelectorAll('.invoice-workbench__queue-item').length,count:root.textContent.includes('2 matching invoices'),piiLocation:location.href.includes('River')};
  root.querySelector('.invoice-workbench__load-more').click();await sleep(20);
  const paged={items:root.querySelectorAll('.invoice-workbench__queue-item').length,ids:[...root.querySelectorAll('.invoice-workbench__queue-item')].map(x=>x.dataset.documentId)};
  await workbench.show(uuid(10));const detail={view:root.dataset.invoiceView,number:root.querySelector('.invoice-workbench__detail')?.textContent.includes('INV/2044/17'),permission:root.querySelector('.invoice-workbench__detail')?.textContent.includes('Registration details unavailable for this role'),slot:!!root.querySelector('[data-invoice-issue-slot]'),queueVisible:getComputedStyle(root.querySelector('.invoice-workbench__queue')).display!=='none'};
  root.querySelector('.invoice-workbench__back').click();await sleep(20);const back={navigation:navigation.at(-1),focused:document.activeElement?.dataset.documentId===uuid(10)};root.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}));const slash=document.activeElement===root.querySelector('.invoice-workbench__query');
  const query=root.querySelector('.invoice-workbench__query'),form=root.querySelector('.invoice-workbench__search');query.value='slow';form.requestSubmit();await sleep(10);query.value='fresh';form.requestSubmit();await sleep(300);const stale={text:root.querySelector('.invoice-workbench__queue-list').textContent,items:root.querySelectorAll('.invoice-workbench__queue-item').length};
  for(const next of ['permission','unsupported','offline']){mode=next;form.requestSubmit();await sleep(20);if(root.dataset.invoiceState!==next)throw new Error('missing '+next+' state')};mode='ready';query.value='';form.requestSubmit();await sleep(20);await workbench.show(uuid(10));let escape='desktop';if(matchMedia('(max-width:900px)').matches){root.querySelector('.invoice-workbench__detail-heading').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await sleep(20);escape=root.dataset.invoiceView;await workbench.show(uuid(10))}
  root.querySelector('.invoice-workbench__preview-action').click();await sleep(80);const printable=root.querySelector('.invoice-print');const preview={full:!!printable,phoneSummary:!!root.querySelector('.invoice-workbench__print-summary'),styled:!printable||getComputedStyle(printable).maxWidth!=='none',unavailable:root.querySelector('.invoice-workbench__detail')?.textContent.includes('Registration not checked'),state:root.dataset.invoiceState,status:root.querySelector('.invoice-workbench__status')?.textContent};
  root.querySelector('.invoice-workbench__print').click();await sleep(120);const print={frame:!!root.querySelector('.invoice-workbench__print-frame'),state:root.dataset.invoiceState,documentReads:calls.filter(x=>x.path.endsWith('/'+uuid(10))).length,receiptReads:calls.filter(x=>x.path.endsWith('/receipt')).length,providerOptions:calls.filter(x=>x.path.endsWith('/fiscal-provider-options')).length,providerPosts:calls.filter(x=>x.path.endsWith('/fiscal-submissions')).length};
  await workbench.showIssue({reservationId:uuid(4),folioId:uuid(5)});
  const buyerSelect=root.querySelector('.invoice-workbench__recipient-select'),reviewButton=root.querySelector('.invoice-workbench__readiness-submit');
  const explicitBuyer={view:root.dataset.invoiceView,value:buyerSelect?.value,options:buyerSelect?.options.length,reviewDisabled:reviewButton?.disabled,issuePresent:!!root.querySelector('.invoice-workbench__issue-submit')};
  buyerSelect.value=uuid(6);buyerSelect.dispatchEvent(new Event('change',{bubbles:true}));reviewButton.click();await sleep(30);
  const confirmation={buyer:root.querySelector('.invoice-workbench__issue')?.textContent.includes('River Guest Private Limited'),seller:root.querySelector('.invoice-workbench__issue')?.textContent.includes('Yellow Hotel'),amount:root.querySelector('.invoice-workbench__issue')?.textContent.includes('₹105.00'),component:root.querySelector('.invoice-workbench__issue')?.textContent.includes('IGST · 5.00% · ₹5.00'),checked:root.querySelector('.invoice-workbench__confirm-check')?.checked,issueDisabled:root.querySelector('.invoice-workbench__issue-submit')?.disabled};
  root.querySelector('.invoice-workbench__confirm-check').click();const firstIssue=root.querySelector('.invoice-workbench__issue-submit');firstIssue.click();firstIssue.click();await sleep(90);
  const ambiguous={state:root.dataset.invoiceState,retained:root.querySelector('.invoice-workbench__issue')?.textContent.includes('River Guest Private Limited'),posts:calls.filter(x=>x.path.endsWith('/invoice-issue')).length,message:root.querySelector('.invoice-workbench__issue-message')?.textContent};
  root.querySelector('.invoice-workbench__issue-submit').click();await sleep(150);
  const issueCalls=calls.filter(x=>x.path.endsWith('/invoice-issue'));
  const readinessCalls=calls.filter(x=>x.path.endsWith('/invoice-readiness')).slice(0,2);
  const issued={navigation:navigation.at(-1),view:root.dataset.invoiceView,state:root.dataset.invoiceState,message:root.querySelector('.invoice-workbench__issue-message')?.textContent,posts:issueCalls.length,sameKey:issueCalls[0]?.headers['Idempotency-Key']===issueCalls[1]?.headers['Idempotency-Key'],path:issueCalls[0]?.path,body:issueCalls[0]?.body,readiness:readinessCalls.map(x=>({path:x.path,body:x.body})),number:root.querySelector('.invoice-workbench__detail')?.textContent.includes('INV/2044/18')};
  await workbench.showIssue({reservationId:uuid(96),folioId:uuid(5)});const alreadyIssued={navigation:navigation.at(-1),view:root.dataset.invoiceView};
  issueFailure='stale';await workbench.showIssue({reservationId:uuid(4),folioId:uuid(5)});const staleBuyer=root.querySelector('.invoice-workbench__recipient-select');staleBuyer.value=uuid(6);staleBuyer.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector('.invoice-workbench__readiness-submit').click();await sleep(30);root.querySelector('.invoice-workbench__confirm-check').click();root.querySelector('.invoice-workbench__issue-submit').click();await sleep(90);const staleIssue={state:root.dataset.invoiceState,retained:root.querySelector('.invoice-workbench__issue-retained')?.textContent.includes('River Guest Private Limited'),message:root.querySelector('.invoice-workbench__issue-message')?.textContent,retry:root.querySelector('.invoice-workbench__issue-retry')?.textContent};
  await workbench.showIssue({reservationId:uuid(95),folioId:uuid(5)});const issuePermission={state:root.dataset.invoiceState,message:root.querySelector('.invoice-workbench__issue-message')?.textContent};
  await workbench.showIssue({reservationId:uuid(94),folioId:uuid(5)});const issueUnsupported={state:root.dataset.invoiceState,message:root.querySelector('.invoice-workbench__issue-message')?.textContent};
  await workbench.showIssue({reservationId:uuid(4),folioId:uuid(5)});root.querySelector('.invoice-workbench__issue-back').click();await sleep(20);const folioBack={folioId:folioReturns.at(-1),focused:document.activeElement===folioLaunch};
  const lateIssue=workbench.showIssue({reservationId:uuid(98),folioId:uuid(5)});await sleep(10);await workbench.showIssue({reservationId:uuid(97),folioId:uuid(5)});await lateIssue;
  const blocked={view:root.dataset.invoiceView,state:root.dataset.invoiceState,actionable:root.querySelector('.invoice-workbench__issue')?.textContent.includes('working-day calendar')};
  const callsBeforeInvalid=calls.length;let invalid=false;try{await workbench.showIssue({reservationId:uuid(4),folioId:uuid(5),extra:true})}catch(error){invalid=error instanceof TypeError}
  const invalidBeforeIo={invalid,calls:calls.length-callsBeforeInvalid};
  const classes=[...root.querySelectorAll('[class]')].every(x=>[...x.classList].every(c=>c.startsWith('invoice-workbench__')||c.startsWith('invoice-print')));const pending=workbench.show(uuid(99));await sleep(10);workbench.suspend();await pending;const suspended={hidden:root.hidden,state:root.dataset.invoiceState,late:root.textContent.includes(uuid(99))};workbench.dispose();
  document.querySelector('#proof').textContent=JSON.stringify({viewport:innerWidth,initial,paged,detail,back,slash,escape,stale,preview,print,explicitBuyer,confirmation,ambiguous,issued,alreadyIssued,staleIssue,issuePermission,issueUnsupported,folioBack,blocked,invalidBeforeIo,suspended,classes})
  </script></body></html>`;
}

test("Q208 invoice workbench uses real browser navigation, stale suppression and fresh print reads", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Q208 invoice browser proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(page().replace("</head>", '<link rel="stylesheet" href="/assets/operator.css"></head>'), { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "style-src 'self'" } });
    const files: Record<string, string> = {
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator.css": "src/http/operator/operator.css",
      "/assets/operator-invoice-print.js": "src/http/operator/invoice-print.js",
      "/assets/vendor/qrcodegen-v1.8.0-es6.js": "src/http/operator/vendor/qrcodegen-v1.8.0-es6.js",
    };
    const file = files[path];
    return file ? new Response(Bun.file(resolve(repository, file)), { headers: { "content-type": file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" } }) : new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-q208-invoices-"));
  try {
    for (const width of [390, 1280]) {
      const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, `profile-${width}`)}`, `--window-size=${width},900`, "--virtual-time-budget=2500", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 20_000 });
      expect(result.exitCode).toBe(0);
      const encoded = result.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
      if (!encoded) throw new Error(`browser proof did not complete at ${width}px: ${result.stderr.slice(-500)}`);
      const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      if (width === 390) expect(proof.viewport).toBeLessThanOrEqual(680);
      else expect(proof.viewport).toBeGreaterThan(900);
      expect(proof.initial).toEqual({ view: "queue", state: "ready", items: 1, count: true, piiLocation: false });
      expect(proof.paged).toEqual({ items: 2, ids: [uuid(10), uuid(12)] });
      expect(proof.detail).toEqual({ view: "detail", number: true, permission: true, slot: true, queueVisible: proof.viewport > 900 });
      expect(proof.back).toEqual({ navigation: null, focused: true });
      expect(proof.slash).toBe(true);
      expect(proof.escape).toBe(proof.viewport <= 900 ? "queue" : "desktop");
      expect(proof.stale).toMatchObject({ items: 1 });
      expect(proof.stale.text).toContain("Current guest");
      expect(proof.stale.text).not.toContain("Stale guest");
      expect(proof.preview).toEqual({ full: proof.viewport > 680, phoneSummary: proof.viewport <= 680, styled: true, unavailable: true, state: "ready", status: "Print preview refreshed." });
      expect(proof.print.frame).toBe(true);
      expect(proof.print.documentReads).toBeGreaterThanOrEqual(3);
      expect(proof.print.receiptReads).toBeGreaterThanOrEqual(3);
      expect(proof.print.providerOptions).toBe(0);
      expect(proof.print.providerPosts).toBe(0);
      expect(proof.explicitBuyer).toEqual({ view: "issue", value: "", options: 3, reviewDisabled: true, issuePresent: false });
      expect(proof.confirmation).toEqual({ buyer: true, seller: true, amount: true, component: true, checked: false, issueDisabled: true });
      expect(proof.ambiguous).toMatchObject({ state: "unknown", retained: true, posts: 1 });
      expect(proof.ambiguous.message).toContain("same request identity");
      expect(proof.issued).toEqual({
        navigation: uuid(70), view: "detail", state: "ready", posts: 2, sameKey: true,
        path: `/api/v1/properties/${uuid(2)}/reservations/${uuid(4)}/folios/${uuid(5)}/invoice-issue`,
        body: { recipientRegistrationId: uuid(6), calendarEvidence: null,
          expectedSelectorHash: "3".repeat(64), expectedConfirmationHash: "4".repeat(64) },
        readiness: [
          { path: `/api/v1/properties/${uuid(2)}/reservations/${uuid(4)}/folios/${uuid(5)}/invoice-readiness`,
            body: { recipientRegistrationId: null, calendarEvidence: null } },
          { path: `/api/v1/properties/${uuid(2)}/reservations/${uuid(4)}/folios/${uuid(5)}/invoice-readiness`,
            body: { recipientRegistrationId: uuid(6), calendarEvidence: null } },
        ],
        number: true,
      });
      expect(proof.alreadyIssued).toEqual({ navigation: uuid(10), view: "detail" });
      expect(proof.staleIssue).toMatchObject({ state: "stale", retained: true, retry: "Try readiness again" });
      expect(proof.staleIssue.message).toContain("Refresh and review a new server confirmation");
      expect(proof.issuePermission).toEqual({ state: "permission", message: "You do not have permission to review or issue this invoice." });
      expect(proof.issueUnsupported).toEqual({ state: "unsupported", message: "Native fiscal invoice issuance is not supported for this property." });
      expect(proof.folioBack).toEqual({ folioId: uuid(5), focused: true });
      expect(proof.blocked).toEqual({ view: "issue", state: "blocked", actionable: true });
      expect(proof.invalidBeforeIo).toEqual({ invalid: true, calls: 0 });
      expect(proof.suspended).toEqual({ hidden: true, state: "suspended", late: false });
      expect(proof.classes).toBe(true);
    }
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 45_000);

function providerRegistrationPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body><main id="root" class="invoice-workbench"></main><pre id="proof"></pre><script type="module">
  ${fixture}
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(test,label,timeout=3000)=>{const end=performance.now()+timeout;while(performance.now()<end){if(test())return;await sleep(10)}throw new Error('timed out waiting for '+label)};
  const calls=[];let scenario='request',receiptKind='not_requested',postAttempts=0;
  const provider={providerExtensionId:uuid(61),providerExtensionVersion:7,providerKey:'fictional-clearirp',label:'Fictional ClearIRP',environment:'sandbox'};
  const submission={submissionId:uuid(71),documentId:uuid(10),attemptId:uuid(72),attemptNumber:1,retryCount:0,status:'pending',disposition:'send',transitionSeq:1,provider:{key:provider.providerKey,extensionId:provider.providerExtensionId,extensionVersion:provider.providerExtensionVersion},replayed:false};
  const pendingReceipt={kind:'pending',tenantId:uuid(1),propertyNode:uuid(2),submissionId:uuid(71),documentId:uuid(10),documentSha256:documentValue.documentSha256,providerKey:provider.providerKey,providerExtensionId:provider.providerExtensionId,providerExtensionVersion:provider.providerExtensionVersion};
  const fail=(status,type)=>{const error=new Error(type);error.status=status;throw error};
  async function request(path,options={}){calls.push({scenario,path,method:options.method||'GET',headers:{...(options.headers||{})},body:options.body?JSON.parse(options.body):null});
    if(path.endsWith('/'+uuid(10)))return {invoice:documentValue};
    if(path.endsWith('/receipt'))return receiptKind==='receipt'?{delivery:{kind:'receipt',documentId:uuid(10),receipt:pendingReceipt}}:{delivery:{kind:'not_requested',documentId:uuid(10)}};
    if(path.endsWith('/fiscal-provider-options')){if(scenario==='late'){await sleep(220);return {providers:[provider]}}if(scenario==='empty')return {providers:[]};if(scenario==='permission')fail(403,'forbidden');if(scenario==='unsupported')fail(422,'unsupported_jurisdiction');return {providers:[provider]}}
    if(path.endsWith('/fiscal-submissions')){postAttempts+=1;await sleep(60);if(postAttempts===1)throw new TypeError('connection lost after submit');if(postAttempts===2)return {fiscalSubmission:{...submission,documentId:uuid(11)}};receiptKind='receipt';return {fiscalSubmission:submission}}
    throw new Error('unexpected request '+path);
  }
  const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');const root=document.querySelector('#root');
  try {
  let workbench=createInvoiceWorkbench({root,request,propertyNode:uuid(2),timezone:'Asia/Kolkata',navigate:()=>{}});
  await workbench.show(uuid(10));
  const opened={options:calls.filter(call=>call.path.endsWith('/fiscal-provider-options')).length,posts:calls.filter(call=>call.path.endsWith('/fiscal-submissions')).length,register:root.querySelector('.invoice-workbench__provider-intent')?.textContent};
  root.querySelector('.invoice-workbench__provider-intent').click();await until(()=>root.querySelector('.invoice-workbench__provider-select'),'provider selection');
  const select=root.querySelector('.invoice-workbench__provider-select'),confirm=root.querySelector('.invoice-workbench__provider-confirm'),submit=root.querySelector('.invoice-workbench__provider-submit');
  const explicit={value:select.value,options:select.options.length,confirmDisabled:confirm.disabled,submitDisabled:submit.disabled,text:root.querySelector('[data-invoice-issue-slot]').textContent};
  select.value=provider.providerExtensionId;select.dispatchEvent(new Event('change',{bubbles:true}));
  const selected={confirmDisabled:confirm.disabled,confirmChecked:confirm.checked,submitDisabled:submit.disabled,text:root.querySelector('[data-invoice-issue-slot]').textContent};
  confirm.click();submit.click();submit.click();await until(()=>root.dataset.invoiceState==='unknown','ambiguous provider request');
  const unknown={posts:calls.filter(call=>call.path.endsWith('/fiscal-submissions')).length,selectDisabled:select.disabled,confirmDisabled:confirm.disabled,message:root.querySelector('.invoice-workbench__provider-message')?.textContent,retry:root.querySelector('.invoice-workbench__provider-submit')?.textContent};
  await workbench.show(uuid(10));const reloadedUnknown={state:root.dataset.invoiceState,register:!!root.querySelector('.invoice-workbench__provider-intent'),binding:root.querySelector('.invoice-workbench__provider-binding')?.textContent,retry:root.querySelector('.invoice-workbench__provider-submit')?.textContent};
  root.querySelector('.invoice-workbench__provider-submit').click();await until(()=>calls.filter(call=>call.path.endsWith('/fiscal-submissions')).length===2&&root.dataset.invoiceState==='unknown','mismatched response rejection');
  const mismatched={state:root.dataset.invoiceState,posts:calls.filter(call=>call.path.endsWith('/fiscal-submissions')).length,message:root.querySelector('.invoice-workbench__provider-message')?.textContent};
  root.querySelector('.invoice-workbench__provider-submit').click();await until(()=>root.querySelector('.invoice-workbench__registration')?.textContent.includes('Registration pending'),'receipt refresh');
  const postCalls=calls.filter(call=>call.path.endsWith('/fiscal-submissions'));
  const succeeded={posts:postCalls.length,sameKey:postCalls.every(call=>call.headers['Idempotency-Key']===postCalls[0]?.headers['Idempotency-Key']),body:postCalls[0]?.body,receiptReads:calls.filter(call=>call.path.endsWith('/receipt')).length,status:root.querySelector('.invoice-workbench__registration')?.textContent,register:!!root.querySelector('.invoice-workbench__provider-intent')};
  for(const next of ['empty','permission','unsupported']){workbench.dispose();root.hidden=false;scenario=next;receiptKind='not_requested';workbench=createInvoiceWorkbench({root,request,propertyNode:uuid(2),timezone:'Asia/Kolkata',navigate:()=>{}});await workbench.show(uuid(10));root.querySelector('.invoice-workbench__provider-intent').click();await until(()=>root.dataset.invoiceState===next,'provider '+next);succeeded[next]={state:root.dataset.invoiceState,message:root.querySelector('.invoice-workbench__provider-message')?.textContent,posts:calls.filter(call=>call.scenario===next&&call.path.endsWith('/fiscal-submissions')).length}}
  workbench.dispose();root.hidden=false;scenario='late';receiptKind='not_requested';workbench=createInvoiceWorkbench({root,request,propertyNode:uuid(2),timezone:'Asia/Kolkata',navigate:()=>{}});await workbench.show(uuid(10));root.querySelector('.invoice-workbench__provider-intent').click();await sleep(10);workbench.suspend();await sleep(260);
  const late={state:root.dataset.invoiceState,hidden:root.hidden,select:!!root.querySelector('.invoice-workbench__provider-select'),posts:calls.filter(call=>call.scenario==='late'&&call.path.endsWith('/fiscal-submissions')).length};
  workbench.dispose();document.querySelector('#proof').textContent=JSON.stringify({opened,explicit,selected,unknown,reloadedUnknown,mismatched,succeeded,late});
  }catch(error){document.querySelector('#proof').textContent=JSON.stringify({driverError:String(error?.stack||error)})}
  </script></body></html>`;
}

test("Q208 configured provider registration is explicit, bound and ambiguity-safe", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Q208 provider browser proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(providerRegistrationPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path === "/assets/operator-invoices.js") return new Response(Bun.file(resolve(repository, "src/http/operator/invoices.js")), { headers: { "content-type": "text/javascript; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-q208-provider-registration-"));
  try {
    const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, "profile")}`, "--window-size=1280,900", "--virtual-time-budget=4000", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 20_000 });
    expect(result.exitCode).toBe(0);
    const encoded = result.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
    if (!encoded) throw new Error(`provider browser proof did not complete: ${result.stderr.slice(-500)}`);
    const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    expect(proof.driverError).toBeUndefined();
    expect(proof.opened).toEqual({ options: 0, posts: 0, register: "Register with provider" });
    expect(proof.explicit).toMatchObject({ value: "", options: 2, confirmDisabled: true, submitDisabled: true });
    expect(proof.explicit.text).toContain("Fictional ClearIRP");
    expect(proof.explicit.text).toContain("sandbox");
    expect(proof.selected).toMatchObject({ confirmDisabled: false, confirmChecked: false, submitDisabled: true });
    expect(proof.selected.text).toContain("sandbox environment");
    expect(proof.unknown).toMatchObject({ posts: 1, selectDisabled: true, confirmDisabled: true, retry: "Retry same registration request" });
    expect(proof.unknown.message).toContain("same request identity");
    expect(proof.reloadedUnknown).toEqual({ state: "unknown", register: false,
      binding: "Fictional ClearIRP · fictional-clearirp · sandbox", retry: "Retry same registration request" });
    expect(proof.mismatched).toMatchObject({ state: "unknown", posts: 2 });
    expect(proof.mismatched.message).toContain("same request identity");
    expect(proof.succeeded).toMatchObject({ posts: 3, sameKey: true,
      body: { documentId: uuid(10), providerExtensionId: uuid(61) }, receiptReads: 3,
      status: "Registration pending", register: false });
    expect(proof.succeeded.empty).toEqual({ state: "empty", message: "No configured fiscal providers are available for this property.", posts: 0 });
    expect(proof.succeeded.permission).toEqual({ state: "permission", message: "You do not have permission to request provider registration.", posts: 0 });
    expect(proof.succeeded.unsupported).toEqual({ state: "unsupported", message: "Provider registration is not supported for this property.", posts: 0 });
    expect(proof.late).toEqual({ state: "suspended", hidden: true, select: false, posts: 0 });
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

function actualShellDriver(mode: "journey" | "late-import"): string {
  return `<script type="module">
	  const mode=${JSON.stringify(mode)};
	  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	  const until=async(test,label,timeout=3000)=>{const end=performance.now()+timeout;while(performance.now()<end){if(test())return;await sleep(10)}throw new Error('timed out waiting for '+label)};
  const proof=document.createElement('pre');proof.id='actual-shell-proof';document.body.append(proof);
  const finish=value=>{proof.textContent=JSON.stringify(value)};
  try {
    await until(()=>!document.querySelector('#login-form button[type=submit]').disabled,'operator initialization');
	    const login=document.querySelector('#login-form');
	    login.elements.tenant.value='yellow-q208';login.elements.email.value='operator@yellow.local';login.elements.password.value='test-only';
	    login.requestSubmit();
	    if(mode==='late-import'){
	      await globalThis.__q208LateInvoiceLogout;
	      await until(()=>document.documentElement.dataset.q208InvoiceModuleEvaluated==='true','late invoice import settlement');
	      finish({mode,pathname:location.pathname,loginVisible:!document.querySelector('#login-view').hidden,
	        mountText:document.querySelector('#invoices-mount').textContent,
	        focus:document.activeElement===login.elements.email});
	    }else{
	      await until(()=>!document.querySelector('#workbench-view').hidden,'authenticated workbench');
      await until(()=>document.querySelector('#invoices-mount').dataset.invoiceState==='selection','deep issue selection');
      const initial={pathname:location.pathname,property:document.querySelector('#property-select').value,
        view:document.querySelector('#invoices-mount').dataset.invoiceView,
        state:document.querySelector('#invoices-mount').dataset.invoiceState,
        focus:document.activeElement?.classList.contains('invoice-workbench__issue-heading')===true,
        buyerBlank:document.querySelector('.invoice-workbench__recipient-select')?.value==='',
        activeView:!document.querySelector('#invoices-view').hidden};
      document.querySelector('.invoice-workbench__issue-back').click();
	      await until(()=>!document.querySelector('#folio-invoice-review').hidden&&document.activeElement===document.querySelector('#folios-title'),'folio statement and focus after Back');
      const back={pathname:location.pathname,activeView:!document.querySelector('#folios-view').hidden,
        focus:document.activeElement===document.querySelector('#folios-title'),
        reviewText:document.querySelector('#folio-invoice-review').textContent};
      document.querySelector('#folio-invoice-review').click();await sleep(0);
      const reviewFocus={pathname:location.pathname,activeView:!document.querySelector('#invoices-view').hidden,
        focus:document.activeElement===document.querySelector('#invoices-title')};
      await until(()=>document.querySelector('#invoices-mount').dataset.invoiceState==='loading','second readiness request');
      const properties=document.querySelector('#property-select');properties.value='00000000-0000-4000-8000-000000000003';
      properties.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>document.querySelector('#invoices-mount').dataset.invoiceState==='empty','new property queue');await sleep(420);
      const switched={pathname:location.pathname,property:properties.value,
        view:document.querySelector('#invoices-mount').dataset.invoiceView,
        state:document.querySelector('#invoices-mount').dataset.invoiceState,
        staleBuyer:document.querySelector('#invoices-mount').textContent.includes('River Guest'),
        empty:document.querySelector('#invoices-mount').textContent.includes('No issued invoices match')};
      const query=document.querySelector('.invoice-workbench__query');query.value='slow';
      document.querySelector('.invoice-workbench__search').requestSubmit();
      await until(()=>document.querySelector('#invoices-mount').dataset.invoiceState==='loading','slow queue request');
      document.querySelector('#sign-out').click();await sleep(420);
      finish({mode,initial,back,reviewFocus,switched,logout:{pathname:location.pathname,
        loginVisible:!document.querySelector('#login-view').hidden,
        workbenchHidden:document.querySelector('#workbench-view').hidden,
        mountText:document.querySelector('#invoices-mount').textContent,
        focus:document.activeElement===login.elements.email}});
    }
  }catch(error){finish({mode,driverError:String(error?.stack||error)})}
	  </script>`;
}

function lateInvoiceImportObserver(): string {
  return `<script>
  globalThis.__q208LateInvoiceLogout=new Promise((resolve,reject)=>{
    let handled=false;
    const observer=new MutationObserver(async()=>{
      const mount=document.querySelector('#invoices-mount');
      if(handled||!mount?.textContent.includes('Opening invoices'))return;
	      handled=true;observer.disconnect();
	      try{
	        if(document.querySelector('#workbench-view').hidden)throw new Error('invoice import began before authenticated workbench');
	        document.querySelector('#sign-out').click();
        const released=await fetch('/__q208/release-invoice-import',{method:'POST'});
        if(!released.ok)throw new Error('late invoice import release was not acknowledged');
        resolve();
      }catch(error){reject(error)}
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  });
  </script>`;
}

test("Q208 authenticated operator shell preserves invoice deep routes and suppresses late work", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Q208 operator-shell proof");
  const propertyA = uuid(2), propertyB = uuid(3), reservationId = uuid(4), folioId = uuid(5);
  const initialPath = `/p/${propertyA}/invoices/new/${reservationId}/${folioId}`;
  const recipient = { recipientRegistrationId: uuid(6), legalName: "River Guest Private Limited", gstin: "27AAPFU0939F1ZV", stateCode: "27" };
  const requests: Array<{ mode: string; path: string; method: string; authorization: string | null; body: unknown }> = [];
	  let mode: "journey" | "late-import" = "journey";
	  let readinessA = 0;
	  let releaseLateInvoiceImport: (() => void) | null = null;
  const sourceHtml = await Bun.file(resolve(repository, "src/http/operator/index.html")).text();
  const json = (value: unknown, status = 200) => Response.json(value, { status });
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
	    if (path === "/assets/operator-invoices.js" && mode === "late-import") {
	      await new Promise<void>(resolvePromise => { releaseLateInvoiceImport = resolvePromise; });
	      const moduleSource = await Bun.file(resolve(repository, "src/http/operator/invoices.js")).text();
	      return new Response(`${moduleSource}\ndocument.documentElement.dataset.q208InvoiceModuleEvaluated = "true";\n`, { headers: { "content-type": "text/javascript; charset=utf-8" } });
	    }
	    if (path === "/__q208/release-invoice-import" && mode === "late-import" && method === "POST") {
	      const release = releaseLateInvoiceImport;
	      releaseLateInvoiceImport = null;
	      if (!release) return new Response("invoice import was not pending", { status: 409 });
	      release();
	      return new Response(null, { status: 204 });
	    }
    const assets: Record<string, string> = {
      "/assets/operator.js": "src/http/operator/operator.js",
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator.css": "src/http/operator/operator.css",
    };
    if (assets[path]) return new Response(Bun.file(resolve(repository, assets[path])), { headers: { "content-type": path.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" } });
    if (path === "/api/v1/auth/local:login" && method === "POST") {
      requests.push({ mode, path, method, authorization: request.headers.get("authorization"), body: await request.json() });
      return json({ accessToken: "q208-shell-token", user: { displayName: "Q208 Operator" } });
    }
    if (path.startsWith("/api/")) {
      const body = method === "GET" ? null : await request.json();
      const authorization = request.headers.get("authorization");
      requests.push({ mode, path: `${path}${url.search}`, method, authorization, body });
      if (authorization !== "Bearer q208-shell-token") return json({ type: "unauthorized", message: "unauthorized" }, 401);
      if (path === "/api/v1/me/properties") return json({ properties: [
        { id: propertyA, name: "Hotel A", timezone: "Asia/Kolkata" },
        { id: propertyB, name: "Hotel B", timezone: "Asia/Kolkata" },
      ] });
      if (path.endsWith("/invoice-readiness")) {
        if (path.includes(propertyA) && ++readinessA > 1) await Bun.sleep(350);
        return json({ readiness: { kind: "selection_required", recipients: [recipient] } });
      }
      if (path.endsWith("/search")) {
        const query = typeof body === "object" && body !== null && "query" in body ? (body as { query?: unknown }).query : null;
        if (query === "slow") {
          await Bun.sleep(300);
          return json({ invoices: { items: [{ documentId: uuid(90), documentNumber: "INV/STALE", businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z", reservationId: uuid(91), folioId: uuid(92), recipientRegistrationId: uuid(93), buyerName: "Late Guest", buyerGstin: null, currency: "INR", taxableMinor: "10000", taxMinor: "500", totalMinor: "10500" }], matchingCount: "1", nextCursor: null } });
        }
        return json({ invoices: { items: [], matchingCount: "0", nextCursor: null } });
      }
      if (path === `/api/v1/properties/${propertyA}/folios/${folioId}/statement`) return json({
        reservationId, folio: { id: folioId, reference: "FOL-Q208", name: null, windowNo: 1, status: "closed", currency: "INR" },
        siblingWindows: [{ id: folioId, reference: "FOL-Q208", name: null, windowNo: 1, status: "closed", balanceMinor: "0" }],
        balanceMinor: "0", stayTotalMinor: "0", generation: "1", lineCount: 0, rows: [],
        chargeOptions: [], chargeAvailability: { allowed: false, reason: "No governed charges" }, nextCursor: null,
      });
      return json({ type: "not_found", message: `unexpected ${method} ${path}` }, 404);
    }
	    if (path === initialPath) {
	      const observedHtml = mode === "late-import"
	        ? sourceHtml.replace('<script src="/assets/operator.js" defer></script>', `${lateInvoiceImportObserver()}<script src="/assets/operator.js" defer></script>`)
	        : sourceHtml;
	      return new Response(observedHtml.replace("</body>", `${actualShellDriver(mode)}</body>`), { headers: { "content-type": "text/html; charset=utf-8" } });
	    }
    return new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-q208-operator-shell-"));
  const screenshot = process.env.YELLOW_Q208_OPERATOR_SCREENSHOT;
  try {
    for (const scenario of ["journey", "late-import"] as const) {
	      mode = scenario; readinessA = 0; releaseLateInvoiceImport = null;
      const arguments_ = [browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
        `--user-data-dir=${resolve(directory, `profile-${scenario}`)}`, "--window-size=1280,900", "--virtual-time-budget=5000", "--dump-dom"];
      if (screenshot && scenario === "journey") arguments_.push(`--screenshot=${resolve(screenshot)}`);
      arguments_.push(`http://127.0.0.1:${server.port}${initialPath}`);
      const result = await runOwnedProofProcess(arguments_, { timeoutMs: 20_000, maxOutputBytes: 1024 * 1024 });
      expect(result.exitCode).toBe(0);
      const encoded = result.stdout.match(/<pre id="actual-shell-proof">([^<]+)<\/pre>/)?.[1];
      if (!encoded) throw new Error(`actual operator shell did not complete (${scenario}): ${result.stderr.slice(-1000)}`);
      const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      expect(proof.driverError).toBeUndefined();
      if (scenario === "journey") {
        expect(proof.initial).toEqual({ pathname: initialPath, property: propertyA, view: "issue", state: "selection", focus: true, buyerBlank: true, activeView: true });
        expect(proof.back).toEqual({ pathname: `/p/${propertyA}/folio/${folioId}`, activeView: true, focus: true, reviewText: "Review invoice" });
        expect(proof.reviewFocus).toEqual({ pathname: initialPath, activeView: true, focus: true });
        expect(proof.switched).toEqual({ pathname: `/p/${propertyB}/invoices`, property: propertyB, view: "queue", state: "empty", staleBuyer: false, empty: true });
        expect(proof.logout).toEqual({ pathname: "/", loginVisible: true, workbenchHidden: true, mountText: "", focus: true });
      } else {
        expect(proof).toEqual({ mode: "late-import", pathname: "/", loginVisible: true, mountText: "", focus: true });
      }
    }
    const protectedCalls = requests.filter(call => call.path !== "/api/v1/auth/local:login");
    expect(protectedCalls.length).toBeGreaterThan(0);
    expect(protectedCalls.every(call => call.authorization === "Bearer q208-shell-token")).toBe(true);
    expect(requests.filter(call => call.mode === "late-import" && call.path.includes("invoice-readiness"))).toHaveLength(0);
    expect(requests.some(call => call.mode === "journey" && call.path === `/api/v1/properties/${propertyA}/folios/${folioId}/statement?limit=50`)).toBe(true);
    expect(requests.some(call => call.mode === "journey" && call.path === `/api/v1/properties/${propertyB}/invoices/search`)).toBe(true);
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 50_000);

type ReadyGeometry = Readonly<{
  viewport: number;
  deviceScaleFactor: number;
  reducedMotion: boolean;
  documentOverflow: number;
  bodyOverflow: number;
  rootOverflow: number;
  issueOverflow: number;
  visiblePanels: number;
  layoutWidth: number;
  detailWidth: number;
  partyColumns: number;
  nightsColumns: number;
  secondPartyBelowFirst: boolean;
  labelHeight: number;
  primaryHeight: number;
  primaryWidth: number;
  checkboxSize: number;
  wrappingFailures: number;
  rootFontSize: number;
  transitionDuration: string;
}>;

function readyVisualPage(): string {
  const recipients = [{
    recipientRegistrationId: uuid(6),
    legalName: "River Guest International Hospitality Services and Infrastructure Private Limited",
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
  }];
  const confirmation = {
    buyer: { ...recipients[0], addressLine: "Apartment 1708, Extremely Long Waterfront Residency, Dr Ambedkar Metropolitan Boulevard", locality: "Mumbai Metropolitan Region", postalCode: "400001" },
    seller: { legalName: "Yellow Hotels and Responsible Hospitality Operations Private Limited", gstin: "29AAPFU0939F1ZR", stateCode: "29", addressLine: "Plot 118, International Technology and Convention Campus, Outer Ring Road", locality: "Bengaluru Urban District", postalCode: "560001" },
    placeOfSupplyStateCode: "27", issueDate: "2044-09-06", timeOfSupplyDate: "2044-09-05", serviceProvisionDate: "2044-09-04", paymentReceiptDate: "2044-09-05",
    seriesPrefix: "YSERIES2044/", financialYearStart: "2044-04-01", currency: "INR",
    taxableMinor: "1888888888888888887", taxMinor: "94444444444444443", totalMinor: "1983333333333333330",
    configuration: { extensionId: uuid(60), version: 2044, contentHash: "abcdef0123456789".repeat(4) },
    roomNights: [
      { ordinal: 0, businessDate: "2044-09-04", taxableMinor: "999999999999999999", taxMinor: "49999999999999999", aggregateRateBasisPoints: 500, components: [{ identity: "igst", rateBasisPoints: 500, taxMinor: "49999999999999999" }] },
      { ordinal: 1, businessDate: "2044-09-05", taxableMinor: "888888888888888888", taxMinor: "44444444444444444", aggregateRateBasisPoints: 500, components: [{ identity: "igst", rateBasisPoints: 500, taxMinor: "44444444444444444" }] },
    ],
  };
  return `<!doctype html><html lang="en" data-theme="apple" data-workspace-skin="calm"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/operator.css"></head>
  <body><main style="padding:24px"><section id="ready-root" class="invoice-workbench" aria-label="Invoice readiness"></section></main><script type="module">
  const recipients=${JSON.stringify(recipients)},confirmation=${JSON.stringify(confirmation)};
  const request=async(path,options={})=>{const body=JSON.parse(options.body);if(body.recipientRegistrationId===null)return {readiness:{kind:'selection_required',recipients}};return {readiness:{kind:'ready',selectorHash:'3'.repeat(64),evidenceHash:'4'.repeat(64),confirmation}}};
  const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');const root=document.querySelector('#ready-root');
  const workbench=createInvoiceWorkbench({root,request,propertyNode:'${uuid(2)}',timezone:'Asia/Kolkata',navigate:()=>{},returnToFolio:()=>{}});
  await workbench.showIssue({reservationId:'${uuid(4)}',folioId:'${uuid(5)}'});const select=root.querySelector('.invoice-workbench__recipient-select');
  select.value=recipients[0].recipientRegistrationId;select.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector('.invoice-workbench__readiness-submit').click();
  const end=performance.now()+3000;while(root.dataset.invoiceState!=='ready'&&performance.now()<end)await new Promise(resolve=>setTimeout(resolve,10));
  if(root.dataset.invoiceState!=='ready')throw new Error('ready confirmation did not render');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.body.dataset.ready='true';
  </script></body></html>`;
}

async function withReadyCdp<T>(url: string, profile: string, run: (send: <R>(method: string, params?: Record<string, unknown>) => Promise<R>) => Promise<T>): Promise<T> {
  if (!browser) throw new Error("Chrome or Edge is required for the Q208 visual proof");
  const chrome = Bun.spawn([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  try {
    const portFile = resolve(profile, "DevToolsActivePort"); let port = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try { if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? ""; } catch (error) {
        if (!(typeof error === "object" && error !== null && ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code)))) throw error;
      }
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})`);
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl); let nextId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Chromium debugger socket failed")), { once: true });
      socket.addEventListener("message", event => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
        if (!message.id) return; const command = pending.get(message.id); if (!command) return; pending.delete(message.id);
        if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed")); else command.resolve(message.result);
      });
    });
    const send = <R>(method: string, params: Record<string, unknown> = {}) => new Promise<R>((resolveCommand, rejectCommand) => {
      nextId += 1; pending.set(nextId, { resolve: value => resolveCommand(value as R), reject: rejectCommand });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
    try { return await run(send); } finally { socket.close(); }
  } finally {
    if (chrome.exitCode === null) chrome.kill();
    await chrome.exited;
  }
}

test("Q208 ready confirmation is contained and legible at exact responsive widths", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Q208 visual proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(readyVisualPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path === "/assets/operator.css") return new Response(Bun.file(resolve(repository, "src/http/operator/operator.css")), { headers: { "content-type": "text/css; charset=utf-8" } });
    if (path === "/assets/operator-invoices.js") return new Response(Bun.file(resolve(repository, "src/http/operator/invoices.js")), { headers: { "content-type": "text/javascript; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  } });
  const profiles = await mkdtemp(resolve(tmpdir(), "yellow-q208-ready-cdp-"));
  const artifactRoot = existsSync("D:/Yellow/temp") ? "D:/Yellow/temp" : tmpdir();
  const artifacts = await mkdtemp(resolve(artifactRoot, "yellow-q208-invoice-ready-"));
  const targetUrl = `http://127.0.0.1:${server.port}/`;
  const geometryExpression = `JSON.stringify((()=>{const root=document.querySelector('#ready-root'),layout=root.querySelector('.invoice-workbench__layout'),detail=root.querySelector('.invoice-workbench__detail'),issue=root.querySelector('.invoice-workbench__issue'),parties=root.querySelector('.invoice-workbench__confirmation-parties'),nights=root.querySelector('.invoice-workbench__confirmation-nights'),party=[...root.querySelectorAll('.invoice-workbench__confirmation-party')],label=root.querySelector('.invoice-workbench__confirm-field'),primary=root.querySelector('.invoice-workbench__issue-submit'),checkbox=root.querySelector('.invoice-workbench__confirm-check'),columns=element=>getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,overflow=element=>Math.max(0,element.scrollWidth-element.clientWidth),wrapped=[...root.querySelectorAll('dd,.invoice-workbench__confirmation-component,.invoice-workbench__confirmation-night-total')];return {viewport:innerWidth,deviceScaleFactor:devicePixelRatio,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,documentOverflow:overflow(document.documentElement),bodyOverflow:overflow(document.body),rootOverflow:overflow(root),issueOverflow:overflow(issue),visiblePanels:[...layout.children].filter(element=>getComputedStyle(element).display!=='none').length,layoutWidth:layout.getBoundingClientRect().width,detailWidth:detail.getBoundingClientRect().width,partyColumns:columns(parties),nightsColumns:columns(nights),secondPartyBelowFirst:party[1].getBoundingClientRect().top>=party[0].getBoundingClientRect().bottom,labelHeight:label.getBoundingClientRect().height,primaryHeight:primary.getBoundingClientRect().height,primaryWidth:primary.getBoundingClientRect().width,checkboxSize:Math.min(checkbox.getBoundingClientRect().width,checkbox.getBoundingClientRect().height),wrappingFailures:wrapped.filter(element=>element.scrollWidth>element.clientWidth+1).length,rootFontSize:parseFloat(getComputedStyle(document.documentElement).fontSize),transitionDuration:getComputedStyle(primary).transitionDuration}})())`;
  try {
    const proofs = await withReadyCdp(targetUrl, resolve(profiles, "chrome"), async send => {
      await send("Page.enable"); await send("Runtime.enable");
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      const measured: ReadyGeometry[] = [];
      for (const width of [320, 375, 768, 1280]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 2, mobile: width < 768 });
        await send("Page.navigate", { url: targetUrl });
        let ready = false;
        for (let attempt = 0; attempt < 160; attempt += 1) {
          const result = await send<{ result?: { value?: boolean } }>("Runtime.evaluate", { expression: "document.body?.dataset.ready === 'true'", returnByValue: true });
          ready = result.result?.value === true; if (ready) break; await Bun.sleep(25);
        }
        if (!ready) {
          const diagnostic = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: "JSON.stringify({state:document.querySelector('#ready-root')?.dataset.invoiceState,text:document.querySelector('#ready-root')?.textContent,ready:document.body?.dataset.ready})", returnByValue: true });
          throw new Error(`ready confirmation did not load at ${width}px: ${diagnostic.result?.value ?? "no diagnostic"}`);
        }
        const result = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: geometryExpression, returnByValue: true });
        if (!result.result?.value) throw new Error(`ready confirmation produced no geometry at ${width}px`);
        measured.push(JSON.parse(result.result.value) as ReadyGeometry);
        if (width === 375 || width === 1280) {
          const screenshot = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
          if (!screenshot.data) throw new Error(`ready confirmation produced no screenshot at ${width}px`);
          await Bun.write(resolve(artifacts, width === 375 ? "invoice-ready-phone-375.png" : "invoice-ready-desktop-1280.png"), Buffer.from(screenshot.data, "base64"));
        }
      }
      await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 1000, deviceScaleFactor: 2, mobile: true });
      await send("Page.navigate", { url: targetUrl });
      for (let attempt = 0; attempt < 160; attempt += 1) {
        const result = await send<{ result?: { value?: boolean } }>("Runtime.evaluate", { expression: "document.body?.dataset.ready === 'true'", returnByValue: true });
        if (result.result?.value === true) break; if (attempt === 159) throw new Error("ready confirmation did not load for 200% text proof"); await Bun.sleep(25);
      }
      await send("Runtime.evaluate", { expression: "document.documentElement.style.fontSize='200%'", returnByValue: true });
      await Bun.sleep(50);
      const enlarged = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: geometryExpression, returnByValue: true });
      if (!enlarged.result?.value) throw new Error("ready confirmation produced no 200% text geometry");
      return { measured, enlarged: JSON.parse(enlarged.result.value) as ReadyGeometry };
    });
    expect(proofs.measured.map(({ viewport, deviceScaleFactor }) => ({ viewport, deviceScaleFactor }))).toEqual([
      { viewport: 320, deviceScaleFactor: 2 }, { viewport: 375, deviceScaleFactor: 2 },
      { viewport: 768, deviceScaleFactor: 2 }, { viewport: 1280, deviceScaleFactor: 2 },
    ]);
    expect(proofs.measured.every(proof => proof.reducedMotion && proof.transitionDuration === "0s")).toBe(true);
    expect(proofs.measured.every(proof => proof.documentOverflow === 0 && proof.bodyOverflow === 0 && proof.rootOverflow === 0 && proof.issueOverflow === 0 && proof.wrappingFailures === 0)).toBe(true);
    expect(proofs.measured.every(proof => proof.visiblePanels === 1 && Math.abs(proof.layoutWidth - proof.detailWidth) < 1)).toBe(true);
    expect(proofs.measured.filter(proof => proof.viewport <= 375).every(proof => proof.partyColumns === 1 && proof.nightsColumns === 1 && proof.secondPartyBelowFirst)).toBe(true);
    expect(proofs.measured.filter(proof => proof.viewport >= 768).every(proof => proof.partyColumns === 2 && proof.nightsColumns === 2 && !proof.secondPartyBelowFirst)).toBe(true);
    expect(proofs.measured.every(proof => proof.labelHeight >= 48 && proof.primaryHeight >= 48 && proof.checkboxSize >= 19 && proof.checkboxSize <= 21)).toBe(true);
    expect(proofs.measured.filter(proof => proof.viewport <= 375).every(proof => proof.primaryWidth >= proof.detailWidth - 34)).toBe(true);
    expect(proofs.enlarged).toMatchObject({ viewport: 375, reducedMotion: true, documentOverflow: 0, bodyOverflow: 0, rootOverflow: 0, issueOverflow: 0, visiblePanels: 1, partyColumns: 1, nightsColumns: 1, wrappingFailures: 0, rootFontSize: 32 });
    expect(proofs.enlarged.labelHeight).toBeGreaterThanOrEqual(48);
    expect(proofs.enlarged.primaryHeight).toBeGreaterThanOrEqual(48);
    expect(existsSync(resolve(artifacts, "invoice-ready-phone-375.png"))).toBe(true);
    expect(existsSync(resolve(artifacts, "invoice-ready-desktop-1280.png"))).toBe(true);
  } finally {
    server.stop(true);
    await rm(profiles, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60_000);

test("Q208 browser module stays bounded, private and never embeds provider configuration", async () => {
  const source = await Bun.file(resolve(repository, "src/http/operator/invoices.js")).text();
  expect(source).toContain('import("/assets/operator-invoice-print.js")');
  expect(source).toContain("MAX_RETAINED_INVOICES");
  expect(source).toContain("AbortController");
  expect(source).toContain("data-invoice-issue-slot");
  expect(source).toContain("showIssue");
  expect(source).toContain("Idempotency-Key");
  expect(source).toContain("/fiscal-provider-options");
  expect(source).toContain("/fiscal-submissions");
  expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  expect(source).not.toMatch(/credential|privateKey|clientSecret|providersFile|mock/i);
});
