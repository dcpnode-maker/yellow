import { expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fetchJsonBounded, terminateOwnedProcess } from './helpers/owned-cdp-proof-lifecycle';
import { resolve, join } from 'node:path';
import * as reads from '../src/http/operator/owner-trust-workbench-read.mjs';
import { renderOwnerTrustAccountEvidence } from '../src/http/operator/owner-trust-account-evidence.mjs';
import { renderOwnerTrustExpensePreviewEvidence } from '../src/http/operator/owner-trust-expense-preview-evidence.mjs';
import { renderOwnerTrustApprovalEvidence } from '../src/http/operator/owner-trust-approval-evidence.mjs';
import { operatorAssets } from '../src/http/operator';

const root = resolve(import.meta.dir, '..');
const source = readFileSync(resolve(root, 'src/http/operator/operator.js'), 'utf8').replace(/\r\n/g, '\n');
// Immutable slices from Git 6f3157126a3e353f931c288b3f5365b0152aed78:
// src/http/operator/operator.js raw SHA-256 6e426a44f0d5d2d83e84b197fc015fb21c136af1f21b6d31def3ca069b7a8bce.
// Extracted from those exact Git bytes; no checkout-relative historical fixture is required.
const historicalBase = Object.freeze({
  mutation: " async function requestTrustApproval() {\n  let draft; try { draft = trustDraft(); } catch (error) { trustMessage.textContent = error.message; return; } const preview = trustPreviewData;\n  if (!preview || preview.identity !== `${draft.accountId}:${draft.amountMinor}:${draft.reason}` || preview.approvalRequired !== true) return;\n  if (!confirm(`Request a different-user approval for ${trustMoney(draft.amountMinor, draft.account.currency)} from ${draft.account.accountLabel}?`)) { trustRequestApproval.focus({ preventScroll: true }); return; }\n  const property = propertySelect.value, generation = trustRequestGeneration, identity = `request:${property}:${preview.identity}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); trustRequestApproval.disabled = true;\n  try { await request(`/api/v1/properties/${enc(property)}/trust/accounts/${enc(draft.accountId)}/approval-requests`, { method: \"POST\", headers: { \"idempotency-key\": key }, body: JSON.stringify({ amountMinor: draft.amountMinor, reason: draft.reason }) }); if (!trustIsCurrent(generation, property, preview.identity)) return; trustMutationKeys.delete(identity); trustMessage.textContent = \"Approval requested. A different authorized user may decide it.\"; await loadTrustWorkbench({ focus: true });\n  } catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property, preview.identity)) { trustMessage.textContent = error instanceof Error ? error.message : \"Approval outcome is unknown; retry preserves the exact request identity.\"; trustMessage.classList.add(\"error\"); trustRequestApproval.disabled = false; trustRequestApproval.focus({ preventScroll: true }); } }\n }\n async function decideTrustApproval(approval, action, button) {\n  if (!confirm(`${action === \"approve\" ? \"Approve\" : \"Reject\"} this exact ${trustMoney(approval.amountMinor, approval.currency)} request?`)) { button.focus({ preventScroll: true }); return; }\n  const property = propertySelect.value, generation = trustRequestGeneration, identity = `${action}:${property}:${approval.approvalId}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); button.disabled = true;\n  try { await request(`/api/v1/properties/${enc(property)}/trust/approval-requests/${enc(approval.approvalId)}/${action}`, { method: \"POST\", headers: { \"idempotency-key\": key } }); if (!trustIsCurrent(generation, property)) return; trustMutationKeys.delete(identity); await loadTrustWorkbench({ focus: true }); }\n  catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property)) { trustMessage.textContent = error instanceof Error ? error.message : \"Decision outcome is unknown; retry preserves its exact identity.\"; trustMessage.classList.add(\"error\"); button.disabled = false; button.focus({ preventScroll: true }); } }\n }\n async function postTrustExpense() {\n  let draft; try { draft = trustDraft(); } catch (error) { trustMessage.textContent = error.message; return; } const preview = trustPreviewData;\n  if (!preview || preview.identity !== `${draft.accountId}:${draft.amountMinor}:${draft.reason}` || preview.canPost !== true) return;\n  if (!confirm(`Post ${trustMoney(draft.amountMinor, draft.account.currency)} as an immutable owner trust expense? This creates financial records and cannot be deleted.`)) { trustPost.focus({ preventScroll: true }); return; }\n  const property = propertySelect.value, generation = trustRequestGeneration, identity = `post:${property}:${preview.identity}:${preview.approvalId || \"none\"}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); trustPost.disabled = true;\n  try { await request(`/api/v1/properties/${enc(property)}/trust/accounts/${enc(draft.accountId)}/expenses`, { method: \"POST\", headers: { \"idempotency-key\": key }, body: JSON.stringify({ amountMinor: draft.amountMinor, reason: draft.reason, ...(preview.approvalId ? { approvalRequestId: preview.approvalId } : {}) }) }); if (!trustIsCurrent(generation, property, preview.identity)) return; trustMutationKeys.delete(identity); trustAmount.value = \"\"; trustReason.value = \"\"; clearTrustPreview(\"Expense posted\"); trustMessage.textContent = \"Owner trust expense posted as immutable balanced financial evidence.\"; await loadTrustWorkbench({ focus: true });\n  } catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property, preview.identity)) { trustMessage.textContent = error instanceof Error ? error.message : \"Post outcome is unknown; retry preserves its exact identity.\"; trustMessage.classList.add(\"error\"); trustPost.disabled = false; trustPost.focus({ preventScroll: true }); } }\n }\n",
  request: "  async function request(path, options = {}) {\n const { yellowDemoRetried = false, ...fetchOptions } = options;\n const headers = new Headers(fetchOptions.headers);\n headers.set(\"content-type\", \"application/json\");\n if (accessToken) headers.set(\"authorization\", `Bearer ${accessToken}`);\n const response = await fetch(path, { ...fetchOptions, headers });\n let body;\n try { body = await response.json(); } catch { body = null; }\n if (!response.ok) {\n  if (response.status === 401 && !yellowDemoRetried && path !== \"/api/v1/auth/demo:enter\" && document.documentElement.dataset.yellowAutomaticDemoLogin === \"1\") {\n   const demoResponse = await fetch(\"/api/v1/auth/demo:enter\", { method:\"POST\", headers:{ \"content-type\":\"application/json\" } });\n   const demoBody = await demoResponse.json().catch(() => null);\n   if (demoResponse.ok && demoBody?.accessToken) {\n    clearInventoryEvidence(\"Session changed. Refresh inventory to verify this session's configuration.\");\n    accessToken = demoBody.accessToken;\n    operator = demoBody.user;\n    return request(path, { ...fetchOptions, yellowDemoRetried:true });\n   }\n  }\n  const message = body && typeof body.detail === \"string\" ? body.detail : \"The request could not be completed\";\n  const error = new Error(message);\n  error.status = response.status;\n  error.problem = body;\n  throw error;\n }\n return body;\n }\n",
  login: "  function showLogin() {\n clearInventoryEvidence(\"Returned inventory has not been verified.\");\n resetInvoiceWorkbench();\n closeReservationPickupTaskDetail({ history: false, restoreFocus: false });\n accessToken = \"\";\n operator = null;\n loginView.hidden = false;\n workbenchView.hidden = true;\n sessionState.textContent = \"Local review \u00b7 signed out\";\n results.replaceChildren();\n inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };\n propertiesData = [];\n clientWebsitePreview.hidden = true;\n restrictionsData = [];\n rateData = { policies: [], ratePlans: [] };\n rateBuilderData = { catalogue: [], modelDrafts: [], targetDrafts: [], releases: [] };\n builderStep = 1;\n builderReleaseId = \"\";\n builderPreviewCells = [];\n builderSimulation = null;\n builderSimulationReleaseId = \"\";\n rateApprovalData = [];\n rateApprovalNextCursor = null;\n selectedRateApprovalId = \"\";\n builderBookingInstant = \"\";\n builderAiInterpretation = null;\n builderAiAppliedProposal = null;\n operationalBlocksData = [];\n inventoryPolicyData = { oosSellability: \"blocked\" };\n activeHoldsData = [];\n offlineLeasesData = [];\n currentRatePrice = null;\n reservationGuestData = null;\n reservationLifecycleData = null;\n reservationSegmentData = null;\n reservationBookingOffers = [];\n reservationBookingSelection = null;\n reservationBookingHold = null;\n reservationBookingDraft = null;\n reservationBookingSearchGeneration += 1;\n reservationBoardGeneration += 1;\n reservationDetailGeneration += 1;\n guestProfileGeneration += 1;\n closeGuestProfile({ restoreFocus: false });\n housekeepingGeneration += 1;\n housekeepingRequestGeneration += 1;\n housekeepingData = [];\n housekeepingReturnFocus = \"\";\n clearHousekeepingTaskDetailState();\n housekeepingAttempts.clear();\n housekeepingTaskDetailAttempts.clear();\n clearHousekeepingSheetState();\n clearVehicleRegisterState();\n vehicleLinkedReservationReturn = null;\n vehicleRegisterLinkedReservationReturn = null;\n reservationBoardRows = [];\n reservationBoardNextCursor = null;\n reservationRouteReservationId = \"\";\n currentReservationWorkbench = null;\n reservationOperationalPreparationReturn = null;\n checkInHousekeepingReturn = null;\n if (housekeepingArrivalReturnAction) housekeepingArrivalReturnAction.hidden = true;\n checkoutHousekeepingCompletion = null;\n checkoutHousekeepingActionOrigin = null;\n checkoutHousekeepingReturn = null;\n clearCheckoutHousekeepingReturnControl();\n reservationPrimaryFolioAttemptKey = \"\";\n reservationPrimaryFolioReservationId = \"\";\n reservationDrawerReturnView = \"\";\n reservationDrawerReturnReservationId = \"\";\n todayReturnFocus = { reservationId: \"\", cycle: 0 };\n resetTodayState();\n reservationCreateDirty = false;\n clearPartyProfileState();\n clearFolioState();\n cashierGeneration += 1;\n cashierData = null;\n cashierDrawerId = \"\";\n cashierLatestEvidence = null;\n clearReservationDrawerLifecycle();\n reservationGuestForm.hidden = true;\n reservationLifecycleEditor.hidden = true;\n reservationSegmentEditor.hidden = true;\n reservationBookingCommit.hidden = true;\n reservationBookingOptions.replaceChildren();\n reservationGuestList.replaceChildren();\n loadPriceCorrectionButton.hidden = true;\n rateCorrectionForm.hidden = true;\n trustRequestGeneration += 1; trustAccounts = []; trustApprovals = []; trustApprovalCursor = null; trustMutationKeys.clear(); clearTrustPreview();\n pendingKeys.clear();\n history.replaceState(null, \"\", \"/\");\n resetWorkspaceGroups();\n restoreLocalLoginDefaults();\n loginForm.elements.email.focus();\n }\n",
});
const historicalHash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const html = readFileSync(resolve(root, 'src/http/operator/index.html'), 'utf8');
const property = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const approvalId = '00000000-0000-4000-8000-000000000003';
const account = (id = accountId) => ({ accountReference: id, accountLabel: 'Native account', ownerLabel: 'Native owner', currency: 'USD', availableBalanceMinor: '12300', canPost: true });
const approval = (id = approvalId) => ({ approvalId: id, accountReference: accountId, accountLabel: 'Native account', ownerLabel: 'Native owner', currency: 'USD', amountMinor: '13000', availableBalanceMinor: '12300', projectedBalanceMinor: '-700', reason: 'Exact reason', requesterLabel: 'Native maker', status: 'approved', requestedAt: '2026-10-03T01:00:00.000Z', decidedAt: '2026-10-03T02:00:00.000Z', canDecide: false, canPost: true });
const preview = () => ({ ...account(), amountMinor: '13000', projectedBalanceMinor: '-700', approvalRequired: true });
type RequestRecord = { path: string; init: RequestInit };
type Fetcher = (path:string, init:RequestInit)=>Promise<Response>;
const response = (body:unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

// Minimal DOM contract for the actual source caller. Browser behavior is exercised
// separately by all six unchanged accepted renderer tests; no replacement caller.
class ElementFixture {
  children: ElementFixture[] = [];
  attributes = new Map<string,string>();
  listeners = new Map<string,((event:any)=>unknown)[]>();
  dataset: Record<string,string> = {};
  value = ''; text = ''; className = ''; type = ''; disabled = false; hidden = false; open = false;
  classList = { remove: (_name:string) => {}, add: (_name:string) => {} };
  constructor(readonly tagName:string) {}
  set textContent(value:string) { this.text = value; this.children = []; }
  get textContent():string { return this.text + this.children.map(c=>c.textContent).join(''); }
  appendChild(node:ElementFixture) { this.children.push(node); return node; }
  append(...nodes:ElementFixture[]) { this.children.push(...nodes); }
  replaceChildren(...nodes:ElementFixture[]) { this.children = [...nodes]; this.text = ''; if (this.tagName === 'SELECT') this.value = nodes[0]?.value ?? ''; }
  setAttribute(name:string, value:string) { this.attributes.set(name,value); }
  getAttribute(name:string) { return this.attributes.get(name) ?? null; }
  querySelectorAll(tag:string):ElementFixture[] { return this.children.flatMap(c=>[...(c.tagName.toLowerCase() === tag ? [c] : []), ...c.querySelectorAll(tag)]); }
  addEventListener(type:string, handler:(event:any)=>unknown) { this.listeners.set(type,[...(this.listeners.get(type)??[]),handler]); }
  async dispatch(type:string) { const event = { preventDefault() {}, stopImmediatePropagation() {} }; for (const handler of this.listeners.get(type)??[]) await handler(event); }
  focus(_options?:unknown) {} scrollIntoView(_options?:unknown) {}
}
function slice(text:string, from:string, to:string):string {
  const a=text.indexOf(from), b=text.indexOf(to,a); if(a<0||b<0)throw Error('Actual source boundary missing'); return text.slice(a,b);
}
function harness(fetcher?:Fetcher) {
  const nodes=new Map<string,ElementFixture>();
  const get=(id:string)=>{ let node=nodes.get(id); if(!node){node=new ElementFixture(id==='trust-account'?'SELECT':'DIV');nodes.set(id,node);}return node; };
  const calls:RequestRecord[]=[];
  const fetch = async (path:string, init:RequestInit) => {
    calls.push({path,init});
    if(fetcher)return fetcher(path,init);
    if(path==='/api/v1/me/properties')return response({properties:[{id:property}]});
    if(path.includes('/preview'))return response(preview());
    if(path.includes('/approval-requests?'))return response({approvals:[approval()],nextCursor:null});
    return response({accounts:[account()],nextCursor:null});
  };
  const vars=slice(source,' const trustView =',' let dayCloseSealDraft');
  const funcs=slice(source,' function trustCurrencyDigits(',' function invoiceNavigationRoute()');
  const events=slice(source,' trustRefresh.addEventListener(',' for (const control of managementJourneyControls)');
  const testSurface=`
   return {
    load:loadTrustWorkbench, accounts:loadTrustAccounts, inbox:loadTrustApprovals,
    preview:()=>previewTrustExpense({preventDefault(){}}), clear:clearTrustEvidence,
    change:(next)=>{ if('token' in next)accessToken=next.token;if('principal' in next)operator=next.principal;if('property' in next)propertySelect.value=next.property;if('view' in next)activeView=next.view; },
    state:()=>({accounts:trustAccounts,approvals:trustApprovals,preview:trustPreviewData,accountCursor:trustAccountCursor,inboxCursor:trustApprovalCursor,generation:trustRequestGeneration}),
    approve:()=>useTrustApprovedRequest(trustApprovals[0]),
    clickApproved:()=>{const button=trustApprovalInbox.querySelectorAll('button').find(b=>b.textContent==='Use approved request');if(!button)throw Error('Actual approved callback absent');return button.dispatch('click');},
    draft:()=>{trustAccount.value='${accountId}';trustAmount.value='130.00';trustReason.value='Exact reason';},
    edit:async()=>{trustReason.value='Changed reason';await trustReason.dispatch('input');}
   };
  `;
  const execute = new Function('$','document','Option','node','enc','fetch','modules',`
   let accessToken='token-one',operator={id:'maker'},activeView='trust';
   const propertySelect=$('#property-select');propertySelect.value='${property}';
   const propertiesData=[{id:'${property}',name:'Original property'}];
   const request=()=>{throw Error('Mutation/shared renewal forbidden in read fixture');};
   ${vars}
   trustModules=modules;trustModulesPromise=Promise.resolve(modules);
   ${funcs}
   ${events}
   ${testSurface}
  `);
  const node=(tag:string,className='',text='')=>{const n=new ElementFixture(tag.toUpperCase());n.className=className;n.textContent=text;return n;};
  class OptionFixture extends ElementFixture { constructor(text:string,value:string){super('OPTION');this.textContent=text;this.value=value;} }
  const api=execute((selector:string)=>get(selector.slice(1)),{createElement:(tag:string)=>node(tag)},OptionFixture,node,encodeURIComponent,fetch,{...reads,renderOwnerTrustAccountEvidence,renderOwnerTrustExpensePreviewEvidence,renderOwnerTrustApprovalEvidence});
  return { api, get, calls };
}
const settle = async () => { for(let i=0;i<12;i++)await Promise.resolve(); await new Promise(resolve=>setTimeout(resolve,0)); };

test('actual caller backprojection preserves every financial mutation and shared request byte-for-byte',()=>{
  expect(historicalHash(historicalBase.mutation)).toBe('f01d5f6602845c8b943a8f400e050357485931b9c8041c5e84ef13b5adfbfe1c');
  expect(slice(source," async function requestTrustApproval()"," function invoiceNavigationRoute()")).toBe(historicalBase.mutation);
  expect(historicalHash(historicalBase.request)).toBe('5c5baf56f754205ed2aa564ea7adc9baaeff6ea896884547dfea24ff1e64ab32');
  expect(slice(source,"  async function request(path","  function setLoginMessage")).toBe(historicalBase.request);
  expect(historicalHash(historicalBase.login)).toBe('a145c41d521f2ed30a9ace9a0f502f8697d2f4c3130b6804d934fa6de386ce46');
  expect(slice(source,"  function showLogin()"," async function loadProperties()")).toBe(historicalBase.login);
  expect(source).not.toContain('trustAccounts.push(account)');
  expect(source).toContain('void useTrustApprovedRequest(approval)');
  expect(source).toContain('if (previousView === "trust" && activeView !== "trust") clearTrustEvidence();');
  expect(source).toContain('trustMutationKeys.clear(); clearTrustPreview();');
  for(const id of ['trust-account-evidence','trust-account-details','trust-account-more','trust-preview-facts','trust-approval-inbox'])expect(html).toContain(`id="${id}"`);
});

test('actual ready/empty caller mounts accepted renderers with collapsed account support and current preview',async()=>{
  const h=harness();await h.api.load();
  expect(h.get('trust-account-evidence').textContent).toContain('Native account');
  expect(h.get('trust-account-details').open).toBe(false);
  expect(h.get('trust-approval-inbox').textContent).toContain('request snapshots');
  expect(h.api.state().accounts).toHaveLength(1);expect(h.api.state().approvals).toHaveLength(1);
  h.api.draft();await h.api.preview();expect(h.api.state().preview.amountMinor).toBe('13000');
  expect(h.get('trust-request-approval').disabled).toBe(false);expect(h.get('trust-post').disabled).toBe(true);
  expect(h.get('trust-preview-facts').textContent).toContain('Exact reason');
  expect(h.calls.every(call=>new Headers(call.init.headers).get('authorization')==='Bearer token-one')).toBe(true);
  const empty=harness(path=>response(path==='/api/v1/me/properties'?{properties:[{id:property}]}:path.includes('approval-requests')?{approvals:[],nextCursor:null}:{accounts:[],nextCursor:null}));
  await empty.api.load();expect(empty.api.state().accounts).toHaveLength(0);expect(empty.api.state().approvals).toHaveLength(0);expect(empty.get('trust-account').disabled).toBe(true);
});

test('checker-only maker denial verifies current property and still loads independent inbox',async()=>{
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/accounts?')?response({detail:'maker denied'},403):response({approvals:[{...approval(),status:'pending',canDecide:true,canPost:false}],nextCursor:null}));
  await h.api.load();expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(1);
  expect(h.get('trust-approval-inbox').textContent).toContain('Approve exact request');expect(h.get('trust-account').disabled).toBe(true);
  expect(h.get('trust-approval-inbox').textContent).not.toContain('Use approved request');
  // Generic property membership is no longer retried as finance permission.
  expect(h.calls.filter(c=>c.path==='/api/v1/me/properties')).toHaveLength(1);
  expect(h.calls.filter(c=>c.path.includes('/approval-requests?'))).toHaveLength(2);
});

test('strict native parsers reject malformed sparse duplicate accessor and oversized pages without getter execution',()=>{
  let getter=0;
  for(const value of [{},{accounts:null,nextCursor:null},{accounts:[account(),account()],nextCursor:null},{accounts:Array(1),nextCursor:null},{accounts:Array.from({length:101},()=>account()),nextCursor:null},{accounts:[{...account(),currency:'bad'}],nextCursor:null},{accounts:[],nextCursor:''}])expect(()=>reads.parseOwnerTrustAccounts(value)).toThrow();
  const hostile=Object.defineProperty({...account()},'availableBalanceMinor',{get(){getter++;return '100';}});
  expect(()=>reads.parseOwnerTrustAccounts({accounts:[hostile],nextCursor:null})).toThrow();expect(getter).toBe(0);
  expect(()=>reads.parseOwnerTrustApprovals({approvals:[approval(),approval()],nextCursor:null})).toThrow();
  expect(()=>reads.parseOwnerTrustPreview({...preview(),approvalRequired:1})).toThrow();
  expect(reads.parseOwnerTrustPreview({...preview(),availableBalanceMinor:'-9999999999999999999999'}).availableBalanceMinor).toBe('-9999999999999999999999');
});

test('account and inbox pagination retain order and exact cursors; duplicate pages/cycles fail atomically',async()=>{
  const secondAccount='00000000-0000-4000-8000-000000000004',secondApproval='00000000-0000-4000-8000-000000000005';
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?response({approvals:[approval(path.includes('after=50')?secondApproval:approvalId)],nextCursor:path.includes('after=50')?null:'50'}):response({accounts:[account(path.includes('after=50')?secondAccount:accountId)],nextCursor:path.includes('after=50')?null:'50'}));
  await h.api.load();await h.api.accounts({append:true});await h.api.inbox({append:true});
  expect(h.api.state().accounts.map((r:any)=>r.accountReference)).toEqual([accountId,secondAccount]);expect(h.api.state().approvals.map((r:any)=>r.approvalId)).toEqual([approvalId,secondApproval]);
  expect(h.calls.filter(c=>c.path.includes('after=50'))).toHaveLength(2);expect(h.get('trust-account-more').hidden).toBe(true);
  for(const following of ['50','25'])expect(()=>reads.appendOwnerTrustPage([account()],[account(secondAccount)],r=>r.accountReference,['25'],'50',following)).toThrow();
  expect(()=>reads.appendOwnerTrustPage([account()],[account()],r=>r.accountReference,[],'50',null)).toThrow();
  expect(()=>reads.appendOwnerTrustPage(Array.from({length:100},(_,i)=>account(String(i))),[account()],r=>r.accountReference,[],null,null)).toThrow();
  const dup=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:'50'}):response({accounts:[account()],nextCursor:'50'}));
  await dup.api.load();await dup.api.accounts({append:true});await dup.api.inbox({append:true});expect(dup.api.state().accounts).toHaveLength(0);expect(dup.api.state().approvals).toHaveLength(0);
});

