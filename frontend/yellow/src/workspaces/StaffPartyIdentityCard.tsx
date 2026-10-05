import { createElement } from 'react';
import { createStaffPartyIdentityCard } from './StaffPartyIdentityCard.mjs';
import './party-identity.css';
export const StaffPartyIdentityCard = createStaffPartyIdentityCard(createElement);
export type { StaffPartyIdentityCardProps } from './StaffPartyIdentityCard.mjs';
