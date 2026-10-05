import type { createElement, ReactElement, ReactNode } from 'react';
import type { HostedDepositStatus } from '../yellow-api';
export type StaffAdvanceFormattedAmounts = Readonly<{
  requested: string;
  captured: string;
  applied: string;
  remaining: string;
}>;
export type StaffAdvanceEvidenceCardProps = Readonly<{
  deposit?: HostedDepositStatus | null;
  contextLabel: string;
  evidenceState: 'current' | 'stale' | 'unavailable';
  unavailableReason?: string;
  action?: ReactNode;
  formattedAmounts?: StaffAdvanceFormattedAmounts;
}>;
export function createStaffAdvanceEvidenceCard(h: typeof createElement): (props: StaffAdvanceEvidenceCardProps) => ReactElement;
