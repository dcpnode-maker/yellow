import { DEMO_CONFIRMATION_NO, DEMO_ROOM_CODE, DEMO_ROOM_MOVE_TO_CODE } from "./demo-arrival-fixture";

export interface OperatorFlowNotice {
  readonly title: string;
  readonly detail: string;
  readonly ok: boolean;
}

export function renderOperatorFlow(notice?: OperatorFlowNotice): string {
  const noticeHtml = notice === undefined
    ? ""
    : `<section class="notice ${notice.ok ? "ok" : "bad"}"><strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.detail)}</span></section>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yellow PMS · Staff flow</title>
  <link rel="stylesheet" href="/assets/demo.css">
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><span>Yellow PMS</span></div>
      <div class="status-pill">Operator flow · ${escapeHtml(DEMO_CONFIRMATION_NO)}</div>
    </header>
    ${noticeHtml}
    <section class="hero">
      <div class="hero-main glass">
        <p class="eyebrow">Yellow Grand Demo Hotel · Front desk arrival</p>
        <h1>Check in Sara, edit guests, add sharer.</h1>
        <p class="lead">Staff can review the arrival, correct the guest name, add a sharer, confirm check-in, and move the room from one governed workstation. Every real write still requires the exact confirmation phrase.</p>
        <nav class="links" aria-label="Staff flow links">
          <a class="link-button" href="#arrival">Start arrival</a>
          <a class="link-button secondary" href="#guests">Guest names / sharers</a>
          <a class="link-button secondary" href="#stay">Stay actions</a>
          <a class="link-button secondary" href="/overview">Manager overview</a>
        </nav>
      </div>
      <aside class="hero-side glass">
        <div class="stat"><b>Due in</b><span>Sara Al Harbi · ${escapeHtml(DEMO_CONFIRMATION_NO)}</span></div>
        <div class="stat"><b>${escapeHtml(DEMO_ROOM_CODE)}</b><span>Deluxe King · inspected · BAR-BB</span></div>
        <div class="stat"><b>No drawer</b><span>Cashier read/prep allowed; posting/settlement governed</span></div>
        <div class="stat"><b>Phrase</b><span>CONFIRM YELLOW OPERATION</span></div>
      </aside>
    </section>

    <h2 class="section-title" id="arrival">1. Arrival check-in</h2>
    <section class="flow-grid">
      <article class="flow-card glass">
        <h3>Review arrival packet</h3>
        <ul class="operator-list">
          <li><b>Reservation</b><span>${escapeHtml(DEMO_CONFIRMATION_NO)}</span></li>
          <li><b>Guest</b><span>Sara Al Harbi</span></li>
          <li><b>Room</b><span>${escapeHtml(DEMO_ROOM_CODE)} · Deluxe King · inspected</span></li>
          <li><b>Rate</b><span>BAR-BB · breakfast included · INR</span></li>
        </ul>
      </article>
      <form class="flow-card glass" method="post" action="/ui/check-in">
        <h3>Confirm check-in</h3>
        <p class="purpose">Posts the real PMS check-in command: reservation becomes in-house and occupancy is recorded through PostgreSQL.</p>
        <input type="hidden" name="confirmationNo" value="${escapeHtml(DEMO_CONFIRMATION_NO)}">
        <input type="hidden" name="roomCode" value="${escapeHtml(DEMO_ROOM_CODE)}">
        <label>Confirmation phrase<input name="confirmationPhrase" value="CONFIRM YELLOW OPERATION"></label>
        <button class="action-button" type="submit">Check in guest</button>
      </form>
    </section>

    <h2 class="section-title" id="guests">2. Guest names and sharers</h2>
    <section class="flow-grid">
      <form class="flow-card glass" method="post" action="/ui/guest-profile">
        <h3>Edit primary guest name</h3>
        <p class="purpose">Corrects the guest profile in the party table and writes reservation guest-profile evidence.</p>
        <input type="hidden" name="confirmationNo" value="${escapeHtml(DEMO_CONFIRMATION_NO)}">
        <label>Primary guest name<input name="primaryGuestName" value="Sara Al Harbi"></label>
        <label>Confirmation phrase<input name="confirmationPhrase" value="CONFIRM YELLOW OPERATION"></label>
        <button class="action-button" type="submit">Save name</button>
      </form>
      <form class="flow-card glass" method="post" action="/ui/guest-profile">
        <h3>Add sharer</h3>
        <p class="purpose">Adds another party as a reservation sharer and updates reservation guest share percentages.</p>
        <input type="hidden" name="confirmationNo" value="${escapeHtml(DEMO_CONFIRMATION_NO)}">
        <label>Sharer name<input name="sharerName" value="Aarav Mehta"></label>
        <label>Confirmation phrase<input name="confirmationPhrase" value="CONFIRM YELLOW OPERATION"></label>
        <button class="action-button" type="submit">Add sharer</button>
      </form>
    </section>

    <h2 class="section-title" id="stay">3. Stay actions</h2>
    <section class="flow-grid">
      <form class="flow-card glass" method="post" action="/ui/room-move">
        <h3>Move room</h3>
        <p class="purpose">Moves this in-house stay from ${escapeHtml(DEMO_ROOM_CODE)} to ${escapeHtml(DEMO_ROOM_MOVE_TO_CODE)} with release/record occupancy functions.</p>
        <input type="hidden" name="confirmationNo" value="${escapeHtml(DEMO_CONFIRMATION_NO)}">
        <input type="hidden" name="fromRoomCode" value="${escapeHtml(DEMO_ROOM_CODE)}">
        <input type="hidden" name="toRoomCode" value="${escapeHtml(DEMO_ROOM_MOVE_TO_CODE)}">
        <label>Confirmation phrase<input name="confirmationPhrase" value="CONFIRM YELLOW OPERATION"></label>
        <button class="action-button" type="submit">Move to room ${escapeHtml(DEMO_ROOM_MOVE_TO_CODE)}</button>
      </form>
      <article class="flow-card glass">
        <h3>What still stays protected</h3>
        <p class="purpose">Card payments, production fiscal documents, OTA writeback and statutory submissions stay greyed out until their governed flows are separately reviewed.</p>
        <div class="chips"><span class="chip">PMS writes live</span><span class="chip warn">external rails greyed</span></div>
      </article>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