test('malformed read clears only its operation; explicit refresh recovers; permission loss clears all memory/actions',async()=>{
  let malformed=false,deny=false,granted=true;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:granted?[{id:property}]:[]}):path.includes('approval-requests')?(deny?response({},403):response(malformed?{}:{approvals:[approval()],nextCursor:null})):response({accounts:[account()],nextCursor:null}));
  await h.api.load();malformed=true;await h.api.inbox();expect(h.api.state().approvals).toHaveLength(0);expect(h.api.state().accounts).toHaveLength(1);
  malformed=false;await h.api.load();expect(h.api.state().approvals).toHaveLength(1);
  deny=true;granted=false;await h.api.inbox();expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(0);expect(h.get('trust-account-evidence').textContent).toBe('');expect(h.get('trust-post').disabled).toBe(true);
});

test('unverifiable property grant and expired token fail closed without shared demo renewal',async()=>{
  for(const failure of [401,403,404]){
    let deny=false;
    const h=harness(path=>deny?response({},failure):path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
    await h.api.load();deny=true;await h.api.inbox();expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(0);expect(h.calls.some(c=>c.path.includes('demo:enter'))).toBe(false);expect(h.get('trust-request-approval').disabled).toBe(true);
  }
});

test('held actual reads cannot repopulate property token principal logout or view transitions',async()=>{
  for(const change of [{property:'00000000-0000-4000-8000-000000000009'},{token:'token-two'},{principal:{id:'other'}},{token:'',principal:null},{view:'today'}]){
   let held:((response:Response)=>void)|undefined;
   const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):new Promise(resolve=>{held=resolve;}));
   const loading=h.api.load();await settle();expect(held).toBeDefined();h.api.change(change);held!(new Response(JSON.stringify({accounts:[account()],nextCursor:null})));await loading;
   expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(0);expect(h.get('trust-account-evidence').textContent).toBe('');expect(h.get('trust-approval-inbox').textContent).toBe('');expect(h.get('trust-post').disabled).toBe(true);
  }
});

