import type { StaffPartyIdentityCardProps } from './StaffPartyIdentityCard.mjs';
import type { loadPartyStayHistory } from '../yellow-api';

export type StaffPartyProfile = NonNullable<StaffPartyIdentityCardProps['profile']>;
type NativeStay = NonNullable<Awaited<ReturnType<typeof loadPartyStayHistory>>['reservations']>[number];
export type StaffPartyStay = Readonly<Required<Pick<NativeStay, 'reservationId' | 'primaryPartyId' | 'confirmationNo' |
  'status' | 'operationalState' | 'stayFrom' | 'stayTo' | 'unitTypeLabel' | 'ratePlanLabel'>> & { sellableUnitLabel: string | null }>;
