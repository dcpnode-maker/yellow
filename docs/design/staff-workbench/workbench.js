'use strict';
// Fictional, in-memory interaction study. No fetch, storage, real identity or domain authority.
const departments = [
  ['fo', 'Front office', 'Give every guest a clear next step, from arrival to departure.'],
  ['reservations', 'Reservations', 'Prepare the stay before the guest reaches the desk.'],
  ['hk', 'Housekeeping', 'Prioritize the right room, then make readiness visible.'],
  ['engineering', 'Engineering', 'Resolve faults with safe entry, test evidence and a clear return to service.'],
  ['concierge', 'Bell & concierge', 'Coordinate transport, luggage and the moments between departments.'],
  ['security', 'Security', 'Keep access decisions and incident detail in the right hands.'],
  ['sales', 'Sales & groups', 'Keep the guest promise, allocation and commercial terms connected.'],
  ['banquets', 'Banquets', 'Work from the current event brief and acknowledge what changed.'],
  ['fnb', 'Food & beverage', 'Keep service moving while every charge finds the correct account.'],
  ['kitchen', 'Kitchen', 'Turn the approved menu and count into a dependable service.'],
  ['spa', 'Spa & wellness', 'Coordinate the guest, practitioner, room and service prerequisites.'],
  ['stores', 'Purchasing & stores', 'Make shortages, partial deliveries and approvals visible early.'],
  ['finance', 'Finance & night audit', 'Resolve the source exception and preserve the financial trail.'],
  ['revenue', 'Revenue', 'Review demand and inventory evidence before changing a commercial promise.'],
  ['duty', 'Duty manager', 'Own the exceptions that need more than one team.'],
  ['str', 'STR & owners', 'Connect turnover, access readiness and owner responsibilities.'],
];
const team = id => departments.find(d => d[0] === id)?.[1] ?? 'Unassigned';
const step = (owner, title, copy, action, checks, receipt, role) => ({owner, title, copy, action, checks, receipt, role});
const cases = [
  {id:'YC-01', title:'An early arrival needs a ready room', subject:'Mira Shah · Room 412', roomSubject:'Room 412 · Early arrival', context:'2 adults · Deluxe king · 5–8 Sep', area:'Arrival', due:'By 14:00', priority:'Guest waiting', tone:'urgent', teams:['fo','hk','concierge','reservations','duty'], promise:'Acknowledge the wait and agree the next update. An estimated ready time is not a room-ready promise.', evidence:['Reservation HH-20451 is assigned to 412.','Fictional property policy requires supervisor inspection.','FO owns communication with the guest throughout.'], steps:[
    step('fo','Ask housekeeping for a ready time','The guest is at reception. Room 412 is assigned but dirty. Keep arrival blocked and request preparation with an agreed update time.','Request room preparation',['Guest has an agreed update at 13:50','Room 412 is the intended room'], 'FO requested preparation; HK acknowledgement is pending.'),
    step('hk','Accept the arrival handoff','FO needs an update by 13:50. Accept ownership before starting; the guest-facing promise remains with FO.','Accept HK handoff',['Room 412 and arrival priority reviewed'], 'Housekeeping accepted the request and owns the next step.'),
    step('hk','Complete cleaning, then request inspection','Cleaning completion and inspection are separate. This action records only the cleaning stage of the fictional case.','Record cleaning complete',['Correct room and safe-entry instruction checked','Cleaning checklist completed'], 'Cleaning complete; supervisor inspection is still required.','Room attendant'),
    step('hk','Inspect room 412','The room is clean. The supervisor checks the configured inspection requirements before returning readiness evidence to FO.','Pass inspection',['Supervisor inspection checklist passed'], 'Inspection passed; a room-ready handoff is waiting for FO.','HK supervisor'),
    step('fo','Acknowledge the room-ready handoff','Housekeeping has supplied inspection evidence. Check the current reservation and room facts before making a new guest promise.','Acknowledge room ready',['Latest room and reservation evidence reviewed'], 'FO acknowledged inspection evidence and is reviewing arrival.'),
    step('fo','Finish the arrival review','The design now shows a clear last step: exact guest, room, required checks and a fresh readiness result. The real app must revalidate these on the server.','Complete arrival review',['Exact booking, room and guest confirmed','Required identity and payment readiness reviewed'], 'Arrival review completed in the simulation; no booking or key was changed.'),
  ]},
  {id:'YC-02', title:'Room observation conflicts with the stay', subject:'Room 307 · Occupancy discrepancy', context:'In-house record · HK observed vacant', area:'Room discrepancy', due:'Now', priority:'Investigate', tone:'blocked', teams:['hk','fo','duty','security'], promise:'Investigate discreetly. An observation must not release a room or cancel a stay.', evidence:['PMS stay and physical observation are separate facts.','Use authorized reservation commands only after resolution.'], steps:[
    step('hk','Send the discrepancy for investigation','Record the observation without changing the reservation or selling the room.','Report discrepancy',['Room and observation confirmed'], 'HK observation retained; FO investigation requested.'),
    step('fo','Accept and investigate','Confirm the guest situation through the property procedure. Do not infer checkout from a vacant observation.','Accept investigation',['Discrepancy and current stay reviewed'], 'FO accepted investigation; duty manager review requested.'),
    step('duty','Record an owned resolution plan','The case review ends with an accountable plan. Occupancy changes need a separate governed command.','Complete resolution review',['Owner and next guest contact recorded'], 'Resolution plan recorded; occupancy remains unchanged in this study.'),
  ]},
  {id:'YC-03', title:'An in-house room needs a repair decision', subject:'Room 814 · Cooling fault', context:'Guest in house · Repair time uncertain', area:'Service recovery', due:'Update 14:10', priority:'Guest impact', tone:'urgent', teams:['engineering','fo','hk','duty'], promise:'Give the guest one coordinator and an honest repair or room-move choice.', evidence:['Repair, inventory restriction and HK readiness are independent.','A room move needs fresh occupancy and price checks.'], steps:[
    step('engineering','Accept the fault and assess safe entry','Coordinate entry through FO. A fault report is not permission to enter an occupied room.','Accept repair assessment',['Entry coordination and room confirmed'], 'Engineering accepted; diagnosis is in progress.'),
    step('engineering','Hand over the repair assessment','This scenario requires overnight repair. Give FO the effect and the expected next update.','Send assessment to FO',['Diagnosis and expected completion reviewed'], 'Engineering recommends an overnight repair; FO owns guest options.'),
    step('fo','Review the guest’s room-move options','Present an eligible alternative and any price or accessibility impact. The prototype does not claim a new room.','Complete service-recovery review',['Alternative and guest communication reviewed'], 'Room-move proposal reviewed; a governed occupancy command remains required.'),
  ]},
  {id:'YC-04', title:'Airport pickup has no driver acknowledgement', subject:'Arrival HH-20477 · Airport pickup', context:'Recorded pickup 23:40 · Schedule unverified', area:'Transport', due:'Confirm 14:15', priority:'Needs owner', tone:'urgent', teams:['concierge','fo','duty'], promise:'Confirm who will meet the guest; never infer flight arrival from the booking schedule.', evidence:['Scheduled time is not live flight evidence.','Only the assigned transport role should access necessary contact details.'], steps:[
    step('concierge','Own the pickup follow-up','Assign a transport owner and verify the pickup arrangement through an approved channel.','Accept pickup follow-up',['Recorded schedule and contact responsibility reviewed'], 'Concierge accepted the unacknowledged pickup.'),
    step('concierge','Send the confirmed arrangement to FO','A named owner and next update are now visible. No external message is sent by this prototype.','Prepare FO handoff',['Pickup owner and next update confirmed'], 'FO has a transport handoff awaiting acknowledgement.'),
    step('fo','Acknowledge the arrival plan','The booking now has a coordinated pickup plan without exposing contact information on the shared queue.','Complete pickup review',['Latest arrangement reviewed'], 'FO acknowledged the fictional pickup plan.'),
  ]},
  {id:'YC-05', title:'DND prevents routine service', subject:'Room 228 · Service access needed', context:'Do not disturb · Non-emergency tap leak', area:'Guest preference', due:'Contact 14:20', priority:'Access blocked', tone:'blocked', teams:['hk','engineering','fo'], promise:'Respect the recorded service preference and arrange an appropriate return time.', evidence:['DND does not mean the task is completed.','Emergency entry rules are separately configured property procedures.'], steps:[
    step('hk','Ask FO to coordinate a service window','Keep the work blocked by access. Starting a task does not grant entry.','Request guest coordination',['DND and non-emergency classification reviewed'], 'FO owns the request for an agreed service window.'),
    step('fo','Acknowledge the access request','Coordinate a suitable window without removing DND merely to clear the queue.','Complete access-plan review',['Guest contact owner and next attempt reviewed'], 'Service-window plan recorded; no room entry authorized by the prototype.'),
  ]},
  {id:'YC-06', title:'A replacement key needs verification', subject:'Room 206 · Access request', context:'Verification incomplete · Restricted case', area:'Access', due:'Now', priority:'Verification needed', tone:'blocked', teams:['fo','security','duty'], promise:'Help the person safely without exposing stored identity details or bypassing verification.', evidence:['A manager note cannot issue an access credential.','Incident narrative belongs in a restricted record.'], steps:[
    step('fo','Request a verification review','Only a minimized case reference goes to the designated security role.','Request security review',['Verification blocker and case reference reviewed'], 'Security acknowledgement requested; no key issued.'),
    step('security','Accept the restricted case','Use the property verification procedure. This study shows status, not identity documents.','Complete verification-path review',['Authorized verifier and next action identified'], 'Verification route reviewed; credential issuance remains a separate action.'),
  ]},
  {id:'YC-09', title:'The wedding brief changed after sign-off', subject:'Mehta reception · Ballroom', context:'BEO v4 · 95 guests · Previously 80', area:'Event revision', due:'Before 16:00', priority:'Re-acknowledge', tone:'urgent', teams:['sales','banquets','kitchen','stores','finance'], promise:'Deliver the latest agreed event; show the change before any department works from an old brief.', evidence:['Version 4 adds 15 guests; menu and service time are unchanged.','Version 3 remains historical; its acknowledgement does not cover version 4.','AV is unaffected and keeps its prior acknowledgement.'], steps:[
    step('banquets','Acknowledge BEO version 4','The count changed from 80 to 95 after the earlier acceptance. Check setup and staffing impact.','Acknowledge banquet revision',['Version 4 and +15 guest delta reviewed'], 'Banquets acknowledged BEO v4; kitchen acknowledgement remains.'),
    step('kitchen','Acknowledge the production change','Review 95 meals and the unchanged service time. Acknowledging this brief does not consume stock.','Acknowledge kitchen revision',['Menu quantities and dietary instructions reviewed'], 'Kitchen acknowledged BEO v4; stores acknowledgement remains.'),
    step('stores','Confirm supply against the revised brief','Confirm availability or raise an owned shortage before the event team relies on the updated quantity.','Acknowledge stores revision',['Revised supply demand reviewed'], 'All affected departments acknowledged BEO v4 in this simulation.'),
  ]},
  {id:'YC-10', title:'A corporate stay needs clear payer routing', subject:'Northstar training · Group HH-G18', context:'Company: rooms + lunch · Personal: extras', area:'Group billing', due:'Before pickup', priority:'Review terms', tone:'normal', teams:['sales','reservations','fo','finance','spa','fnb','revenue'], promise:'Keep the agreed company coverage clear before guests consume personal services.', evidence:['Contract quantities are separate from deducting inventory.','Company and personal folio windows do not automatically define legal invoices.'], steps:[
    step('sales','Hand over the current commercial scope','Identify the contract version, included services and rooming-list deadline.','Send routing brief',['Company inclusions and personal exclusions reviewed'], 'Finance has a versioned routing brief to acknowledge.'),
    step('finance','Review payer and posting scope','Company coverage is rooms and lunch. Spa and alcohol stay personal unless an approved change says otherwise.','Complete payer-routing review',['Company and personal routing separated','Invoice buyer and currency reviewed'], 'Payer-routing review completed; no financial posting occurred.'),
  ]},
  {id:'YC-11', title:'A restaurant room charge has an unknown result', subject:'Restaurant check 1842 · Room 412', roomSubject:'Check 1842 · Room-charge enquiry', context:'INR 2,450.00 · Two matching resident accounts', area:'Outlet posting', due:'Resolve now', priority:'Outcome unknown', tone:'blocked', teams:['fnb','fo','finance'], promise:'Keep the check open until its exact target and posting outcome are known.', evidence:['Room number alone does not identify the payer.','Retry must retain the original request identity.','A timeout is not a payment or posting receipt.'], steps:[
    step('fnb','Resolve the exact target and request identity','Review the selected resident account. Ask finance to inspect the original request rather than creating another charge.','Request posting reconciliation',['Exact account identified','Original request identity retained'], 'Finance owns reconciliation of check 1842; check remains unsettled.'),
    step('finance','Review the original posting outcome','The fictional example returns one existing posting receipt. A real interface must read back the authoritative outcome.','Complete reconciliation review',['Original receipt matches amount, check and target'], 'One fictional receipt reconciled; duplicate posting was not proposed.'),
  ]},
  {id:'YC-13', title:'A spa booking has one missing prerequisite', subject:'Appointment S-204 · Couples treatment', context:'Two providers · One room · 15:00', area:'Spa appointment', due:'Before service', priority:'Form incomplete', tone:'urgent', teams:['spa','fo','finance'], promise:'Offer a coordinated service while keeping private answers out of shared schedules.', evidence:['Provider, room, equipment and buffers need availability checks.','The schedule shows form status only, not sensitive answers.','Service completion and room-charge settlement are distinct.'], steps:[
    step('spa','Resolve the configured prerequisite','This fictional property requires one outstanding form. Follow the configured workflow; the schedule never exposes its answers.','Review service prerequisites',['Required form status resolved','Provider, room and equipment reviewed'], 'Service prerequisites reviewed; exact payer selection remains.'),
    step('spa','Review fulfilment and payer separately','Confirm the guest and permitted payer for each service. Completion must not silently settle an invoice.','Complete spa-flow review',['Service outcome and exact payer reviewed'], 'Spa journey reviewed; no appointment or charge was changed.'),
  ]},
  {id:'YC-14', title:'An event ingredient is short', subject:'Banquet menu · BEO v4', context:'110 meals · 90 ingredient units available', area:'Supply exception', due:'Before production', priority:'Substitute needed', tone:'urgent', teams:['stores','kitchen','sales','banquets','finance'], promise:'Approve any substitution and its guest or commercial effect before production.', evidence:['Expected, guaranteed, actual and billed counts remain separate.','A substitute must preserve the configured dietary requirements.'], steps:[
    step('stores','Raise the quantity exception','Name the short item, unit and available quantity. The kitchen owns the response.','Send shortage handoff',['Quantity, unit and source reviewed'], 'Kitchen has an owned ingredient exception.'),
    step('kitchen','Prepare the permitted substitution','Review service requirements and obtain the configured approval. Never silently alter a dietary instruction.','Complete substitution review',['Substitute and approval requirement reviewed'], 'Substitution proposal reviewed; production and stock remain unchanged.'),
  ]},
  {id:'YC-15', title:'A supplier delivery is incomplete', subject:'PO 88017 · Stores receiving', context:'100 bottles ordered · 80 delivered', area:'Receiving', due:'Before booking receipt', priority:'Quantity variance', tone:'normal', teams:['stores','finance'], promise:'Record what arrived and keep the outstanding quantity visible.', evidence:['Receipt booking and invoice payment are different events.','Repeated receipt submission must not increase stock twice.'], steps:[
    step('stores','Review the partial delivery','Record delivered quantity and the unit-cost variance; apply the configured approval rule.','Prepare receipt review',['80 delivered and 20 outstanding reviewed','Cost variance and approval reviewed'], 'Finance has a partial-delivery exception to acknowledge.'),
    step('finance','Acknowledge the invoice exception','Keep the remaining order open unless an authorized decision closes it.','Complete receiving review',['Invoice mismatch and remaining quantity reviewed'], 'Receiving review complete; no stock or liability was posted.'),
  ]},
  {id:'YC-16', title:'Night audit has unresolved sources', subject:'Business day 5 Sep · Close preparation', context:'Outlet outcome · Event actuals · Cashier session', area:'Day close', due:'Before seal', priority:'Close blocked', tone:'blocked', teams:['finance','fnb','banquets','duty'], promise:'Every unresolved financial effect has an owner before the day is sealed.', evidence:['Opening the next operating day is not sealing the prior day.','Carry-forward requires explicit authority and linked evidence.','Sealed records are corrected through new linked records.'], steps:[
    step('finance','Assign the close blockers','Keep each source and its business date visible. This review assigns the outlet item to its owner.','Send outlet exception',['Target business date and source reviewed'], 'F&B owns the outlet close exception.'),
    step('fnb','Acknowledge the outlet exception','Investigate the original check and report its authoritative receipt to finance.','Acknowledge close exception',['Original check and outcome evidence reviewed'], 'F&B acknowledged; finance owns the next close review.'),
    step('finance','Review the remaining close requirements','One resolved source does not make the whole day ready. Show the event and cashier blockers explicitly.','Complete close-path review',['Event actuals and cashier blockers remain visible'], 'Close-path review complete; the business day has not been sealed.'),
  ]},
  {id:'YC-08', title:'A late checkout compresses a turnover', subject:'Harbour apartment 3 · STR turnover', context:'Departure 13:30 · Arrival 16:00', area:'STR operations', due:'Update 14:00', priority:'Timing risk', tone:'urgent', teams:['str','hk','engineering','finance'], promise:'Keep the arriving guest updated without treating an access code as readiness evidence.', evidence:['Listing, physical unit and turnover window stay linked.','Owner expense approval is separate from guest billing.','No smart-lock integration is assumed.'], steps:[
    step('str','Agree the turnover handoff','Verify departure and coordinate the revised service window with housekeeping.','Request turnover acknowledgement',['Unit and revised service window reviewed'], 'Housekeeping has a turnover handoff.'),
    step('hk','Accept the revised turnover','Report an estimate separately from completion and inspection.','Accept turnover plan',['Service timing and required tasks reviewed'], 'HK accepted; STR operator owns guest communication.'),
    step('str','Review arrival and owner follow-up','Check readiness, guest communication and any separately governed owner expense.','Complete turnover review',['Guest update and owner responsibility reviewed'], 'Turnover plan reviewed; no access credential or expense was created.'),
  ]},
];
const journey = [
  ['01','Before arrival','A confirmation becomes a prepared stay.','Reservations resolves dates, source changes, travel, accessibility and payer scope. FO receives only unresolved arrival work.','Reservations → FO','Current booking revision, due time and accepting owner.','YC-10'],
  ['02','At the hotel entrance','The guest is expected, not passed between teams.','Bell, transport and security coordinate movement and access using the minimum necessary context.','Concierge → FO','Pickup or luggage outcome; schedule is not proof of arrival.','YC-04'],
  ['03','Reception and room readiness','A short conversation, with the blockers already visible.','Resolve the exact reservation. Keep occupancy, cleaning, inspection, DND and inventory restriction distinct.','FO ↔ Housekeeping','An acknowledged request, inspection evidence and fresh readiness.','YC-01'],
  ['04','During the stay','Every request has a clear owner and a next update.','Coordinate repairs, preferences, dining and spa without exposing the full guest record to every team.','Service team → Guest coordinator','Accepted request, service outcome and guest follow-up.','YC-03'],
  ['05','An event or shared experience','Every department works from the current promise.','Sales, banquets, kitchen and stores acknowledge the exact revision and record actual delivery separately from billing.','Sales → Operations → Finance','Version-specific acknowledgements and actualization.','YC-09'],
  ['06','Departure and settlement','Show what is due, who pays and what happens next.','Resolve folio and interface exceptions; authorized checkout triggers owned operational follow-up. A task alone never releases occupancy.','FO / Finance → HK / Bell','Financial and checkout receipts plus acknowledged tasks.','YC-11'],
  ['07','The next shift and business day','Nothing important disappears at midnight.','Hand over aged work and unsealed-day blockers. Opening the next operating day is separate from sealing an earlier one.','Outgoing owner → Incoming owner','Acknowledgement, business date and authorized carry where allowed.','YC-16'],
  ['08','After the stay','Follow-up closes the guest loop.','Resolve lost property, complaints, permitted communications and owner matters with purpose-limited access.','Guest coordinator → Responsible team','Outcome and guest follow-up, with retention under property policy.','YC-08'],
];
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const departmentIcons = ['bell','calendar-blank','broom','briefcase','handshake','identification-card','briefcase','confetti','fork-knife','cooking-pot','flower-lotus','house-line','identification-card','chart-line-up','briefcase','house-line'];
const skins = new Set(['calm','precision','timeline']);
// Cosmetic only: never re-render a form, change its command identity or perform a request.
function applySkin(value) {
  const skin = skins.has(value) ? value : 'calm';
  document.documentElement.dataset.skin = skin;
  $('skin-select').value = skin;
}
const maySeeGuestProfile = () => ['fo','reservations','concierge','fnb','finance','duty'].includes(state.department);
function profileCard(kind, compact = false) {
  const guest = kind === 'guest';
  return `<article class="profile-card${compact?' rail-profile':''}" aria-label="${guest?'Mira Shah, fictional guest profile':'Aditi Rao, fictional staff profile'}"><img class="profile-photo" src="assets/${guest?'guest-mira':'staff-aditi'}.png" alt="Fictional portrait of ${guest?'Mira Shah':'Aditi Rao'}" width="1024" height="1536"><span class="profile-kind">${guest?'GUEST PROFILE':'TEAM PROFILE'}</span><div class="profile-content"><p class="profile-id">${guest?'G-20451':'HH-STAFF-014'}</p><h3>${guest?'Mira Shah':'Aditi Rao'}</h3><p class="profile-description">${guest?'A considered stay, from the first welcome.':'Duty manager. Here for the details that make a difference.'}</p><div class="profile-bottom"><span><img src="assets/${guest?'calendar-blank':'clock'}.svg" alt="" width="16" height="16">${guest?'5–8 Sep':'On duty'}</span><button class="profile-action" ${compact?'data-profile="staff"':guest?'data-explore="YC-01"':'data-profile-shift="duty"'}>${compact?'View profile':guest?'View stay':'View shift'}<img src="assets/arrow-up-right.svg" alt="" width="17" height="17"></button></div></div></article>`;
}
function renderProfiles() {
  const guest = maySeeGuestProfile();
  $('profiles-view').innerHTML = `<div class="section-intro"><p class="eyebrow">PEOPLE / IDENTITY</p><h2 id="profiles-heading">A familiar face. The right context.</h2><p>Guest and team profiles, with the details that belong to your role. These people and user IDs are fictional.</p></div><div class="profiles-grid">${guest?profileCard('guest'):''}${profileCard('staff')}<section class="profile-context"><p class="eyebrow">${guest?'THE CURRENT STAY':'TEAM CONTEXT'}</p><h3>${guest?'Welcome, Mira.':'Aditi Rao'}</h3><p>${guest?'A room is only part of the welcome. Keep arrival, preparation and guest communication connected.':'The duty manager coordinates exceptions across the hotel. A role label is context; production actions still require server authorization.'}</p><dl><div><dt>${guest?'Reservation':'User ID'}</dt><dd>${guest?'HH-20451':'HH-STAFF-014'}</dd></div><div><dt>${guest?'Room / category':'Role'}</dt><dd>${guest?'412 / Deluxe king':'Duty manager'}</dd></div><div><dt>${guest?'Stay':'Shift'}</dt><dd>${guest?'5–8 Sep 2026 · 2 adults':'Afternoon · Harbour House'}</dd></div><div><dt>Property</dt><dd>Harbour House, Mumbai</dd></div></dl><div class="handoff-note">${guest?'A room assignment does not establish room readiness. Open the stay to review the current preparation and inspection evidence.':'This department view keeps guest profile details out of the visible interface.'}</div><button class="secondary" ${guest?'data-explore="YC-01"':'data-profile-shift="duty"'}>${guest?'Continue arrival review':'Open the duty manager queue'}</button></section></div>`;
}
let state = {department:'fo', view:'shift', filter:'all', search:'', selected:'YC-01', detailOpen:false};
const progress = new Map(cases.map(c => [c.id, {index:0, history:[]} ]));
let receiptNumber = 0;
let toastTimer;
const currentStep = item => item.steps[progress.get(item.id).index];
const isDone = item => !currentStep(item);
const visibleSubject = item => ['hk','engineering','stores','kitchen'].includes(state.department) ? (item.roomSubject ?? item.subject.replace('Mira Shah · ','')) : item.subject;
const departmentCases = () => cases.filter(item => item.teams.includes(state.department));
function filteredCases() {
  return departmentCases().filter(item => {
    const matches = `${item.title} ${visibleSubject(item)} ${item.context} ${item.id}`.toLowerCase().includes(state.search.toLowerCase());
    if (!matches) return false;
    if (state.filter === 'mine') return currentStep(item)?.owner === state.department;
    if (state.filter === 'waiting') return !isDone(item) && currentStep(item).owner !== state.department;
    if (state.filter === 'done') return isDone(item);
    return true;
  });
}
function announce(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 6500);
}
function rememberView() {
  const params = new URLSearchParams({department:state.department, view:state.view, case:state.selected});
  history.replaceState(null, '', `#${params}`);
}
function renderNavigation() {
  $('departments').innerHTML = departments.map(([id,name],i) => `<button class="department" data-department="${id}"${id === state.department ? ' aria-current="page"' : ''}><span class="department-name"><img src="assets/${departmentIcons[i]}.svg" alt="" width="18" height="18">${escapeHtml(name)}</span><span class="department-count">${cases.filter(c => c.teams.includes(id) && currentStep(c)?.owner === id).length}</span></button>`).join('');
  $('mobile-department').innerHTML = departments.map(([id,name]) => `<option value="${id}"${id===state.department?' selected':''}>${escapeHtml(name)}</option>`).join('');
  $('department-heading').textContent = team(state.department);
  $('department-description').textContent = departments.find(d => d[0] === state.department)[2];
  document.querySelectorAll('[data-view]').forEach(button => {const active=button.dataset.view===state.view;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.filter===state.filter)));
  ['shift','journey','cases','profiles'].forEach(view => $(`${view}-view`).hidden = state.view!==view);
}
function renderQueue() {
  const related=departmentCases();
  const mine=related.filter(c => currentStep(c)?.owner===state.department).length;
  const waiting=related.filter(c => !isDone(c)&&currentStep(c).owner!==state.department).length;
  const completed=related.filter(isDone).length;
  $('metrics').innerHTML = [[mine,'Needs my team','Ready for an owned next action'],[waiting,'With another team','Track the handoff and next update'],[completed,'Reviews complete','Fictional cases completed this session']].map(([n,label,note])=>`<div class="metric"><span>${label}</span><strong>${n}</strong><small>${note}</small></div>`).join('');
  const list=filteredCases();
  if (!list.some(c=>c.id===state.selected)) {state.selected=list[0]?.id??'';state.detailOpen=false;}
  $('queue-count').textContent=`${list.length} cases`;
  $('queue').innerHTML=list.length?list.map(item=>{const next=currentStep(item);const done=!next;return `<button class="task-row" data-case="${item.id}" aria-current="${state.selected===item.id}"><span class="row-top"><span class="tag ${done?'complete':item.tone}">${done?'Review complete':escapeHtml(item.priority)}</span><span class="muted">${done?'This session':escapeHtml(item.due)}</span></span><span class="task-title">${escapeHtml(item.title)}</span><span class="task-context">${escapeHtml(visibleSubject(item))}</span><span class="task-owner"><span>${escapeHtml(item.area)}</span><b>${done?'Completed':`Owner: ${escapeHtml(team(next.owner))}`}</b></span></button>`;}).join(''):'<div class="empty"><strong>No matching cases</strong><p>Try another search or filter. These counts describe the fictional cases in this department.</p><button class="secondary" id="clear-filters">Clear filters</button></div>';
  renderDetail();
}
function renderDetail() {
  const item=cases.find(c=>c.id===state.selected);
  document.querySelector('.work-layout').classList.toggle('detail-open',state.detailOpen);
  if (!item) {$('detail').innerHTML='<div class="empty">Select a task to see its context and next action.</div>';return;}
  const record=progress.get(item.id); const next=currentStep(item); const own=next?.owner===state.department;
  const roomCondition=item.id==='YC-01' ? (record.index<3?'Dirty / preparation':record.index===3?'Clean · inspection required':'Inspection recorded') : item.area;
  const currentOwner=next?team(next.owner):'Review complete';
  $('detail').innerHTML=`<button class="mobile-back" id="back-queue">Back to work queue</button><div class="detail-head"><div class="detail-meta"><span>${escapeHtml(item.id)} · ${escapeHtml(item.area)}</span><span class="tag ${next?item.tone:'complete'}">${next?`${record.index+1} of ${item.steps.length} steps`:'Review complete'}</span></div><h2 tabindex="-1" id="detail-title">${escapeHtml(visibleSubject(item))}</h2><p>${escapeHtml(item.context)}</p></div><dl class="context-grid"><div><dt>Current owner</dt><dd>${escapeHtml(currentOwner)}</dd></div><div><dt>${item.id==='YC-01'?'Room condition':'Next update'}</dt><dd>${escapeHtml(item.id==='YC-01'?roomCondition:item.due)}</dd></div></dl><ol class="stage-track" aria-label="Scenario handoff stages">${item.steps.map((s,i)=>`<li data-stage="${i<record.index?'complete':i===record.index?'current':'upcoming'}"><span class="stage-index">${i+1}</span><span>${escapeHtml(s.role??team(s.owner))}<br>${i<record.index?'Completed':i===record.index?'Current step':'Upcoming'}</span></li>`).join('')}</ol><div class="action-area"><p class="action-label">${next?'THE NEXT USEFUL ACTION':'THE LOOP IS VISIBLE'}</p><h3>${escapeHtml(next?.title??'This scenario review is complete')}</h3><p class="action-copy">${escapeHtml(next?.copy??'The handoffs and review receipts remain below. This was a fictional workflow; the production app must execute its own authorized commands.')}</p><div class="handoff-note"><strong>Guest promise</strong><br>${escapeHtml(item.promise)}</div>${item.id==='YC-11'?outletEvidence(record,own):''}${next?(own?`<div class="checklist">${next.checks.map((check,i)=>`<label><input type="checkbox" data-check="${i}"><span>${escapeHtml(check)}</span></label>`).join('')}</div><button class="primary" id="advance" disabled>${escapeHtml(next.action)}</button><p class="action-footnote">Acting as ${escapeHtml(next.role??team(next.owner))} in the design. Updates this simulation only.</p>`:`<button class="secondary" id="follow-owner">Continue in ${escapeHtml(team(next.owner))}</button><p class="action-footnote">Explore the receiving team’s view. Department choice does not grant production access.</p>`):'<button class="secondary" id="open-journey">Explore the complete guest journey</button>'}</div><details class="detail-section" open><summary>Handoff history · ${record.history.length} receipts</summary>${record.history.length?`<ol class="timeline">${record.history.map(event=>`<li><time>${event.time}</time><span><strong>${escapeHtml(event.owner)}</strong><br>${escapeHtml(event.text)}</span></li>`).join('')}</ol>`:'<p>No handoff yet. The next action starts an owned request.</p>'}</details><details class="detail-section"><summary>Context and decision evidence</summary><ul>${item.evidence.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul></details>`;
}
function outletEvidence(record, own) {
  return `<section class="source-evidence" aria-label="Original outlet request"><h3>Original attempt · POS-1842-A</h3><p>Restaurant check 1842 · INR 2,450.00<br>Recorded target: <strong>Mira Shah · personal folio F-412-M</strong><br>Result at the outlet: <strong>unknown</strong>. Keep this attempt identity.</p>${record.index===0&&own?`<label for="outlet-account">Which resident account matches the original attempt?<select id="outlet-account"><option value="">Choose the exact account</option><option value="mira"${record.account==='mira'?' selected':''}>Mira Shah · personal folio F-412-M</option><option value="rohan"${record.account==='rohan'?' selected':''}>Rohan Shah · company folio F-412-R</option></select></label><p id="account-feedback" role="status">${record.account==='mira'?'Selected account matches the original request.':record.account==='rohan'?'This account differs from the original request. Review the source before proceeding.':'Room 412 contains two accounts. Room number alone is insufficient.'}</p>`:''}${record.index>0?'<div class="reconciliation-receipt"><strong>Fictional reconciliation receipt · P-8726</strong><p>Accepted · 13:38 IST, 5 Sep 2026<br>Attempt POS-1842-A · Check 1842<br>Mira Shah · F-412-M · INR 2,450.00<br>One existing posting. No new posting or tender.</p></div>':''}</section>`;
}
function updateActionGate() {
  const button=$('advance');if(!button)return;
  const checks=[...document.querySelectorAll('[data-check]')];
  const accountOK=state.selected!=='YC-11'||progress.get('YC-11').index>0||progress.get('YC-11').account==='mira';
  button.disabled=!checks.every(c=>c.checked)||!accountOK;
}
function renderJourney() {
  $('journey-view').innerHTML='<div class="section-intro"><p class="eyebrow">THE HOTEL THROUGH THE GUEST’S EYES</p><h2 id="journey-heading">One stay. Many teams. A continuous promise.</h2><p>The guest should not have to coordinate the hotel. Each stage names the owner, the next handoff and the evidence the receiving team needs.</p></div><div class="journey-grid">'+journey.map(([n,title,promise,copy,owner,evidence,id])=>`<article class="journey-stage"><span class="stage-number">${n} / THE STAY</span><h3>${escapeHtml(title)}</h3><p><strong>${escapeHtml(promise)}</strong><br>${escapeHtml(copy)}</p><dl><dt>Coordination</dt><dd>${escapeHtml(owner)}</dd><dt>What must travel with the work</dt><dd>${escapeHtml(evidence)}</dd></dl><button class="text-action" data-explore="${id}">Explore a related scenario</button></article>`).join('')+'</div>';
}
function renderCases() {
  $('cases-view').innerHTML='<div class="section-intro"><p class="eyebrow">FICTIONAL SCENARIOS · ORIGINAL DESIGN SYNTHESIS</p><h2 id="cases-heading">A shift is more than its happy path.</h2><p>Explore how people handle interruptions, changed promises and uncertain outcomes. These are design cases, not field observations or claims of shipped functionality.</p></div><div class="case-grid">'+cases.map(item=>`<article class="case-card"><span class="case-code">${item.id} · ${escapeHtml(item.area.toUpperCase())}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.promise)}</p><div class="case-teams">${item.teams.map(team).map(escapeHtml).join(' · ')}</div><button class="text-action" data-explore="${item.id}">Open scenario</button></article>`).join('')+'</div>';
}
function render() {renderNavigation();renderQueue();renderJourney();renderCases();renderProfiles();rememberView();}
function changeDepartment(id, retain=false) {
  if (!departments.some(d=>d[0]===id))return;
  state.department=id;state.filter='all';state.search='';$('search').value='';state.detailOpen=retain;render();
  if(retain)$('detail-title')?.focus(); else $('department-heading').scrollIntoView({block:'nearest'});
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.department){changeDepartment(button.dataset.department);return;}
  if(button.dataset.profile||button.id==='my-profile'){state.view='profiles';renderNavigation();renderProfiles();$('profiles-heading')?.scrollIntoView({block:'nearest'});return;}
  if(button.dataset.profileShift){state.view='shift';changeDepartment(button.dataset.profileShift);return;}
  if(button.dataset.view){state.view=button.dataset.view;render();return;}
  if(button.dataset.filter){state.filter=button.dataset.filter;renderQueue();return;}
  if(button.dataset.case){state.selected=button.dataset.case;state.detailOpen=true;renderQueue();rememberView();$('detail-title')?.focus();return;}
  if(button.dataset.explore){const item=cases.find(c=>c.id===button.dataset.explore);state.selected=item.id;state.view='shift';changeDepartment(currentStep(item)?.owner??item.teams[0],true);return;}
  if(button.id==='advance'){
    const item=cases.find(c=>c.id===state.selected);const next=item&&currentStep(item);const checks=[...document.querySelectorAll('[data-check]')];
    if(!next||next.owner!==state.department||checks.length!==next.checks.length||!checks.every(c=>c.checked)||(item.id==='YC-11'&&progress.get(item.id).account!=='mira'))return;
    const record=progress.get(item.id);const minutes=820+(++receiptNumber);record.history.push({owner:next.role??team(next.owner),text:next.receipt,time:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`});record.index++;
    state.filter='all';render();announce(next.receipt);$('detail-title')?.focus();return;
  }
  if(button.id==='follow-owner'){const item=cases.find(c=>c.id===state.selected);changeDepartment(currentStep(item).owner,true);return;}
  if(button.id==='back-queue'){state.detailOpen=false;renderDetail();document.querySelector(`[data-case="${state.selected}"]`)?.focus();return;}
  if(button.id==='clear-filters'){state.filter='all';state.search='';$('search').value='';render();$('search').focus();return;}
  if(button.id==='open-journey'){state.view='journey';render();return;}
  if(button.id==='phone-toggle'){const active=$('app-shell').classList.toggle('phone');button.setAttribute('aria-pressed',String(active));button.textContent=active?'Desktop layout':'Phone layout';return;}
  if(button.id==='notes-open'){$('notes-dialog').showModal();return;}
  if(button.id==='notes-close'){$('notes-dialog').close();return;}
  if(button.id==='reset'){progress.forEach(record=>{record.index=0;record.history=[];delete record.account;});receiptNumber=0;state={department:'fo',view:'shift',filter:'all',search:'',selected:'YC-01',detailOpen:false};$('search').value='';render();announce('Fictional cases reset. No hotel data was changed.');}
});
document.addEventListener('change',event=>{
  if(event.target.id==='skin-select'){applySkin(event.target.value);return;}
  if(event.target.id==='mobile-department'){changeDepartment(event.target.value);return;}
  if(event.target.id==='outlet-account'){progress.get('YC-11').account=event.target.value;$('account-feedback').textContent=event.target.value==='mira'?'Selected account matches the original request.':event.target.value==='rohan'?'This account differs from the original request. Review the source before proceeding.':'Room 412 contains two accounts. Room number alone is insufficient.';updateActionGate();}
  if(event.target.matches('[data-check]'))updateActionGate();
});
$('search').addEventListener('input',event=>{state.search=event.target.value;renderQueue();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('notes-dialog').open&&state.detailOpen){state.detailOpen=false;renderDetail();document.querySelector(`[data-case="${state.selected}"]`)?.focus();}
  if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('notes-dialog').open){event.preventDefault();state.view='shift';render();$('search').focus();}
});
const initial=new URLSearchParams(location.hash.slice(1));
if(departments.some(d=>d[0]===initial.get('department')))state.department=initial.get('department');
if(['shift','journey','cases','profiles'].includes(initial.get('view')))state.view=initial.get('view');
if(cases.some(c=>c.id===initial.get('case')&&c.teams.includes(state.department)))state.selected=initial.get('case');
$('shift-profile').innerHTML = profileCard('staff', true);
applySkin($('skin-select').value);
render();
