/** @param {typeof import('react').createElement} h */
export function createStaffPartyIdentityCard(h) {
  /** @param {import('./StaffPartyIdentityCard.mjs').StaffPartyIdentityCardProps} props */
  return function StaffPartyIdentityCard({ profile = null, contextLabel, evidenceState, action }) {
    // Equal accepted reads can additionally be remounted by the parent generation.
    const key = JSON.stringify([contextLabel, evidenceState, profile]);
    /** @param {string | null | undefined} value */
    const text = value => value === undefined ? 'Not returned' : value === null ? 'Null returned' : value === '' ? 'Empty value returned' : value;
    /** @param {string} value */
    const note = value => h('p', { className: 'party-identity__note' }, value);
    /** @param {string} label @param {import('react').ReactNode} value */
    const row = (label, value) => h('div', { className: 'party-identity__row', key: label },
      h('dt', null, label), h('dd', null, value));
    const available = evidenceState !== 'unavailable' && profile !== null;
    const heading = available && profile.kind === 'person' ? 'Person identity' :
      available && profile.kind === 'org' ? 'Organisation identity' : 'Party identity';
    let content;
    if (evidenceState === 'unavailable') content = h('p', { role: 'alert', className: 'party-identity__alert' }, 'Party identity unavailable. Read again through the existing caller.');
    else if (!profile) content = note('No Party profile returned.');
    else {
      const roles = Array.isArray(profile.roles) ? profile.roles : null;
      const contacts = Array.isArray(profile.contacts) ? profile.contacts : null;
      content = h('div', null,
        h('p', { className: 'party-identity__name' }, text(profile.displayName)),
        h('dl', { className: 'party-identity__fields' },
          row('Legal name', text(profile.legalName)),
          row('Kind', text(profile.kind)),
          row('Status', text(profile.status)),
          row('Roles', roles === null ? 'Roles not returned' : roles.length === 0 ? 'No roles returned' :
            h('ol', { className: 'party-identity__roles' }, roles.map((role, index) => h('li', { key: index }, text(role)))))),
        action === undefined || action === null ? null : h('div', { className: 'party-identity__action' }, action),
        h('details', { className: 'party-identity__details' },
          h('summary', null, contacts === null ? 'Contact hints (not returned)' : `Contact hints (${contacts.length} rows)`),
          contacts === null ? note('Contact hints not returned.') : contacts.length === 0 ? note('No contact hints returned.') :
            h('ol', { className: 'party-identity__contacts' }, contacts.map((contact, index) => h('li', { key: index },
              h('dl', { className: 'party-identity__fields' },
                row('Kind', text(contact.kind)), row('Hint', text(contact.hint))))))),
        h('details', { className: 'party-identity__details party-identity__references' },
          h('summary', null, 'References'), note(`Party reference: ${text(profile.partyId)}`)));
    }
    return h('section', { key, className: 'party-identity', 'aria-label': 'Canonical Party identity', 'data-evidence-state': evidenceState },
      h('h3', null, heading), note(contextLabel),
      evidenceState === 'stale' ? h('p', { role: 'alert', className: 'party-identity__alert' }, 'Stale identity · previously read values are historical. Read again before using them.') : null,
      content);
  };
}