test('native 401 during parallel inbox/account and held preview clears all evidence and fences late successes',async()=>{
  let heldInbox:((response:Response)=>void)|undefined;
  const parallel=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?new Promise(resolve=>{heldInbox=resolve;}):response({},401));
  const loading=parallel.api.load();await settle();expect(heldInbox).toBeDefined();expect(parallel.api.state().accounts).toHaveLength(0);expect(parallel.get('trust-post').disabled).toBe(true);
  heldInbox!(new Response(JSON.stringify({approvals:[approval()],nextCursor:null})));await loading;expect(parallel.api.state().approvals).toHaveLength(0);expect(parallel.get('trust-approval-inbox').textContent).toBe('');
  let heldPreview:((response:Response)=>void)|undefined,deny=false;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?new Promise(resolve=>{heldPreview=resolve;}):path.includes('approval-requests')?(deny?response({},401):response({approvals:[approval()],nextCursor:null})):response({accounts:[account()],nextCursor:null}));
  await h.api.load();h.api.draft();const pending=h.api.preview();await settle();deny=true;await h.api.inbox();expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().preview).toBeNull();
  heldPreview!(new Response(JSON.stringify(preview())));await pending;expect(h.api.state().preview).toBeNull();expect(h.get('trust-post').disabled).toBe(true);expect(h.get('trust-request-approval').disabled).toBe(true);
});

