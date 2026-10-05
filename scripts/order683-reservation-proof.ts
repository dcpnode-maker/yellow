// Read-only live evidence probe: no reservation, Party or inventory write.
import { reservationOfferTerms } from "../frontend/yellow/src/reservation-create";
const origin = "http://127.0.0.1:3010";
const auth = await fetch(`${origin}/api/v1/auth/demo:enter`, { method: "POST", headers: { "content-type": "application/json" } });
const session = await auth.json() as { accessToken?: string };
if (!auth.ok || !session.accessToken) throw new Error("Local review session unavailable");
const query = { stay: { from: "2026-09-25T12:00:00.000Z", to: "2026-09-27T08:00:00.000Z" }, party: { adults: 1, children: [] }, channel: "direct" };
async function search() {
  const response = await fetch(`${origin}/api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/availability:search`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error(`Offer search HTTP ${response.status}`);
  return (await response.json() as { options: Record<string, unknown>[] }).options;
}
const first = await search();
const second = await search();
const comparisons = first.filter(item => item.bookable).map(item => {
  const selected = item.sellable_unit as { id: string };
  const plan = item.rate_plan as { id: string };
  const next = second.find(candidate => (candidate.sellable_unit as { id: string }).id === selected.id && (candidate.rate_plan as { id: string }).id === plan.id);
  return { room: (item.sellable_unit as { name: string }).name, match: Boolean(next),
    oldReferenceComparison: next ? item.option_ref === next.option_ref : false,
    sameCommercialTerms: next ? reservationOfferTerms(item) === reservationOfferTerms(next) : false,
    sameTotal: next ? JSON.stringify(item.total) === JSON.stringify(next.total) : false,
    sameStay: next ? JSON.stringify(item.stay) === JSON.stringify(next.stay) : false };
});
console.log(JSON.stringify({ firstCount: first.length, secondCount: second.length, comparisons }, null, 2));
