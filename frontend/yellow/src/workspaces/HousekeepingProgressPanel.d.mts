import type { createElement, ReactElement, ReactNode } from 'react';
import type { HousekeepingTaskRow } from '../housekeeping-floor-model';
import type { ProgressSnapshot } from '../housekeeping-progress.mjs';
export type HousekeepingProgressPanelProps = Readonly<{ snapshot: ProgressSnapshot; now: string; timezone: string;
  selectedTaskId?: string; onSelectTask?: (task: HousekeepingTaskRow) => void;
  renderTaskControls?: (task: HousekeepingTaskRow) => ReactNode; disabled?: boolean }>;
export function createHousekeepingProgressPanel(h: typeof createElement): (props: HousekeepingProgressPanelProps) => ReactElement;
