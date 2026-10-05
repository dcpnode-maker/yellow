import { buildColleagueDemoScenario } from "./colleague-scenario";
import { COLLEAGUE_DEMO_READINESS } from "./colleague-readiness";
import { buildColleagueDemoProofBundle } from "./proof-bundle";

export interface DemoShareLink {
  readonly label: string;
  readonly route: string;
  readonly purpose: string;
}

export interface DemoShareStep {
  readonly order: number;
  readonly title: string;
  readonly route: string;
  readonly expectedProof: readonly string[];
}

export interface ColleagueSharePacket {
  readonly product: "Yellow PMS";
  readonly audience: "internal-colleague-review";
  readonly readyToShare: boolean;
  readonly notifyFounder: boolean;
  readonly notificationPolicy: string;
  readonly localEntry: "http://127.0.0.1:3000/";
  readonly status: "ready" | "not_ready";
  readonly provedCount: number;
  readonly remainingGateCount: number;
  readonly links: readonly DemoShareLink[];
  readonly walkthrough: readonly DemoShareStep[];
  readonly remainingGates: readonly string[];
}

export interface ColleagueSharePacketInput {
  readonly publicAccessObserved?: boolean;
  readonly mobileProofObserved?: boolean;
  readonly liveGeminiProved?: boolean;
}

export function buildColleagueSharePacket(input: ColleagueSharePacketInput = {}): ColleagueSharePacket {
  const readiness = COLLEAGUE_DEMO_READINESS;
  const scenario = buildColleagueDemoScenario();
  const proof = buildColleagueDemoProofBundle(input);
  const remainingGates = proof.remainingGates.map((gate) => gate.summary);
  const status: "ready" | "not_ready" = proof.readyToShare ? "ready" : readiness.status;

  return Object.freeze({
    product: "Yellow PMS" as const,
    audience: "internal-colleague-review" as const,
    readyToShare: proof.readyToShare,
    notifyFounder: proof.shareNotificationAllowed,
    notificationPolicy: proof.readyToShare
      ? "Founder notification is now allowed: public mobile proof and live Gemini proof are complete."
      : "Notify the founder only after public URL/mobile proof and configured Gemini smoke are complete.",
    localEntry: "http://127.0.0.1:3000/" as const,
    status,
    provedCount: proof.proved.length,
    remainingGateCount: proof.remainingGates.length,
    links: Object.freeze([
      link("Mobile shell", "/", "Open the mobile-first colleague surface."),
      link("Readiness", "/api/v1/demo/readiness", "Machine-readable readiness checklist."),
      link("Public runtime proof", "/api/v1/demo/public-runtime-proof", "Shows whether the current request is HTTPS/public or local-only."),
      link("Proof bundle", "/api/v1/demo/proof-bundle", "Current proof and remaining gates."),
      link("Property config", "/api/v1/demo/property-config", "Synthetic hotel configuration."),
      link("Workflow rehearsal", "/api/v1/demo/workflow-rehearsal", "Synthetic complete PMS workflow rehearsal."),
      link("AI rehearsal", "/api/v1/demo/ai-rehearsal", "Overwatch/Gemini boundary rehearsal."),
      link("Gemini live proof", "/api/v1/demo/gemini-live-proof", "Runtime proof that non-operational Overwatch guidance can use Gemini."),
      link("Governed housekeeping command", "/api/v1/demo/governed/housekeeping/condition", "POST-only proof route for confirmed DB-backed room condition mutation."),
      link("Governed check-in command", "/api/v1/demo/governed/check-in", "POST-only proof route for confirmed DB-backed arrival check-in."),
      link("Governed cashier posting command", "/api/v1/demo/governed/cashier/post-charge", "POST-only proof route for confirmed balanced cashier charge posting."),
      link("Governed cashier settlement command", "/api/v1/demo/governed/cashier/settle-payment", "POST-only proof route for confirmed cash-marker settlement."),
      link("Governed checkout command", "/api/v1/demo/governed/checkout/complete", "POST-only proof route for confirmed zero-balance checkout completion."),
      link("Governed group block status command", "/api/v1/demo/governed/group-block/status", "POST-only proof route for confirmed group block status conversion."),
      link("Governed group pickup command", "/api/v1/demo/governed/group-block/pickup", "POST-only proof route for confirmed group pickup reservation creation."),
      link("Governed group wash command", "/api/v1/demo/governed/group-block/wash", "POST-only proof route for confirmed group wash/release."),
      link("Governed group rooming-list import command", "/api/v1/demo/governed/group-block/rooming-list/import", "POST-only proof route for confirmed group rooming-list import."),
      link("Governed room move command", "/api/v1/demo/governed/room-move", "POST-only proof route for confirmed same-type room move."),
      link("Front desk board", "/api/v1/demo/front-desk-board", "Arrivals, departures, rooms and cashier policy."),
      link("Group block manager", "/api/v1/demo/group-blocks/manager", "Group pickup, rooming-list and wash controls."),
    ]),
    walkthrough: Object.freeze(scenario.steps.map((step, index) => Object.freeze({
      order: index + 1,
      title: step.title,
      route: step.route,
      expectedProof: step.expectedProof,
    }))),
    remainingGates: Object.freeze(remainingGates),
  });
}

export function renderColleagueSharePacketHtml(packet: ColleagueSharePacket = buildColleagueSharePacket()): string {
  const links = packet.links
    .map((linkItem) => `<li><a href="${escapeHtml(linkItem.route)}">${escapeHtml(linkItem.label)}</a> — ${escapeHtml(linkItem.purpose)}</li>`)
    .join("");
  const steps = packet.walkthrough
    .map((step) => `<li><strong>${step.order}. ${escapeHtml(step.title)}</strong> <a href="${escapeHtml(step.route)}">${escapeHtml(step.route)}</a><br><span>${escapeHtml(step.expectedProof.join(" "))}</span></li>`)
    .join("");
  const gates = packet.remainingGates.map((gate) => `<li>${escapeHtml(gate)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yellow PMS colleague review packet</title>
</head>
<body>
  <main>
    <h1>Yellow PMS colleague review packet</h1>
    <p>Status: <strong>${escapeHtml(packet.status)}</strong>. Ready to share publicly: <strong>${String(packet.readyToShare)}</strong>. Notify founder: <strong>${String(packet.notifyFounder)}</strong>.</p>
    <p>${escapeHtml(packet.notificationPolicy)}</p>
    <p>Local entry: <a href="/">${escapeHtml(packet.localEntry)}</a></p>
    <p>Proof items: ${packet.provedCount}. Remaining gates: ${packet.remainingGateCount}.</p>
    <section>
      <h2>Review links</h2>
      <ul>${links}</ul>
    </section>
    <section>
      <h2>Walkthrough</h2>
      <ol>${steps}</ol>
    </section>
    <section>
      <h2>Remaining gates</h2>
      <ul>${gates}</ul>
    </section>
  </main>
</body>
</html>`;
}

function link(label: string, route: string, purpose: string): DemoShareLink {
  return Object.freeze({ label, route, purpose });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
