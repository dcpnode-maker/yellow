import { expect, test } from "bun:test";

const source = await Bun.file("frontend/yellow/src/workspaces/FinanceWorkspace.tsx").text();
const historySource = await Bun.file("frontend/yellow/src/ui/FolioHistory.tsx").text();
const css = await Bun.file("frontend/yellow/src/ui/folio-workbench.css").text();
const disclosure = await Bun.file("frontend/yellow/src/ui/FolioActionRibbon.tsx").text();

test("action disclosures keep command components mounted and expose retained recovery", () => {
  expect(disclosure).toContain("const open = expanded || locked");
  expect(disclosure).toContain('aria-expanded={open} aria-controls={id} disabled={locked || context.disabled}');
  expect(disclosure).toContain('hidden={!open} className="folio-action-content">{children}');
  expect(source).toContain('locked={allocationLocked}');
  expect(source).toContain('locked={receivableBusy || receivableAttemptUncertain}');
  expect(source).toContain('locked={depositLocked && additionalWindowLease.current === null && correctionLease.current === null}');
  expect(source).toContain('locked={posting}');
});

test("window cards retain exact identity and authoritative statement balances", () => {
  expect(source).toContain('aria-label="Bill windows"');
  expect(source).toContain('aria-pressed={selectedFolioId === item.folioId}');
  expect(source).toContain('posting || receivableBusy || receivableAttemptUncertain || allocationLocked || reservationDetailRefreshUnavailable || depositLocked');
  expect(source).toContain('selectFolio(item.folioId)');
  expect(source).toContain('moneyExactMinor(folio.data.balanceMinor, folio.data.folio.currency)');
  expect(source).toContain('moneyExactMinor(folio.data.stayTotalMinor, folio.data.folio.currency)');
  expect(source).not.toContain('aria-label="Folio windows"'); // no duplicate selector
  expect(source).toContain('<FolioHistory key={`${propertyId}:${selectedReservationId}:${folio.data.folio.id}`}');
  expect(historySource).toContain('<FolioStatementTable rows={visibleRows} currency={state.page.folio.currency} />');
});

test("the workspace retains explicit transfer and posting confirmations", () => {
  expect(source).toContain('No partial amount split');
  expect(source).toContain('!canPost || !confirmed || posting || depositLocked');
  expect(source).toContain('!allocationPreview || !allocationConfirmed');
  expect(source).toContain('Retry same transfer and reconcile');
  expect(source).toContain('Retry and reconcile same transfer');
  expect(source).toContain('acquireMutationLease={acquireDepositMutationLease}');
});

test("all bill navigation paths check retained financial operations before changing identity", () => {
  expect(source).toContain('const financialNavigationLocked = posting || openingReference || receivableBusy || receivableAttemptUncertain || allocationLocked || depositLocked');
  for (const name of ["selectReservation", "selectFolio"]) {
    const body = source.slice(source.indexOf(`const ${name} =`));
    expect(body.indexOf('if (financialNavigationLocked || depositInteractionLocked())')).toBeLessThan(body.indexOf('setSelected'));
  }
  const lookup = source.slice(source.indexOf('const openFolioReference ='), source.indexOf('const validAmount ='));
  expect(lookup).toContain('if (!reference || financialNavigationLocked || depositInteractionLocked()) return;');
  expect(lookup).toContain('onLifecycleBusyChange?.(true)');
  expect(lookup).toContain('onLifecycleBusyChange?.(false)');
  expect(lookup).toContain('resetAllocationDraft()');
  expect(lookup).toContain('setPostingClass("all")');
  expect(source).toContain('className="folio-command-panels" disabled={openingReference}');
});

test("finance presentation has bounded mobile tables and visible keyboard focus", () => {
  expect(css).toContain('.folio-table-scroll { overflow-x: auto; max-width: 100%');
  expect(css).toContain('@media (max-width: 600px)');
  expect(css).toContain('.folio-action-content[hidden] { display: none; }');
  expect(css).toContain(':focus-visible');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
});
