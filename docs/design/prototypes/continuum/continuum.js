/* Yellow Continuum: fictional, approval-only interaction study. No network or business commands. */
(() => {
  'use strict';
  const steps = ['arrival', 'guest', 'rooms', 'review', 'handoff'];
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selectedRoom = '608';
  let scene = 'arrival';
  let replayToken = 0;
  let checkToken = 0;
  let checksRunning = false;
  let guestDraft = { fullName: 'Priya Sharma', email: '', phone: '', nationality: '', request: 'Quiet side, walk-in shower' };
  let sampleIdentityReviewed = false;
  const guestFields = { fullName: '#guest-fullname', email: '#guest-email', phone: '#guest-phone', nationality: '#guest-nationality', request: '#guest-request' };
  let releaseFlight = () => {};
  const flyingGuest = document.createElement('div');
  flyingGuest.textContent = 'PS';
  flyingGuest.setAttribute('aria-hidden', 'true');
  Object.assign(flyingGuest.style, { position:'fixed', zIndex:'100', left:'0', top:'0', width:'60px', height:'60px',
    display:'none', placeItems:'center', borderRadius:'50%', background:'#E9DFCC', color:'#26332E',
    font:'800 18px Urbanist, sans-serif', pointerEvents:'none', transformOrigin:'0 0',
    boxShadow:'0 2px 0 rgba(255,255,255,.8) inset, 0 12px 24px rgba(46,54,48,.13)' });
  document.body.append(flyingGuest);
  const avatarSelectors = { arrival:'.is-focus .arrival-identity b', guest:'.guest-core', rooms:'.guest-beacon', review:'.review-avatar', handoff:'.handoff-origin' };
  function avatarRect(step) {
    const node = $(avatarSelectors[step]);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return rect.width && rect.height && rect.y>=0 && rect.bottom<=innerHeight ? { node, rect } : null;
  }
  function connectGuest(from, to) {
    releaseFlight();
    if (reducedMotion.matches || !from || !to) return;
    const oldVisibility = to.node.style.visibility;
    to.node.style.visibility = 'hidden';
    flyingGuest.style.display = 'grid';
    const transform = rect => `translate3d(${rect.x}px,${rect.y}px,0) scale(${Math.min(rect.width,rect.height)/60})`;
    const animation = flyingGuest.animate([{transform:transform(from.rect),opacity:1},
      {transform:transform(to.rect),opacity:1}], { duration:440, easing:'cubic-bezier(.22,.75,.2,1)', fill:'forwards' });
    let released = false;
    const release = () => {
      if (released) return; released = true;
      to.node.style.visibility = oldVisibility;
      flyingGuest.style.display = 'none';
      animation.cancel();
    };
    releaseFlight = release;
    animation.finished.then(release, release);
  }
  const copy = {
    arrival: {
      kicker: 'FRONT DESK / TODAY', title: 'A little ahead\nof every arrival.',
      description: '12 arrivals today. Four arriving soon. Start with what needs your attention.',
      inspector: 'Before Priya arrives', detail: 'The booking is in place. Guest details and the guarantee still need attention.',
      evidence: [['15:20', 'Expected arrival', 'Sample reservation · airport pickup'], ['Details incomplete', 'Pre-arrival form outstanding', 'Sample collection status · no message sent'], ['18:00 today', 'Guarantee deadline', 'Sample policy · no automatic cancellation']],
      action: 'Open reservation',
    },
    guest: {
      kicker: 'RESERVATION / GUEST DETAILS', title: 'One guest record.\nRoom to complete it.',
      description: 'Complete missing details, review sample ID fields and keep the guest’s requests together.',
      inspector: 'Prepare the arrival', detail: 'An incomplete booking is a starting point. Staff can review and add details before check-in.',
      evidence: [['Partial OTA booking', 'Name and stay received', 'Sample record · remaining fields editable'], ['ID review pending', 'Capture → review → confirm', 'Demo only · country rules not evaluated'], ['18:00 today', 'Guarantee still outstanding', 'Sample deadline · no payment requested']],
      action: 'Explore room options',
    },
    rooms: {
      kicker: 'ROOM ASSIGNMENT / FLOOR 06', title: 'A better fit.\nWith a clear reason.',
      description: 'Eight sample rooms, visible trade-offs. Select a room to inspect the fit.',
      inspector: 'Why room 608 leads', detail: 'A suggested fit, with evidence you can inspect. You stay in control of the assignment.',
      evidence: [['Ready now', 'Cleaned & inspected', 'Sample housekeeping record · 14:03'], ['Quiet side', 'Away from the lift', 'Sample room profile · floor 6'], ['Walk-in shower', 'Matches the request', 'Sample room amenity record']],
      action: 'Review room 608',
    },
    review: {
      kicker: 'CHECK-IN / REVIEW', title: 'Review the details.\nThen make it official.',
      description: 'An illustrative checkpoint. No guest is checked in from this prototype.',
      inspector: 'You have the final word', detail: 'A real check-in would validate identity, permissions, payment and room state on the server before committing.',
      evidence: [['Room '+selectedRoom, 'Deluxe King · 3 nights', 'Illustrative selection only'], ['No charge', 'No payment is collected', 'This prototype has no payment connection'], ['No write', 'Nothing is saved', 'Approval study · not an operational check-in']],
      action: 'Preview the handoff',
    },
    handoff: {
      kicker: 'SERVICE / TEAM HANDOFF', title: 'The right next step.\nFor every team.',
      description: 'The guest journey continues. Every next step has a clear owner.',
      inspector: 'Beyond the front desk', detail: 'Illustrative handoffs show how teams could coordinate. No task has been created and no guest has been checked in.',
      evidence: [['Bell desk', 'Luggage to room '+selectedRoom, 'Illustrative task · not dispatched'], ['Guest relations', 'Welcome-back amenity', 'Illustrative task · not dispatched'], ['Front desk', 'Verify key & guest details', 'Illustrative task · not dispatched']],
      action: 'Replay the journey',
    },
  };

  function text(selector, value) { const node = $(selector); if (node) node.textContent = value; }
  function nextLabel(label) {
    const button = $('#next-step');
    button.textContent = scene === 'handoff' ? 'Replay ↻' : scene === 'arrival' ? 'Start →' : 'Next →';
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  function evidence(items) {
    const container = $('#evidence-list');
    if (!container) return;
    container.replaceChildren(...items.map(([value, label, source], index) => {
      const item = document.createElement('li');
      item.style.setProperty('--item', index);
      const marker = document.createElement('span'); marker.className = 'evidence-marker'; marker.textContent = String(index + 1).padStart(2, '0');
      const content = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = value;
      const description = document.createElement('span'); description.textContent = label;
      const small = document.createElement('small'); small.textContent = source;
      content.append(strong, description, small); item.append(marker, content); return item;
    }));
  }

  function readDraft() {
    return Object.fromEntries(Object.entries(guestFields).map(([key, selector]) => [key, $(selector)?.value.trim() || '']));
  }
  function refreshGuestLabels() {
    text('#guest-name', guestDraft.fullName);
    text('.review-guest strong', guestDraft.fullName);
    text('.is-focus .arrival-identity strong', guestDraft.fullName);
    text('.handoff-origin strong', guestDraft.fullName.split(' ')[0]);
    text('#dossier-name', guestDraft.fullName);
    const missing=Object.entries(guestDraft).filter(([key,value])=>key!=='request'&&!value).length;
    text('#guest-completeness', missing ? `Incomplete · ${missing} fields missing` : 'Sample guest fields completed');
    const initials = guestDraft.fullName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join('').toUpperCase();
    ['#guest-initials','.is-focus .arrival-identity b','.guest-core span','.guest-beacon span','.review-avatar','.handoff-origin span'].forEach(selector => text(selector, initials));
    flyingGuest.textContent = initials;
    text('.review-step:first-child strong', sampleIdentityReviewed ? 'Sample fields reviewed' : 'Staff review pending');
  }
  function saveDraft() {
    const fields = Object.values(guestFields).map(selector => $(selector)).filter(Boolean);
    const invalid = fields.find(field => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    const next = readDraft();
    if (!next.fullName) { text('#draft-status','Add the guest name before saving this sample.'); $('#guest-fullname')?.focus(); return; }
    guestDraft = next;
    refreshGuestLabels();
    text('#draft-status', 'Sample changes saved for this preview. Nothing written to the hotel database.');
    cancelChecks(true);
  }
  function previewId() {
    cancelChecks();
    $('#id-name').value = guestDraft.fullName;
    $('#id-nationality').value = 'India';
    $('#id-review-confirm').checked = false;
    text('#id-confidence-note', 'Synthetic fields for design review. Nationality needs staff confirmation; no document was scanned.');
    $('#id-review').showModal();
    $('#id-name').focus();
  }
  function confirmId() {
    const name = $('#id-name'), nationality = $('#id-nationality'), confirmed = $('#id-review-confirm');
    if (!name.value.trim()) { name.setCustomValidity('Review the sample guest name.'); name.reportValidity(); return; }
    name.setCustomValidity('');
    if (!confirmed.checked) { confirmed.setCustomValidity('Confirm that you checked these sample fields.'); confirmed.reportValidity(); return; }
    confirmed.setCustomValidity('');
    // Candidate OCR values are only copied into an editable local draft, never an official identity record.
    $('#guest-fullname').value = name.value.trim();
    $('#guest-nationality').value = nationality.value.trim();
    sampleIdentityReviewed = true;
    text('#draft-status', 'Sample ID fields copied into the editable draft. Review other details, then save the sample.');
    text('.review-step:first-child strong', 'Sample fields reviewed');
    $('#id-review').close();
    $('#save-guest-draft').focus();
  }
  function checkSteps() {
    const missing = Object.entries(guestDraft).filter(([key,value]) => key !== 'request' && !value).length;
    const rooms = $$('[data-room]');
    const ready = rooms.filter(node => ['608','610','612','601','603'].includes(node.dataset.room)).length;
    return [
      { title:'Reservation & preferences', detail:`3 nights · Deluxe King · ${guestDraft.request || 'no requests captured'}. Sample booking.`, state:'complete' },
      { title:'Guest & guarantee', detail: `${missing} guest fields missing · guarantee due 18:00. Staff attention required.`, state:'warning' },
      { title:'Room readiness', detail:`${rooms.length} sample rooms checked · ${ready} inspected · ${rooms.length-ready} not ready.`, state:'complete' },
      { title:'Preference comparison', detail:'Sample comparison: 608 has quiet side + shower; 610 is near the lift. Staff selects.', state:'complete' },
    ];
  }
  function renderChecks(records, current = -1) {
    const container = $('#check-list'); if (!container) return;
    container.replaceChildren(...records.map((record,index) => {
      const item = document.createElement('li');
      item.dataset.state = index < current ? record.state : index === current ? 'running' : 'pending';
      const icon = document.createElement('span'); icon.className='check-icon'; icon.setAttribute('aria-hidden','true');
      icon.textContent = index < current ? (record.state==='warning' ? '!' : '✓') : String(index+1).padStart(2,'0');
      const content = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('small');
      title.textContent=record.title;
      detail.textContent=index<current ? record.detail : index===current ? 'Checking sample records…' : 'Waiting for preview';
      content.append(title,detail); item.append(icon,content); return item;
    }));
  }
  function cancelChecks(reset = false) {
    checkToken += 1;
    if (checksRunning) {
      text('#check-status','Preview stopped. No action was taken.');
      $$('#check-list [data-state="running"]').forEach(node => { node.dataset.state='pending'; const small=node.querySelector('small'); if(small) small.textContent='Preview stopped'; });
    }
    checksRunning = false;
    $('#check-progress')?.setAttribute('aria-busy','false');
    text('#run-checks','Preview checks');
    if (reset) { renderChecks(checkSteps()); text('#check-status','Sample check replay · not live processing'); }
  }
  async function runChecks() {
    if (checksRunning) { cancelChecks(); return; }
    cancelChecks();
    const token=checkToken, records=checkSteps();
    checksRunning=true;
    $('#check-progress')?.setAttribute('aria-busy','true');
    text('#run-checks','Stop preview');
    text('#check-status','Sample check replay · not live processing');
    for (let index=0; index<records.length; index++) {
      if (token!==checkToken) return;
      renderChecks(records,index);
      // Deliberate presentation timing only. Production must render observed server events without artificial delay.
      await new Promise(resolve=>setTimeout(resolve,reducedMotion.matches ? 40 : 650));
    }
    if (token!==checkToken) return;
    renderChecks(records,records.length);
    text('#check-status','Sample checks complete · guarantee needs attention');
    text('#run-checks','Replay checks');
    checksRunning=false;
    $('#check-progress')?.setAttribute('aria-busy','false');
  }

  function selectRoom(room, animate = true) {
    if (!$$('[data-room]').some(node => node.dataset.room === room)) return;
    selectedRoom = room;
    $$('[data-room]').forEach(node => {
      const selected = node.dataset.room === room;
      node.classList.toggle('is-selected', selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    text('#selected-room-label', 'Room '+room);
    $$('[data-selected-room]').forEach(node => { node.textContent = room; });
    text('.room-mobile-summary strong b', room);
    text('.room-continue span', 'Review room '+room);
    text('.review-step:nth-child(2) strong', 'Room '+room+' · 3 nights');
    text('.review-room span', 'Floor 6 · Deluxe King');
    text('[data-fit-label]', room === '608' ? 'best fit' : 'alternative');
    const position = ['608','610','612','614','601','603','605','607'].indexOf(room);
    $('#roomfield')?.style.setProperty('--selected-column', String(position % 4));
    $('#roomfield')?.style.setProperty('--selected-row', String(Math.floor(position/4)));
    $('#roomfield')?.setAttribute('data-selected', room);
    if (scene === 'rooms') {
      const ready = ['608', '610', '612', '601', '603'].includes(room);
      text('#inspector-title', room === '608' ? 'Why room 608 leads' : 'Consider room '+room);
      text('#inspector-copy', room === '608' ? copy.rooms.detail : ready
        ? 'Compare this alternative with Priya’s preferences. A different room can be selected; the trade-offs remain visible.'
        : 'This room is not ready in the sample. Explore it, but select an inspected room to continue.');
      evidence(room === '608' ? copy.rooms.evidence : [
        [ready ? 'Ready now' : 'Not ready', ready ? 'Cleaned & inspected' : 'Housekeeping in progress', 'Sample housekeeping record'],
        [room === '610' ? 'Lift nearby' : 'Preference not verified', 'Compare the quiet-side request', 'Sample room profile'],
        [room === '610' ? 'Standard bath' : 'Amenity not verified', 'Check the walk-in shower request', 'Sample room amenity record'],
      ]);
      nextLabel(ready ? 'Review room '+room : 'Choose a ready room');
      $('#next-step').disabled = !ready;
      $$('[data-go="review"]').forEach(button => { button.disabled = !ready; });
    }
    if (animate && !reducedMotion.matches) {
      const label = $('#selected-room-label');
      label?.getAnimations().forEach(animation => animation.cancel());
      label?.animate([{ opacity: .35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
    }
  }

  function go(next, { focus = false } = {}) {
    if (!steps.includes(next)) return;
    if (scene === 'rooms' && next === 'review' && !['608','610','612','601','603'].includes(selectedRoom)) return;
    cancelChecks();
    releaseFlight();
    const previousAvatar = next === scene ? null : avatarRect(scene);
    const previousIndex = steps.indexOf(scene);
    scene = next;
    const index = steps.indexOf(scene);
    $('#app').dataset.scene = scene;
    $('#app').style.setProperty('--progress', String(index / (steps.length - 1)));
    const current = copy[scene];
    text('#hero-kicker', current.kicker);
    text('#hero-title', current.title);
    text('#hero-copy', current.description);
    text('#inspector-title', current.inspector);
    text('#inspector-copy', current.detail);
    nextLabel(current.action);
    $('#next-step').disabled = false;
    text('.sequence-no', String(index+1).padStart(2,'0')+' / 05');
    $$('.rail-track i').forEach((dot,dotIndex) => dot.classList.toggle('is-live',dotIndex===index));
    evidence(current.evidence.map(row => row.map(value => value.replace(/Room 608/g, 'Room '+selectedRoom).replace(/room 608/g, 'room '+selectedRoom))));
    $$('.journey-step, [data-step]').forEach(node => {
      const stepIndex = steps.indexOf(node.dataset.step);
      node.classList.toggle('is-active', node.dataset.step === scene);
      node.classList.toggle('is-complete', stepIndex < index);
      if (node.dataset.step === scene) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    });
    $$('[data-panel]').forEach(panel => {
      const active = panel.dataset.panel === scene;
      panel.inert = !active;
      panel.setAttribute('aria-hidden', String(!active));
    });
    $('#back-step').disabled = index === 0;
    selectRoom(selectedRoom, false);
    refreshGuestLabels();
    const panel = $('[data-panel="'+scene+'"]');
    panel?.getAnimations().forEach(animation => animation.cancel());
    const currentAvatar = avatarRect(scene);
    if (panel) {
      panel.animate(reducedMotion.matches ? [{ opacity: .5 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translateY('+(index >= previousIndex ? 18 : -14)+'px) scale(.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], { duration: reducedMotion.matches ? 120 : 400, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    connectGuest(previousAvatar, currentAvatar);
    if (focus) {
      $('#hero-title').setAttribute('tabindex', '-1');
      $('#hero-title').focus({ preventScroll: true });
    }
    document.title = current.kicker.split(' / ').at(-1)+' · Yellow Continuum prototype';
  }

  function cancelReplay() {
    replayToken += 1;
    text('#motion-replay', 'Play the journey');
    $('#motion-replay')?.setAttribute('aria-pressed', 'false');
  }
  async function replay() {
    cancelReplay();
    const token = replayToken;
    text('#motion-replay', 'Stop preview');
    $('#motion-replay')?.setAttribute('aria-pressed', 'true');
    for (const step of steps) {
      if (token !== replayToken) return;
      go(step);
      await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 2500 : 2200));
    }
    if (token === replayToken) cancelReplay();
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;
    if (target.id === 'motion-replay') {
      if (target.getAttribute('aria-pressed') === 'true') cancelReplay(); else void replay();
      return;
    }
    cancelReplay();
    if (target.id === 'run-checks') { void runChecks(); return; }
    if (target.id === 'save-guest-draft') { saveDraft(); return; }
    if (target.id === 'demo-id-capture') { previewId(); return; }
    if (target.id === 'confirm-id') { confirmId(); return; }
    if (target.id === 'close-id') { $('#id-review').close(); $('#demo-id-capture').focus(); return; }
    if (target.dataset.go || target.dataset.step) go(target.dataset.go || target.dataset.step, { focus: true });
    else if (target.dataset.room) selectRoom(target.dataset.room);
    else if (target.id === 'next-step') go(steps[(steps.indexOf(scene)+1) % steps.length], { focus: true });
    else if (target.id === 'back-step') go(steps[Math.max(0, steps.indexOf(scene)-1)], { focus: true });
  });
  document.addEventListener('input', event => {
    if (Object.values(guestFields).includes('#'+event.target.id)) text('#draft-status','Unsaved sample changes · kept in this tab until reload');
    if (event.target.id==='id-name' || event.target.id==='id-review-confirm') event.target.setCustomValidity('');
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('.guest-form')) { event.preventDefault(); saveDraft(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { cancelReplay(); cancelChecks(); } });
  // Owned capture harness uses the same state transitions as visible buttons.
  window.continuumPrototype = Object.freeze({ go, selectRoom, replay, cancelReplay,
    get state() { return Object.freeze({ scene, selectedRoom, checksRunning, sampleIdentityReviewed, guestDraft:{...guestDraft}, fictional: true }); } });
  Object.entries(guestFields).forEach(([key,selector])=>{ if ($(selector)) $(selector).value=guestDraft[key]; });
  renderChecks(checkSteps());
  go('arrival');
})();
