import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FolioActionPanel, FolioActionRibbon } from "../frontend/yellow/src/ui/FolioActionRibbon";

const source = await Bun.file("frontend/yellow/src/workspaces/FinanceWorkspace.tsx").text();
const ribbon = await Bun.file("frontend/yellow/src/ui/FolioActionRibbon.tsx").text();
const render = (locked = false, disabled = false) => renderToStaticMarkup(<FolioActionRibbon disabled={disabled}>
  <FolioActionPanel title="Post a charge" description="Configured charges" locked={locked}><input name="charge-draft" defaultValue="12500" /></FolioActionPanel>
  <FolioActionPanel title="Deposits" description="Captured deposits"><input name="deposit-draft" defaultValue="500" /></FolioActionPanel>
</FolioActionRibbon>);

test("closed action panels retain their drafts and explicit accessible ribbon controls", () => {
  const html = render();
  expect(html).toContain('role="group" aria-label="Bill actions"');
  expect(html).toContain('aria-label="Post a charge" aria-expanded="false"');
  expect(html).toContain('name="charge-draft" value="12500"');
  expect(html).toContain('name="deposit-draft" value="500"');
  expect(html).toContain('class="folio-action-panel" hidden=""');
  expect(html.match(/aria-controls=/g)?.length).toBe(4);
});

test("retained recovery forces its panel visible and locks ribbon navigation", () => {
  const html = render(true);
  expect(html).toContain('class="folio-action-panel" aria-label="Post a charge"');
  expect(html).toContain('aria-label="Post a charge" aria-expanded="true"');
  expect(html.match(/disabled=""/g)?.length).toBe(4);
  expect(ribbon).toContain('if (!navigationLocked) setSelected');
  expect(ribbon).toContain('const open = expanded || locked');
  expect(ribbon).toContain('{children}');
});

test("shared financial lease disables otherwise idle ribbon controls", () => {
  expect(render(false, true).match(/disabled=""/g)?.length).toBe(4);
  expect(source).toContain('<FolioActionRibbon disabled={financialNavigationLocked}>');
  expect(source).toContain('if (financialNavigationLocked || depositInteractionLocked() || !selectedReservationId) return;');
  expect(source).toContain('encodeURIComponent(selectedReservationId)');
});

test("guest finance does not require or render physical cash-custody capabilities", () => {
  expect(source).not.toContain('loadCashierSnapshot');
  expect(source).not.toContain('CashDrawerWorkbench');
  expect(source).not.toContain('cashier-snapshot');
  expect(source).toContain('queryFn: loadReservationBoard');
  expect(source).toContain('queryFn: () => loadReservation(selectedReservationId!)');
});

test("actual charge and immutable recovery guards survive presentation changes", () => {
  expect(source).toContain('if (!folio.data || !selectedOption || !canPost || !confirmed || posting || allocationLocked || depositInteractionLocked()) return;');
  expect(source).toContain('Retry same transfer and reconcile');
  expect(source).toContain('Retry and reconcile same transfer');
  expect(source).toContain('locked={allocationLocked}');
  expect(source).toContain('locked={depositLocked && additionalWindowLease.current === null && correctionLease.current === null}');
  expect(source).toContain('moneyExactMinor(folio.data.balanceMinor, folio.data.folio.currency)');
  expect(source.indexOf('<FolioActionRibbon')).toBeLessThan(source.indexOf('<FolioHistory key={`${propertyId}:${selectedReservationId}:${folio.data.folio.id}`}'));
});
