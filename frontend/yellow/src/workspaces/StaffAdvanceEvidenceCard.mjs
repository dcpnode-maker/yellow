/** @param {typeof import('react').createElement} h */
export function createStaffAdvanceEvidenceCard(h) {
  /** @param {import('./StaffAdvanceEvidenceCard.mjs').StaffAdvanceEvidenceCardProps} props */
  return function StaffAdvanceEvidenceCard({ deposit = null, contextLabel, evidenceState, unavailableReason, action, formattedAmounts }) {
    // Reset native disclosure when the represented record/context changes. A
    // caller can additionally remount by accepted-read generation for equal reads.
    const key = JSON.stringify([contextLabel, evidenceState, deposit, formattedAmounts]);
    const formatted = formattedAmounts && typeof formattedAmounts.requested === 'string' &&
      typeof formattedAmounts.captured === 'string' && typeof formattedAmounts.applied === 'string' &&
      typeof formattedAmounts.remaining === 'string' ? formattedAmounts : null;
    /** @param {string} text */
    const note = text => h('p', { className: 'advance-evidence__note' }, text);
    /** @param {string} label @param {string} amount @param {string} currency @param {string} [display] */
    const row = (label, amount, currency, display) => h('div', { className: 'advance-evidence__row', key: label },
      h('dt', null, label), h('dd', null, display === undefined ? `${amount} ${currency} minor units` : display));
    let content;
    if (evidenceState === 'unavailable') content = h('p', { className: 'advance-evidence__alert', role: 'alert' },
      `Evidence unavailable. ${unavailableReason || 'Read this request again through the existing caller.'}`);
    else if (!deposit) content = note('No advance request evidence returned.');
    else {
      /** @type {Readonly<Record<string,string>>} */
      const labels = { ready: 'Ready', processing: 'Processing', captured: 'Captured', declined: 'Declined', expired: 'Expired', revoked: 'Revoked' };
      content = h('div', null,
        h('p', { className: 'advance-evidence__state', role: 'status' },
          `${evidenceState === 'stale' ? 'Previously read request state' : 'Returned request state'}: ${labels[deposit.state] ?? deposit.state}`),
        note(formatted ? `Currency: ${deposit.currency}` : `Exact ${deposit.currency} minor units · currency precision not supplied`),
        h('dl', { className: 'advance-evidence__metrics' },
          row('Requested', deposit.amountMinor, deposit.currency, formatted?.requested),
          row('Captured', deposit.capturedMinor, deposit.currency, formatted?.captured),
          row('Applied to folio', deposit.appliedMinor, deposit.currency, formatted?.applied),
          row('Remaining captured liability', deposit.remainingMinor, deposit.currency, formatted?.remaining)),
        action === undefined || action === null ? null : h('div', { className: 'advance-evidence__action' }, action),
        h('details', { className: 'advance-evidence__details' }, h('summary', null, 'Details'),
          formatted ? h('div', { className: 'advance-evidence__raw' },
            note(`Exact currency: ${deposit.currency}`),
            note(`Requested evidence: ${deposit.amountMinor} ${deposit.currency} minor units`),
            note(`Captured evidence: ${deposit.capturedMinor} ${deposit.currency} minor units`),
            note(`Applied evidence: ${deposit.appliedMinor} ${deposit.currency} minor units`),
            note(`Remaining evidence: ${deposit.remainingMinor} ${deposit.currency} minor units`)) : null,
          note(`Request reference: ${deposit.requestId}`), note(`Operation reference: ${deposit.operationId}`),
          note(`Property: ${deposit.propertyName} · ${deposit.propertyNode}`),
          note(`Folio reference: ${deposit.folioReference} · ${deposit.folioId}`),
          note(`Generation: ${deposit.generation}`), note(`Recorded expiry: ${deposit.expiresAt}`),
          note('Request state is separate from room and check-in readiness. Opening a link does not prove capture. Captured deposit liability and folio application are separate.')));
    }
    return h('section', { key, className: 'advance-evidence', 'aria-label': 'Advance request evidence', 'data-evidence-state': evidenceState },
      h('h3', null, 'Advance request'), note(contextLabel),
      evidenceState === 'stale' ? h('p', { role: 'alert', className: 'advance-evidence__alert' }, 'Stale evidence · previously read values are historical. Read again before using them.') : null,
      content);
  };
}