test('preview replacement clears old evidence before pending read and rejects edits/mismatched response',async()=>{
  let held:((response:Response)=>void)|undefined,hold=false;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?(hold?new Promise(resolve=>{held=resolve;}):response(preview())):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
  await h.api.load();h.api.draft();await h.api.preview();hold=true;const loading=h.api.preview();await settle();expect(h.api.state().preview).toBeNull();expect(h.get('trust-request-approval').disabled).toBe(true);await h.api.edit();held!(new Response(JSON.stringify(preview())));await loading;expect(h.api.state().preview).toBeNull();expect(h.get('trust-preview-action').disabled).toBe(false);
  hold=false;h.api.draft();await h.api.preview();expect(h.api.state().preview).not.toBeNull();
  const mismatch=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?response({...preview(),amountMinor:'13001'}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
  await mismatch.api.load();mismatch.api.draft();await mismatch.api.preview();expect(mismatch.api.state().preview).toBeNull();expect(mismatch.get('trust-post').disabled).toBe(true);
});

test('actual approved-request click uses current maker/inbox and native preview; sends no financial mutation',async()=>{
  const h=harness();await h.api.load();await h.api.clickApproved();await settle();expect(h.api.state().preview.approvalId).toBe(approvalId);expect(h.get('trust-post').disabled).toBe(false);expect(h.get('trust-request-approval').disabled).toBe(true);
  const post=h.calls.find(c=>c.path.endsWith('/preview'))!;expect(post.init.method).toBe('POST');expect(post.init.body).toBe(JSON.stringify({amountMinor:'13000',reason:'Exact reason'}));expect(h.calls.every(c=>!c.path.endsWith('/expenses')&&!c.path.endsWith('/approve'))).toBe(true);
  for(const accounts of [[],[{...account(),canPost:false}],[{...account(),currency:'EUR'}]]){
   const missing=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts,nextCursor:null}));await missing.api.load();await missing.api.clickApproved();await settle();expect(missing.api.state().preview).toBeNull();expect(missing.get('trust-post').disabled).toBe(true);expect(missing.calls.some(c=>c.path.endsWith('/preview'))).toBe(false);
  }
});

test('refreshing an inbox invalidates an already enabled approved preview before the new read',async()=>{
  const h=harness();await h.api.load();await h.api.approve();expect(h.get('trust-post').disabled).toBe(false);
  const loading=h.api.inbox();expect(h.api.state().preview).toBeNull();expect(h.get('trust-post').disabled).toBe(true);await loading;expect(h.get('trust-post').disabled).toBe(true);
});

test('approved-request mismatch denial held draft/inbox changes and late session responses remain disabled',async()=>{
  for(const wrong of [{...preview(),amountMinor:'13001'},{...preview(),currency:'EUR'},{...preview(),approvalRequired:false},{}]){
   const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?response(wrong):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));await h.api.load();await h.api.approve();expect(h.api.state().preview).toBeNull();expect(h.get('trust-post').disabled).toBe(true);
  }
  for(const transition of ['draft','inbox','token','property','grant']){
   let held:((response:Response)=>void)|undefined,grant=true;
   const h=harness(path=>path==='/api/v1/me/properties'?response({properties:grant?[{id:property}]:[]}):path.includes('/preview')?new Promise(resolve=>{held=resolve;}):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
   await h.api.load();const loading=h.api.approve();await settle();expect(h.get('trust-post').disabled).toBe(true);
   if(transition==='draft')await h.api.edit();if(transition==='inbox')await h.api.inbox();if(transition==='token')h.api.change({token:'two'});if(transition==='property')h.api.change({property:'00000000-0000-4000-8000-000000000099'});if(transition==='grant')grant=false;
   held!(new Response(JSON.stringify(transition==='grant'?{}:preview()),{status:transition==='grant'?403:200}));await loading;expect(h.api.state().preview).toBeNull();expect(h.get('trust-post').disabled).toBe(true);
  }
});

