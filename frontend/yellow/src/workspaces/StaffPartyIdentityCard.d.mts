import type { createElement, ReactElement, ReactNode } from 'react';
import type { PartyProfile } from '../yellow-api';
export type StaffPartyIdentityCardProps = Readonly<{
  profile?: PartyProfile | null;
  contextLabel: string;
  evidenceState: 'current' | 'stale' | 'unavailable';
  action?: ReactNode;
}>;
export function createStaffPartyIdentityCard(h: typeof createElement): (props: StaffPartyIdentityCardProps) => ReactElement;
