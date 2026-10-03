import type { createElement, ReactElement } from 'react';
import type { ProgressSnapshot } from '../housekeeping-progress.mjs';
export type HousekeepingProgressPanelProps = Readonly<{ snapshot: ProgressSnapshot; now: string; timezone: string }>;
export function createHousekeepingProgressPanel(h: typeof createElement): (props: HousekeepingProgressPanelProps) => ReactElement;
