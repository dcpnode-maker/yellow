/** Pure presentation of caller-admitted RMS evidence. No evaluator, transport or command. */
/** @param {typeof import('react').createElement} h */
export function createStaffRmsEvidencePanel(h) {
  /** @param {import('./StaffRmsEvidencePanel.mjs').StaffRmsEvidencePanelProps} props */
  return function StaffRmsEvidencePanel({ view, contextLabel, evidenceState, unavailableReason, builder = null, quote = null, economics = null }) {
    const selected = view === 'models' ? builder : view === 'quote' ? quote : economics;
    const title = view === 'models' ? 'Rate models' : view === 'quote' ? 'Quote evidence' : 'Recorded economics';
    // Changed context/view/freshness/evidence remounts native disclosures. Caller may
    // additionally key its component by accepted-read generation for identical reads.
    const key = JSON.stringify([view, contextLabel, evidenceState, selected]);
    /** @param {import('react').ReactNode[]} children @param {string} [className] */
    const details = (children, className = '') => h('details', { className: `rms-evidence__details ${className}` }, h('summary', null, 'Details'), ...children);
    /** @param {string} text */
    const note = text => h('p', { className: 'rms-evidence__note' }, text);
    /** @param {string|null|undefined} amount @param {string} currency */
    const money = (amount, currency) => amount === null || amount === undefined ? 'Not returned' : `${amount} ${currency} minor units`;
    /** @param {string} label @param {string} value */
    const row = (label, value) => h('div', { key: label, className: 'rms-evidence__row' }, h('dt', null, label), h('dd', null, value));
    let content;
    if (evidenceState === 'unavailable') content = h('p', { className: 'rms-evidence__alert', role: 'alert' }, `Evidence unavailable. ${unavailableReason || 'Use the existing read control to request current evidence.'}`);
    else if (selected === null) content = note(`No ${view === 'models' ? 'model' : view === 'quote' ? 'quote' : 'recorded economics'} evidence returned.`);
    else if (view === 'models' && builder) {
      content = h('div', null,
        note(`${builder.modelDraftCount} model drafts · ${builder.targetDraftCount} target drafts · ${builder.releaseCount} releases returned`),
        builder.releaseCount === 0 ? note('No release evidence returned for this plan.') : null,
        builder.catalogue.length === 0 ? note('No models in the returned catalogue.') : null,
        h('ul', { className: 'rms-evidence__models' }, ...builder.catalogue.map(model => h('li', { key: model.key, className: 'rms-evidence__model' },
          h('strong', null, model.label || 'Model label not returned'),
          note(model.description || 'Description not returned'),
          h('span', { className: 'rms-evidence__version' }, `Version ${model.version}`),
          details([
            note(`Model reference: ${model.key}`),
            note(model.capabilities.length ? `Returned capabilities: ${model.capabilities.join(' · ')}` : 'No capabilities returned.'),
          ])))),
        details([note('Drafts and releases are returned records, not published price promises. Influencing weights and forecasting evidence are not returned.')], 'rms-evidence__supporting'));
    } else if (view === 'quote' && quote) {
      /** @type {readonly (readonly [string,string])[]} */
      const labels = [
        ['roomAmountMinor', 'Room amount'], ['includedAllocationMinor', 'Included allocation'],
        ['packageExtraMinor', 'Package extra'], ['promotionDiscountMinor', 'Promotion discount'],
        ['preTaxSubtotalMinor', 'Pre-tax subtotal'],
      ];
      /** @type {Readonly<Record<string,string>>} */
      const stateLabels = { quoted: 'Quoted', blocked: 'Blocked', unpriced: 'Unpriced', conflict: 'Conflict' };
      const stateLabel = stateLabels[quote.state] ?? `Recorded state: ${quote.state}`;
      content = h('div', null,
        h('p', { className: 'rms-evidence__quote-state', role: 'status' }, `${evidenceState === 'stale' ? 'Previously read quote' : 'Returned quote'}: ${stateLabel}`),
        quote.reason === null ? note('Reason not returned.') : h('p', { className: 'rms-evidence__reason' }, quote.reason === '' ? 'Reason is an empty recorded value.' : quote.reason),
        note(`Exact ${quote.currency} minor units · currency precision not supplied`),
        h('dl', { className: 'rms-evidence__metrics' }, ...labels.map(([field, label]) => row(label, money(quote.components[field], quote.currency)))),
        details([
          note(`Quote reference: ${quote.quoteHash ?? 'Not returned'}`),
          note(`Tax assignment: ${quote.taxAssignmentState ?? 'Not returned'}`),
          note('Components and subtotal are returned independently; no sum, discount or tax calculation is performed here. A quote is not a reservation or published price promise.'),
        ], 'rms-evidence__supporting'));
    } else if (view === 'economics' && economics) {
      content = h('div', null,
        note(`${economics.name} · Property-local business date ${economics.businessDate}`),
        note(`Exact ${economics.currency} minor units · currency precision not supplied`),
        h('dl', { className: 'rms-evidence__metrics' },
          row('Room nights', String(economics.roomNights)), row('Rooms available', String(economics.roomsAvailable)),
          row('Recorded occupancy', `${economics.occupancyBasisPoints} basis points`),
          row('Room revenue', money(economics.roomRevenueMinor, economics.currency)),
          row('ADR', money(economics.adrMinor, economics.currency)), row('RevPAR', money(economics.revparMinor, economics.currency))),
        details([note('Source: stats_daily_commercial_taxonomy. These are recorded economics, not a demand forecast. No ratio, commission, cost, tax or net profit is inferred.')], 'rms-evidence__supporting'));
    }
    return h('section', { key, className: 'rms-evidence', 'aria-label': title, 'data-evidence-state': evidenceState },
      h('h3', null, title), note(contextLabel),
      evidenceState === 'stale' ? h('p', { className: 'rms-evidence__alert', role: 'alert' }, 'Stale evidence · previously read values are historical. Read again before using them.') : null,
      content);
  };
}
