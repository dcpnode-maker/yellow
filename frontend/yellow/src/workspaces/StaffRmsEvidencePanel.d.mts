import type { createElement, ReactElement } from 'react';
import type { StaffRateBuilder, StaffRateQuote, StaffEconomics } from './staff-rms-client';
export type StaffRmsEvidencePanelProps = Readonly<{
  view: 'models' | 'quote' | 'economics'; contextLabel: string;
  evidenceState: 'current' | 'stale' | 'unavailable'; unavailableReason?: string;
  builder?: StaffRateBuilder | null; quote?: StaffRateQuote | null; economics?: StaffEconomics | null;
}>;
export function createStaffRmsEvidencePanel(h: typeof createElement): (props: StaffRmsEvidencePanelProps) => ReactElement;