test('static plumbing serves exact accepted module/CSS and local strict read asset without domain changes',async()=>{
  const assets=[['ownerTrustAccountEvidenceJs','owner-trust-account-evidence.mjs','js'],['ownerTrustAccountEvidenceCss','owner-trust-account-evidence.css','css'],['ownerTrustExpensePreviewEvidenceJs','owner-trust-expense-preview-evidence.mjs','js'],['ownerTrustExpensePreviewEvidenceCss','owner-trust-expense-preview-evidence.css','css'],['ownerTrustApprovalEvidenceJs','owner-trust-approval-evidence.mjs','js'],['ownerTrustApprovalEvidenceCss','owner-trust-approval-evidence.css','css'],['ownerTrustWorkbenchReadJs','owner-trust-workbench-read.mjs','js']] as const;
  const app=readFileSync(resolve(root,'src/app.ts'),'utf8');
  for(const [key,file,type] of assets){const asset=(operatorAssets as unknown as Record<string,()=>Response>)[key]!();expect(await asset.text()).toBe(readFileSync(resolve(root,'src/http/operator',file),'utf8'));expect(asset.headers.get('content-type')).toContain(type==='css'?'text/css':'text/javascript');expect(app).toContain(`/assets/operator-${file.replace(/\.mjs$/,'.js')}`);}
});


