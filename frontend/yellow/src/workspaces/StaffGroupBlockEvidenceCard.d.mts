import type { createElement, ReactElement, ReactNode } from 'react';
import type { loadGroupBlocks } from '../yellow-api';
export type StaffGroupBlockEvidence = Awaited<ReturnType<typeof loadGroupBlocks>>['groups'][number];
export type StaffGroupBlockEvidenceCardProps = Readonly<{
  group?: StaffGroupBlockEvidence | null;
  contextLabel: string;
  evidenceState: 'current' | 'stale' | 'unavailable';
  unavailableReason?: string;
  reservationLinks?: Readonly<Record<string, ReactNode>>;
  masterFolioLink?: ReactNode;
}>;
export function createStaffGroupBlockEvidenceCard(h: typeof createElement): (props: StaffGroupBlockEvidenceCardProps) => ReactElement;
