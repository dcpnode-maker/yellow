export default function createHostedDepositWorkbench(host) {
 "use strict";
 const [read, request, renderStatement] = host;
 if (!document.querySelector('link[href="/assets/operator-deposits.css"]')) {
  const style = document.createElement("link"); style.rel = "stylesheet"; style.href = "/assets/operator-deposits.css"; document.head.append(style);
 }
 const panel = document.querySelector("#folio-deposit-panel");
 panel.setAttribute("role","tabpanel"); panel.setAttribute("aria-labelledby","folio-tab-deposit");
 const markup = `<div class="folio-deposit-workbench"><form class="folio-charge-form" id="folio-deposit-create-form"><fieldset id="folio-deposit-create-fields"><legend>Create a secure deposit link</legend><p class="field-note">Use an existing tokenized instrument ID. No card, bank or VPA details belong here.</p><label>Tokenized instrument ID<input id="folio-deposit-instrument" name="instrumentId" required maxlength="36" autocomplete="off"></label><label>Requested amount (minor units)<input id="folio-deposit-amount" name="amountMinor" required inputmode="numeric" pattern="[1-9][0-9]*" maxlength="19" autocomplete="off"></label><label class="folio-charge-confirmation"><input id="folio-deposit-create-confirm" type="checkbox"> Create a 24-hour link and revoke the older active link.</label><button class="primary" id="folio-deposit-create-submit" type="submit" disabled>Create deposit link</button><p class="form-message" role="status" aria-live="assertive"></p></fieldset></form><section class="folio-deposit-result" id="folio-deposit-result" hidden aria-labelledby="folio-deposit-result-title"><div class="folio-workspace-head"><div><p class="eyebrow">Server payment truth</p><h4 id="folio-deposit-result-title">Hosted deposit</h4></div><button class="quiet" id="folio-deposit-refresh" type="button">Refresh status</button></div><dl class="folio-deposit-status"><div><dt>Request</dt><dd id="folio-deposit-request">—</dd></div><div><dt>Status</dt><dd id="folio-deposit-status">—</dd></div><div><dt>Requested</dt><dd id="folio-deposit-requested">—</dd></div><div><dt>Captured</dt><dd id="folio-deposit-captured">—</dd></div><div><dt>Applied</dt><dd id="folio-deposit-applied">—</dd></div><div><dt>Remaining</dt><dd id="folio-deposit-remaining">—</dd></div></dl><div class="folio-deposit-link" id="folio-deposit-link-row" hidden><a id="folio-deposit-link" rel="noreferrer" target="_blank">Open guest deposit page</a><button class="quiet" id="folio-deposit-copy" type="button">Copy link</button></div><form class="folio-charge-form" id="folio-deposit-apply-form"><fieldset id="folio-deposit-apply-fields" disabled><legend>Apply captured deposit liability</legend><p class="field-note">The server caps application by captured remainder and positive folio balance.</p><label>Amount to apply (minor units)<input id="folio-deposit-apply-amount" name="amountMinor" required inputmode="numeric" pattern="[1-9][0-9]*" maxlength="19" autocomplete="off"></label><label class="folio-charge-confirmation"><input id="folio-deposit-apply-confirm" type="checkbox"> Append one immutable balanced liability-to-folio journal.</label><button class="primary" id="folio-deposit-apply-submit" type="submit" disabled>Apply deposit</button><p class="form-message" role="status" aria-live="assertive"></p></fieldset></form></section></div>`;
 panel.replaceChildren(...new DOMParser().parseFromString(markup, "text/html").body.childNodes);
 const $ = (selector) => panel.querySelector(selector);
 const createForm = $("#folio-deposit-create-form"), createFields = $("#folio-deposit-create-fields");
 const createConfirm = $("#folio-deposit-create-confirm"), createSubmit = $("#folio-deposit-create-submit");
 const result = $("#folio-deposit-result"), refresh = $("#folio-deposit-refresh"), requestIdCell = $("#folio-deposit-request");
 const statusCell = $("#folio-deposit-status"), requested = $("#folio-deposit-requested"), captured = $("#folio-deposit-captured");
 const applied = $("#folio-deposit-applied"), remaining = $("#folio-deposit-remaining"), linkRow = $("#folio-deposit-link-row");
 const link = $("#folio-deposit-link"), copy = $("#folio-deposit-copy"), applyForm = $("#folio-deposit-apply-form");
 const applyFields = $("#folio-deposit-apply-fields"), applyConfirm = $("#folio-deposit-apply-confirm"), applySubmit = $("#folio-deposit-apply-submit");
 let createKey = "", createDraft = "", applyKey = "", applyDraft = "", requestId = "", linkValue = "";
 const context = () => { const [generation, property, identity, folio] = read(); return { generation, property, identity, folio }; };
 const current = (origin) => { const now = context(); return !panel.hidden && !panel.closest("#folio-workspace").hidden && now.generation === origin.generation && now.property === origin.property && now.identity === origin.identity && now.folio?.folio.id === origin.folio.folio.id; };
 const exactMinor = (value, label) => { if (typeof value !== "string" || !/^-?(?:0|[1-9][0-9]*)$/.test(value)) throw new Error(`Server returned an invalid exact ${label}.`); return value; };
 const message = (form, value, error = false) => { const target = form.querySelector(".form-message"); target.textContent = value; target.classList.toggle("error", error); };
 const notify = (value) => { const target = document.querySelector("#operation-status"); target.textContent = ""; requestAnimationFrame(() => { target.textContent = value; }); };
 const sync = () => { createSubmit.disabled = createFields.disabled || !createConfirm.checked; applySubmit.disabled = applyFields.disabled || !applyConfirm.checked; };
 const dirty = () => createForm.elements.instrumentId.value !== "" || createForm.elements.amountMinor.value !== "" || createConfirm.checked || applyForm.elements.amountMinor.value !== "" || applyConfirm.checked;
 function reset() {
  createForm.reset(); applyForm.reset(); createKey = createDraft = applyKey = applyDraft = requestId = linkValue = "";
  result.hidden = linkRow.hidden = true; link.removeAttribute("href"); createFields.disabled = false; applyFields.disabled = true; sync();
 }
 function render(status) {
  const currentContext = context();
  if (!status || status.requestId !== requestId || status.folioId !== currentContext.folio?.folio.id) throw new Error("The server returned a different hosted deposit.");
  result.hidden = false; requestIdCell.textContent = status.requestId; statusCell.textContent = status.state;
  for (const [target, value, label] of [[requested,status.amountMinor,"request"],[captured,status.capturedMinor,"capture"],[applied,status.appliedMinor,"application"],[remaining,status.remainingMinor,"remainder"]]) target.textContent = `${status.currency} ${exactMinor(value, `deposit ${label}`)}`;
  applyFields.disabled = !(status.state === "captured" && BigInt(status.remainingMinor) > 0n && BigInt(currentContext.folio.balanceMinor) > 0n); sync();
 }
 async function refreshStatus(announce = true) {
  if (!requestId) return;
  const origin = context(); refresh.disabled = true;
  try {
   const status = await request(`/api/v1/properties/${encodeURIComponent(origin.property)}/hosted-deposits/${encodeURIComponent(requestId)}`);
   if (!current(origin)) return; render(status); if (announce) notify(`Deposit status refreshed: ${status.state}.`);
  } catch (error) { if (current(origin)) message(applyForm, error instanceof Error ? error.message : "Deposit status could not be refreshed", true); }
  finally { if (current(origin)) refresh.disabled = false; }
 }
 async function create() {
  const origin = context(); if (!origin.folio || !createConfirm.checked) return;
  const body = { instrumentId: createForm.elements.instrumentId.value.trim(), amountMinor: createForm.elements.amountMinor.value.trim() }, draft = JSON.stringify(body);
  if (draft !== createDraft) { createDraft = draft; createKey = crypto.randomUUID(); } createFields.disabled = true;
  try {
   const created = await request(`/api/v1/properties/${encodeURIComponent(origin.property)}/folios/${encodeURIComponent(origin.folio.folio.id)}/hosted-deposits`, { method:"POST", headers:{"idempotency-key":createKey}, body:JSON.stringify(body) });
   if (!current(origin)) return; requestId = created.requestId; linkValue = typeof created.bearer === "string" ? `${location.origin}/pay/${encodeURIComponent(created.bearer)}` : "";
   if (linkValue) link.href = linkValue; else link.removeAttribute("href"); linkRow.hidden = !linkValue; createKey = createDraft = ""; createForm.reset(); await refreshStatus(false);
   message(createForm, created.replayed ? "Existing request confirmed; its one-time link is not returned again." : "Link created. Copy it now; Yellow will not return it again.");
  } catch (error) { if (current(origin)) { createFields.disabled = false; message(createForm, `${error instanceof Error ? error.message : "Link could not be created"}. Retry keeps the same idempotency key.`, true); } }
  finally { if (current(origin)) sync(); }
 }
 async function applyDeposit() {
  const origin = context(); if (!origin.folio || !requestId || !applyConfirm.checked) return;
  const body = { amountMinor: applyForm.elements.amountMinor.value.trim() }, draft = JSON.stringify(body);
  if (draft !== applyDraft) { applyDraft = draft; applyKey = crypto.randomUUID(); } applyFields.disabled = true;
  try {
   const outcome = await request(`/api/v1/properties/${encodeURIComponent(origin.property)}/hosted-deposits/${encodeURIComponent(requestId)}/applications`, { method:"POST", headers:{"idempotency-key":applyKey}, body:JSON.stringify(body) });
   if (!current(origin)) return; const statement = await request(`/api/v1/properties/${encodeURIComponent(origin.property)}/folios/${encodeURIComponent(origin.folio.folio.id)}/statement?limit=50`);
   if (!current(origin) || statement.folio.id !== origin.folio.folio.id) return; applyKey = applyDraft = ""; applyForm.reset(); renderStatement(statement); await refreshStatus(false);
   message(applyForm, outcome.replayed ? "Existing application confirmed; server truth refreshed." : "Deposit applied; server truth refreshed.");
  } catch (error) { if (current(origin)) { applyFields.disabled = false; message(applyForm, `${error instanceof Error ? error.message : "Deposit could not be applied"}. Retry keeps the same idempotency key.`, true); } }
  finally { if (current(origin)) sync(); }
 }
 createForm.addEventListener("input", () => { const draft = JSON.stringify({instrumentId:createForm.elements.instrumentId.value.trim(),amountMinor:createForm.elements.amountMinor.value.trim()}); if (createDraft && draft !== createDraft) createKey = createDraft = ""; sync(); });
 createConfirm.addEventListener("change", sync); createForm.addEventListener("submit", (event) => { event.preventDefault(); void create(); });
 refresh.addEventListener("click", () => void refreshStatus());
 copy.addEventListener("click", async () => { if (!linkValue) return; try { await navigator.clipboard.writeText(linkValue); notify("Deposit link copied."); } catch { link.focus(); notify("Copy unavailable; use the visible link."); } });
 applyForm.addEventListener("input", () => { const draft = JSON.stringify({amountMinor:applyForm.elements.amountMinor.value.trim()}); if (applyDraft && draft !== applyDraft) applyKey = applyDraft = ""; sync(); });
 applyConfirm.addEventListener("change", sync); applyForm.addEventListener("submit", (event) => { event.preventDefault(); void applyDeposit(); });
 return Object.freeze({ d: dirty, r: reset, s: (g=context().generation) => g===context().generation&&!panel.hidden&&!panel.closest("#folio-workspace").hidden ? sync() : reset() });
}