test('owned browser backprojects actual trust read callers and approved callback through native markup',async()=>{
  const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
  if(!existsSync(chrome))throw Error('Installed owned Chromium required');
  const dir=process.env.YELLOW_OWNER_ACTUAL_PROOF_DIR??resolve(root,'../proof/actual-browser');await mkdir(dir,{recursive:true});const proof=await mkdtemp(join(dir,'owned-'));

  const vars=slice(source,' const trustView =',' let dayCloseSealDraft');
  const functions=slice(source,' function trustCurrencyDigits(',' function invoiceNavigationRoute()');
  const events=slice(source,' trustRefresh.addEventListener(',' for (const control of managementJourneyControls)');
  const markup=html.match(/<section id="trust-view"[\s\S]*?<section id="status-view"/)?.[0].replace(/<section id="status-view"$/,'').replace('id="trust-view" hidden','id="trust-view"');
  if(!markup)throw Error('Actual native trust markup missing');
  const fixtureHtml='<!doctype html><html data-theme="apple"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OWNER-ACTUAL-04 synthetic connected caller</title><link rel="stylesheet" href="/assets/operator.css"><link rel="stylesheet" href="/assets/operator-owner-trust-account-evidence.css"><link rel="stylesheet" href="/assets/operator-owner-trust-expense-preview-evidence.css"><link rel="stylesheet" href="/assets/operator-owner-trust-approval-evidence.css"></head><body><main style="max-width:1100px;margin:16px auto;padding:0 12px"><select id="property-select"><option value="'+property+'">Original property</option></select>'+markup+'</main><script type="module" src="/caller.mjs"></script></body></html>';
  const fixtureJs='const $=s=>document.querySelector(s); const node=(tag,cls="",text="")=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;}; const enc=encodeURIComponent; let accessToken="synthetic-token",operator={id:"synthetic-maker"},activeView="trust"; const propertySelect=$("#property-select"),propertiesData=[{id:"'+property+'",name:"Original property"}];const request=()=>{throw Error("Financial mutation forbidden in this fixture")};'+vars+functions+events+'\nawait loadTrustWorkbench(); window.ownerTrustedInputs=[];trustReason.addEventListener("input",e=>window.ownerTrustedInputs.push(e.isTrusted));window.ownerActual={load:loadTrustWorkbench,inbox:loadTrustApprovals,clear:clearTrustEvidence,inspect:()=>({accounts:trustAccounts.length,approvals:trustApprovals.length,preview:trustPreviewData,postDisabled:trustPost.disabled,accountClosed:!trustAccountDetails.open,overflow:document.documentElement.scrollWidth>innerWidth,busy:trustWorkbench.getAttribute("aria-busy"),refreshDisabled:trustRefresh.disabled,inboxRefreshDisabled:trustInboxRefresh.disabled,trustedInputs:window.ownerTrustedInputs,targets:[...document.querySelectorAll("summary")].map(n=>n.getBoundingClientRect().height)}),draft:()=>{trustAccount.value="'+accountId+'";trustAmount.value="130.00";trustReason.value="Exact reason";},token:()=>{accessToken="changed-token";trustScopeCurrent();}};';
  const requestLog:unknown[]=[];
  const browserMode={makerDenied:false,holdInbox:false};const heldInboxes:((value:Response)=>void)[]=[];
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:async request=>{
    const url=new URL(request.url),p=url.pathname;
    if(p==='/p/'+property+'/trust')return new Response(fixtureHtml,{headers:{'content-type':'text/html'}});
    if(p==='/caller.mjs')return new Response(fixtureJs,{headers:{'content-type':'text/javascript'}});
    if(p.startsWith('/api/')){
      requestLog.push({path:p,method:request.method,query:url.search,authorization:request.headers.get('authorization'),body:await request.text()});
      if(p==='/api/v1/me/properties')return Response.json({properties:[{id:property}]});
      if(p.endsWith('/preview'))return browserMode.makerDenied?Response.json({status:403,type:'auth/scope_missing'},{status:403}):Response.json(preview());
      if(p.endsWith('/accounts'))return browserMode.makerDenied?Response.json({status:403,type:'auth/scope_missing'},{status:403}):Response.json({accounts:[account()],nextCursor:null});
      if(p.endsWith('/approval-requests')){if(browserMode.holdInbox)return new Promise<Response>(resolve=>{heldInboxes.push(resolve);});return Response.json({approvals:[browserMode.makerDenied?{...approval(),status:'pending',canPost:false,canDecide:true}:approval()],nextCursor:null});}
      return new Response('No financial mutation endpoint',{status:500});
    }
    if(p==='/assets/operator.css')return operatorAssets.css();
    const entries:Record<string,string>={
      '/assets/operator-owner-trust-account-evidence.js':'owner-trust-account-evidence.mjs',
      '/assets/operator-owner-trust-expense-preview-evidence.js':'owner-trust-expense-preview-evidence.mjs',
      '/assets/operator-owner-trust-approval-evidence.js':'owner-trust-approval-evidence.mjs',
      '/assets/operator-owner-trust-workbench-read.js':'owner-trust-workbench-read.mjs',
      '/assets/operator-owner-trust-account-evidence.css':'owner-trust-account-evidence.css',
      '/assets/operator-owner-trust-expense-preview-evidence.css':'owner-trust-expense-preview-evidence.css',
      '/assets/operator-owner-trust-approval-evidence.css':'owner-trust-approval-evidence.css',
      '/static/fonts/urbanist-v1.330.woff2':'vendor/urbanist-v1.330/Urbanist[ital,wght].woff2',
    };
    const name=entries[p];return name?new Response(Bun.file(resolve(root,'src/http/operator',name)),{headers:{'content-type':name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':'font/woff2'}}):new Response('Not found',{status:404});
  }});
  const url='http://127.0.0.1:'+server.port+'/p/'+property+'/trust';

  const profile = join(proof, "profile");
  const child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--disable-background-networking", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"],
  { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | undefined;
  let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  const consoleErrors: string[] = [];
  const layouts: unknown[] = [];
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 0;
  const wait = async (predicate: () => Promise<boolean>, label: string) => {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) { if (await predicate()) return; await Bun.sleep(30); }
    throw new Error(`Owned proof observation timeout: ${label}`);
  };
  try {
    await wait(async () => Bun.file(join(profile, "DevToolsActivePort")).exists(), "debugger startup");
    const port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]!;
    const targets = await fetchJsonBounded<{ webSocketDebuggerUrl: string; type: string }[]>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(item => item.type === "page");
    if (!target) throw new Error("Owned Chromium did not expose its synthetic page");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Owned CDP open deadline")), 5000);
      socket!.onopen = () => { clearTimeout(timer); resolve(); };
      socket!.onerror = () => { clearTimeout(timer); reject(new Error("Owned CDP open failed")); };
    });
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown") consoleErrors.push(JSON.stringify(message.params));
      if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params?.type)) consoleErrors.push(JSON.stringify(message.params));
      const current = pending.get(message.id);
      if (!current) return;
      clearTimeout(current.timer); pending.delete(message.id);
      if (message.error) current.reject(new Error(JSON.stringify(message.error))); else current.resolve(message.result);
    };
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Owned CDP deadline: ${method}`)); }, 5000);
      pending.set(id, { resolve, reject, timer });
      socket!.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T> => {
      const result = await send!("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value as T;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await send("Page.bringToFront");
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait(() => evaluate<boolean>("Boolean(window.ownerActual)"), "fixture mount");
    expect(await evaluate<string>("document.title")).toBe("OWNER-ACTUAL-04 synthetic connected caller");
    expect(await evaluate<string>("location.href")).toBe(url);


    // Observe real layout and input delivery; never infer a click from coordinates alone.
    await evaluate(`(()=>{
      const proof={node:null,selector:null,events:[],samples:[]};
      proof.begin=selector=>{proof.selector=selector;proof.node=document.querySelector(selector);if(!proof.node)throw Error('Owned pointer target missing');proof.node.scrollIntoView({block:'center',behavior:'instant'});};
      proof.sample=()=>{const n=proof.node,r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);const sample={x,y,key:JSON.stringify([r.x,r.y,r.width,r.height]),ready:n.isConnected&&!n.disabled&&r.width>0&&r.height>0&&Boolean(hit&&n.contains(hit)),expected:proof.selector,hit:hit?.id,scroll:scrollY,time:performance.now()};proof.samples.push(sample);return sample;};
      for(const type of ['mousedown','mouseup','click'])document.addEventListener(type,event=>{const n=proof.node,r=n?.getBoundingClientRect();proof.events.push({type,trusted:event.isTrusted,intended:Boolean(n&&n.contains(event.target)),target:event.target.id,expected:proof.selector,x:event.clientX,y:event.clientY,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,time:performance.now()});},true);
      window.ownerPointerProof=proof;
    })()`);
    type PointerSample={x:number;y:number;key:string;ready:boolean};
    type PointerEventProof={type:string;trusted:boolean;intended:boolean;target:string};
    const delivered=(events:PointerEventProof[])=>{
      if(events.length!==3||events.map(event=>event.type).join(',')!=='mousedown,mouseup,click'||events.some(event=>!event.trusted||!event.intended))throw Error('Owned pointer delivery missed intended target');
    };
    const dispatch=async(point:{x:number;y:number})=>{
      try { await send!('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1}); }
      finally { await send!('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1}); }
    };
    const click=async(selector:string)=>{
      const deadline=performance.now()+5000;
      await evaluate('ownerPointerProof.begin('+JSON.stringify(selector)+')');
      let previous:PointerSample|undefined,hovered:string|undefined;
      while(performance.now()<deadline){
        // Compare observations separated by actual captured compositor frames.
        await send!('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const sample=await evaluate<PointerSample>('ownerPointerProof.sample()');
        if(sample.ready&&previous?.ready&&sample.key===previous.key){
          if(hovered!==sample.key){
            await send!('Input.dispatchMouseEvent',{type:'mouseMoved',x:sample.x,y:sample.y});hovered=sample.key;previous=undefined;continue;
          }
          const start=await evaluate<number>('ownerPointerProof.events.length');
          await dispatch({x:sample.x,y:sample.y});
          delivered(await evaluate<PointerEventProof[]>('ownerPointerProof.events.slice('+start+')'));
          return;
        }
        previous=sample;
      }
      throw Error('Owned pointer target did not stabilize within 5000ms');
    };
    let pointerNegative=false;
    const proveMisalignment=async()=>{
      const before=requestLog.filter((entry:any)=>entry.path.endsWith('/preview')).length;
      const start=await evaluate<number>('ownerPointerProof.events.length');
      const point=await evaluate<PointerSample>(`(()=>{ownerPointerProof.begin('#trust-preview-action');const point=ownerPointerProof.sample();const blocker=document.createElement('button');blocker.id='owned-pointer-blocker';blocker.textContent='Owned negative: blocked target';blocker.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647';document.body.append(blocker);return point;})()`);
      try {
        expect(point.ready).toBe(true);
        // The old helper dispatches the previously valid coordinates without rechecking delivery.
        await dispatch({x:point.x,y:point.y});
        const missed=await evaluate<PointerEventProof[]>('ownerPointerProof.events.slice('+start+')');
        expect(missed.map(event=>event.type)).toEqual(['mousedown','mouseup','click']);
        expect(missed.every(event=>event.trusted&&event.target==='owned-pointer-blocker'&&!event.intended)).toBe(true);
        expect(()=>delivered(missed)).toThrow('Owned pointer delivery missed intended target');
        const blockedStart=await evaluate<number>('ownerPointerProof.events.length');
        let blockedError:unknown;
        try { await click('#trust-preview-action'); } catch(error) { blockedError=error; }
        expect(blockedError instanceof Error?blockedError.message:null).toBe('Owned pointer target did not stabilize within 5000ms');
        expect(await evaluate<number>('ownerPointerProof.events.length')).toBe(blockedStart);
        expect(requestLog.filter((entry:any)=>entry.path.endsWith('/preview')).length).toBe(before);
      } finally { await evaluate('document.querySelector("#owned-pointer-blocker").remove()'); }
      pointerNegative=true;
    };
    for(const theme of ['apple','android','win95','glass','neo','erp'])for(const width of [1280,375]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';ownerActual.load()');
      const result=await evaluate<any>('ownerActual.inspect()');expect(result).toMatchObject({accounts:1,approvals:1,postDisabled:true,accountClosed:true,overflow:false});
      await evaluate('document.querySelector("#trust-account-details summary").focus()');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      expect(await evaluate<boolean>('document.querySelector("#trust-account-details").open')).toBe(true);
      expect((await evaluate<any>('ownerActual.inspect()')).targets.every((height:number)=>height>=44)).toBe(true);
      await evaluate('ownerActual.draft()');if(!pointerNegative)await proveMisalignment();await click('#trust-preview-action');
      await wait(()=>evaluate<boolean>('Boolean(ownerActual.inspect().preview)'), 'exact native preview');
      expect((await evaluate<any>('ownerActual.inspect()')).preview.amountMinor).toBe('13000');
      expect(await evaluate<boolean>('document.querySelector("#trust-request-approval").disabled')).toBe(false);
      await evaluate('document.querySelector("#trust-approval-inbox button").scrollIntoView({block:"center"})');await click('#trust-approval-inbox button');
      await wait(()=>evaluate<boolean>('ownerActual.inspect().postDisabled===false'),'actual approved request callback');
      expect((await evaluate<any>('ownerActual.inspect()')).preview.approvalId).toBe(approvalId);
      if(theme==='apple'){
        await evaluate('window.scrollTo(0,0)');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(proof,width===375?'narrow.png':'desktop.png'),Buffer.from(shot.data,'base64'));
      }
      layouts.push({theme,width,actualReadCaller:true,exactApprovedPreview:true,keyboardDetails:true,overflow:false});
    }

    browserMode.makerDenied=true;await click('#trust-preview-action');
    await wait(()=>evaluate<boolean>('ownerActual.inspect().accounts===0&&ownerActual.inspect().approvals===0'),'browser role-only denial clears every lane');
    expect(await evaluate<any>('ownerActual.inspect()')).toMatchObject({accounts:0,approvals:0,preview:null,postDisabled:true,refreshDisabled:false,inboxRefreshDisabled:false});
    expect(await evaluate<string>('document.querySelector("#trust-account-evidence").textContent')).not.toContain('Native account');
    await click('#trust-inbox-refresh');await wait(()=>evaluate<boolean>('ownerActual.inspect().approvals===1'),'fresh checker-only inbox recovery');
    expect(await evaluate<any>('ownerActual.inspect()')).toMatchObject({accounts:0,approvals:1,postDisabled:true});
    expect(await evaluate<string>('document.querySelector("#trust-approval-inbox").textContent')).toContain('Approve exact request');
    browserMode.makerDenied=false;browserMode.holdInbox=true;await click('#trust-refresh');
    await wait(()=>evaluate<boolean>('!document.querySelector("#trust-reason").disabled'),'accounts enable during held inbox');
    await evaluate('ownerActual.draft();document.querySelector("#trust-reason").focus()');
    await send('Input.dispatchKeyEvent',{type:'char',key:'x',text:'x'});
    expect(await evaluate<boolean>('ownerActual.inspect().trustedInputs.includes(true)')).toBe(true);
    expect(heldInboxes).toHaveLength(1);browserMode.holdInbox=false;heldInboxes[0]!(Response.json({approvals:[approval()],nextCursor:null}));
    await wait(()=>evaluate<boolean>('ownerActual.inspect().busy==="false"&&!ownerActual.inspect().refreshDisabled&&!ownerActual.inspect().inboxRefreshDisabled'),'held input releases owned recovery controls');
    expect(await evaluate<any>('ownerActual.inspect()')).toMatchObject({accounts:1,approvals:1,preview:null,postDisabled:true});
    await click('#trust-refresh');await wait(()=>evaluate<boolean>('ownerActual.inspect().busy==="false"&&ownerActual.inspect().accounts===1&&ownerActual.inspect().approvals===1'),'explicit full refresh after held input');

    await evaluate('ownerActual.token()');expect(await evaluate<any>('ownerActual.inspect()')).toMatchObject({accounts:0,approvals:0,preview:null,postDisabled:true});
    expect(requestLog.every((entry:any)=>entry.authorization==='Bearer synthetic-token')).toBe(true);
    expect(requestLog.every((entry:any)=>entry.method==='GET'||entry.path.endsWith('/preview'))).toBe(true);
    expect(consoleErrors).toEqual([]);
    await writeFile(join(proof,'MOUNTED-PROOF.json'),JSON.stringify({passed:true,url,layouts,requestLog,consoleErrors,pointerNegative,pointer:await evaluate('({events:ownerPointerProof.events,samples:ownerPointerProof.samples})'),actualCallerBackprojection:true,roleDenialClearsAll:true,freshCheckerRecovery:true,trustedInputDuringHeldInboxRecovery:true,fullLegacyShellExecuted:false,nativeFinancialAcceptance:false,browserVersion:await send('Browser.getVersion')},null,2)+'\n');
    console.log('OWNER-ACTUAL-04 browser caller proof: '+proof);
  } catch(error) { const observation=send?await send('Runtime.evaluate',{expression:'JSON.stringify({pointer:window.ownerPointerProof?{events:ownerPointerProof.events,samples:ownerPointerProof.samples}:null,state:ownerActual.inspect(),text:document.querySelector("#trust-message").textContent})',returnByValue:true}).catch(failure=>String(failure)):null; if(send){const shot=await send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)await writeFile(join(proof,'failure.png'),Buffer.from(shot.data,'base64'));}await writeFile(join(proof,'FAILURE.json'),JSON.stringify({error:String(error),layouts,consoleErrors,requestLog,observation},null,2)+'\n');throw error;

  } finally {
    await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Owned proof closed")); }
    pending.clear(); server.stop(true);
  }

},90000);


test('reviewer role-only preview denial clears unauthorized account evidence while property remains granted',async()=>{
 let denied=false;
 const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?(denied?response({status:403,type:'https://yellow.test/problems/auth/scope_missing',detail:'Owner-trust expense access is not granted'},403):response(preview())):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
 await h.api.load();h.api.draft();await h.api.preview();denied=true;await h.api.preview();
 console.log(JSON.stringify({probe:'role-only-preview-denial',accountRows:h.api.state().accounts.length,approvalRows:h.api.state().approvals.length,accountText:h.get('trust-account-evidence').textContent,accountDisabled:h.get('trust-account').disabled,inboxText:h.get('trust-approval-inbox').textContent,preview:h.api.state().preview}));
 expect(h.api.state().accounts).toHaveLength(0);expect(h.get('trust-account-evidence').textContent).not.toContain('Native account');expect(h.get('trust-account').disabled).toBe(true);
});
test('reviewer role-only inbox denial clears unauthorized account evidence when neither finance role remains',async()=>{
 let denied=false;
 const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?(denied?response({status:403,type:'https://yellow.test/problems/auth/scope_missing',detail:'Owner-trust expense access is not granted'},403):response({approvals:[approval()],nextCursor:null})):response({accounts:[account()],nextCursor:null}));
 await h.api.load();denied=true;await h.api.inbox();
 console.log(JSON.stringify({probe:'role-only-inbox-denial',accountRows:h.api.state().accounts.length,approvalRows:h.api.state().approvals.length,accountText:h.get('trust-account-evidence').textContent,accountDisabled:h.get('trust-account').disabled}));
 expect(h.api.state().accounts).toHaveLength(0);expect(h.get('trust-account-evidence').textContent).not.toContain('Native account');expect(h.get('trust-account').disabled).toBe(true);
});
test('reviewer editing an enabled draft during held inbox preserves explicit refresh recovery',async()=>{
 let held:((response:Response)=>void)|undefined;
 const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?new Promise(resolve=>{held=resolve;}):response({accounts:[account()],nextCursor:null}));
 const loading=h.api.load();await settle();expect(held).toBeDefined();expect(h.get('trust-reason').disabled).toBe(false);h.api.draft();await h.api.edit();held!(new Response(JSON.stringify({approvals:[approval()],nextCursor:null})));await loading;
 console.log(JSON.stringify({probe:'draft-during-inbox',accountRows:h.api.state().accounts.length,approvalRows:h.api.state().approvals.length,refreshDisabled:h.get('trust-refresh').disabled,inboxRefreshDisabled:h.get('trust-inbox-refresh').disabled,busy:h.get('trust-workbench').getAttribute('aria-busy')}));
 expect(h.get('trust-refresh').disabled).toBe(false);expect(h.get('trust-inbox-refresh').disabled).toBe(false);expect(h.get('trust-workbench').getAttribute('aria-busy')).toBe('false');
});


test('V2 native negative metadata is validated without getters; unknown denial never admits finance',()=>{
 expect(reads.classifyOwnerTrustReadFailure(403,{status:403,type:'auth/scope_missing'}).kind).toBe('scope-missing');
 expect(reads.classifyOwnerTrustReadFailure(403,{status:403,type:'auth/property_forbidden'}).kind).toBe('property-forbidden');
 for(const body of [{},{status:200,type:'auth/scope_missing'},{status:403,type:'https://yellow.test/problems/auth/scope_missing'},{status:403,type:'unknown'},null])expect(reads.classifyOwnerTrustReadFailure(403,body).kind).toBe('unverified-denial');
 let getter=0;const hostile=Object.defineProperty({status:403},'type',{get(){getter++;return 'auth/scope_missing';}});expect(reads.classifyOwnerTrustReadFailure(403,hostile).kind).toBe('unverified-denial');expect(getter).toBe(0);
 expect(reads.classifyOwnerTrustReadFailure(401,{}).kind).toBe('session-denied');expect(reads.classifyOwnerTrustReadFailure(500,{}).kind).toBe('unavailable');
});

test('V2 role/property/unverified denial clears every cross-lane balance reference selector and action',async()=>{
 for(const type of ['auth/scope_missing','auth/property_forbidden','https://yellow.test/problems/auth/scope_missing','unknown','missing']){
  let deny=false;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?(deny?response(type==='missing'?{}:{status:403,type},403):response(preview())):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
  await h.api.load();h.api.draft();await h.api.approve();expect(h.get('trust-post').disabled).toBe(false);deny=true;await h.api.preview();
  expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(0);expect(h.api.state().preview).toBeNull();
  for(const id of ['trust-account-evidence','trust-approval-inbox','trust-preview-facts'])expect(h.get(id).textContent).not.toMatch(/Native account|Native owner|123\.00|130\.00|00000000/);
  for(const id of ['trust-account','trust-amount','trust-reason','trust-preview-action','trust-request-approval','trust-post'])expect(h.get(id).disabled).toBe(true);
  expect(h.get('trust-refresh').disabled).toBe(false);expect(h.get('trust-inbox-refresh').disabled).toBe(false);
  expect(h.calls.filter(c=>c.path==='/api/v1/me/properties')).toHaveLength(1);
 }
});

test('V2 maker loss recovers a fresh native checker inbox without restoring maker evidence',async()=>{
 let deny=false;
 const checker={...approval(),status:'pending',canDecide:true,canPost:false};
 const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?response({status:403,type:'auth/scope_missing'},403):path.includes('approval-requests')?response({approvals:[deny?checker:approval()],nextCursor:null}):deny?response({status:403,type:'auth/scope_missing'},403):response({accounts:[account()],nextCursor:null}));
 await h.api.load();h.api.draft();deny=true;await h.api.preview();expect(h.api.state().approvals).toHaveLength(0);
 await h.api.inbox();expect(h.api.state().approvals).toHaveLength(1);expect(h.get('trust-approval-inbox').textContent).toContain('Approve exact request');expect(h.api.state().accounts).toHaveLength(0);expect(h.get('trust-post').disabled).toBe(true);
 await h.api.load();expect(h.api.state().approvals).toHaveLength(1);expect(h.api.state().accounts).toHaveLength(0);expect(h.get('trust-account').disabled).toBe(true);expect(h.get('trust-workbench').getAttribute('aria-busy')).toBe('false');
});

test('V2 initial maker denial fences the old inbox in both response orders; fresh checker continuation alone recovers',async()=>{
 for(const first of ['account','inbox']){
  let heldAccount:((r:Response)=>void)|undefined,heldInbox:((r:Response)=>void)|undefined,inboxReads=0;
  const checker={...approval(),status:'pending',canDecide:true,canPost:false};
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/accounts?')?new Promise(resolve=>{heldAccount=resolve;}):++inboxReads===1?new Promise(resolve=>{heldInbox=resolve;}):response({approvals:[checker],nextCursor:null}));
  const loading=h.api.load();await settle();expect(heldAccount).toBeDefined();expect(heldInbox).toBeDefined();
  if(first==='inbox'){heldInbox!(new Response(JSON.stringify({approvals:[approval()],nextCursor:null})));await settle();}
  heldAccount!(new Response(JSON.stringify({status:403,type:'auth/scope_missing'}),{status:403}));await loading;
  if(first==='account'){heldInbox!(new Response(JSON.stringify({approvals:[approval()],nextCursor:null})));await settle();}
  expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().approvals).toHaveLength(1);expect(h.api.state().approvals[0].canPost).toBe(false);expect(h.get('trust-approval-inbox').textContent).not.toContain('Use approved request');expect(inboxReads).toBe(2);
  expect(h.get('trust-refresh').disabled).toBe(false);expect(h.get('trust-inbox-refresh').disabled).toBe(false);
 }
});

test('V2 finance revocation fences held account and preview successes while fresh inbox is admitted',async()=>{
 for(const lane of ['account','preview']){
  let hold=false,denyInbox=false,held:((r:Response)=>void)|undefined;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?denyInbox?response({status:403,type:'auth/scope_missing'},403):response({approvals:[{...approval(),canPost:false,canDecide:true,status:'pending'}],nextCursor:null}):path.includes('/preview')?hold&&lane==='preview'?new Promise(resolve=>{held=resolve;}):response(preview()):hold&&lane==='account'?new Promise(resolve=>{held=resolve;}):response({accounts:[account()],nextCursor:null}));
  await h.api.load();h.api.draft();hold=true;const old=lane==='account'?h.api.accounts():h.api.preview();await settle();denyInbox=true;await h.api.inbox();expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().preview).toBeNull();
  denyInbox=false;await h.api.inbox();held!(new Response(JSON.stringify(lane==='account'?{accounts:[account()],nextCursor:null}:preview())));await old;
  expect(h.api.state().accounts).toHaveLength(0);expect(h.api.state().preview).toBeNull();expect(h.api.state().approvals).toHaveLength(1);expect(h.get('trust-post').disabled).toBe(true);
 }
});

test('V2 input while inbox is held releases owned recovery controls after success or denial and refresh works',async()=>{
 for(const status of [200,403]){
  let held:((r:Response)=>void)|undefined,hold=true;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?hold?new Promise(resolve=>{held=resolve;}):response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
  const loading=h.api.load();await settle();expect(h.get('trust-reason').disabled).toBe(false);h.api.draft();await h.api.edit();held!(new Response(JSON.stringify(status===200?{approvals:[approval()],nextCursor:null}:{status:403,type:'auth/scope_missing'}),{status}));await loading;
  expect(h.get('trust-refresh').disabled).toBe(false);expect(h.get('trust-inbox-refresh').disabled).toBe(false);expect(h.get('trust-workbench').getAttribute('aria-busy')).toBe('false');expect(h.api.state().approvals).toHaveLength(status===200?1:0);
  if(status===403)expect(h.api.state().accounts).toHaveLength(0);hold=false;await h.api.load();expect(h.api.state().accounts).toHaveLength(1);expect(h.api.state().approvals).toHaveLength(1);
 }
});

test('V2 obsolete full-refresh and inbox finalizers cannot unlock a newer pending owner',async()=>{
 for(const lane of ['full','inbox'])for(const oldStatus of [200,403]){
  const pending:((r:Response)=>void)[]=[];let hold=false;
  const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('approval-requests')?hold?new Promise(resolve=>{pending.push(resolve);}):response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
  await h.api.load();hold=true;const old=lane==='full'?h.api.load():h.api.inbox();await settle();const newer=lane==='full'?h.api.load():h.api.inbox();await settle();expect(pending).toHaveLength(2);
  pending[0]!(new Response(JSON.stringify(oldStatus===200?{approvals:[approval()],nextCursor:null}:{status:403,type:'auth/scope_missing'}),{status:oldStatus}));await old;
  expect(h.get('trust-inbox-refresh').disabled).toBe(true);
  if(lane==='full'){expect(h.get('trust-refresh').disabled).toBe(true);expect(h.get('trust-workbench').getAttribute('aria-busy')).toBe('true');}
  expect(h.api.state().approvals).toHaveLength(0);pending[1]!(new Response(JSON.stringify({approvals:[approval()],nextCursor:null})));await newer;
  expect(h.get('trust-inbox-refresh').disabled).toBe(false);expect(h.get('trust-refresh').disabled).toBe(false);expect(h.get('trust-workbench').getAttribute('aria-busy')).toBe('false');expect(h.api.state().approvals).toHaveLength(1);
 }
});

test('V2 obsolete preview finalizers cannot enable a newer pending preview; edit then restore still rejects old evidence',async()=>{
 let hold=false;const pending:((r:Response)=>void)[]=[];
 const h=harness(path=>path==='/api/v1/me/properties'?response({properties:[{id:property}]}):path.includes('/preview')?hold?new Promise(resolve=>{pending.push(resolve);}):response(preview()):path.includes('approval-requests')?response({approvals:[approval()],nextCursor:null}):response({accounts:[account()],nextCursor:null}));
 await h.api.load();h.api.draft();hold=true;const old=h.api.preview();await settle();const newer=h.api.preview();await settle();pending[0]!(new Response(JSON.stringify(preview())));await old;expect(h.get('trust-preview-action').disabled).toBe(true);expect(h.api.state().preview).toBeNull();
 pending[1]!(new Response(JSON.stringify(preview())));await newer;expect(h.api.state().preview).not.toBeNull();expect(h.get('trust-preview-action').disabled).toBe(false);
 const restored=h.api.preview();await settle();await h.api.edit();h.api.draft();pending[2]!(new Response(JSON.stringify(preview())));await restored;expect(h.api.state().preview).toBeNull();expect(h.get('trust-post').disabled).toBe(true);
});
