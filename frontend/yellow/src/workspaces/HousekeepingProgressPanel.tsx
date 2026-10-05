import { createElement } from 'react';
import { createHousekeepingProgressPanel } from './HousekeepingProgressPanel.mjs';
import './housekeeping-progress.css';

// Target integration: workspaces/HousekeepingProgressPanel.tsx after independent acceptance.
export const HousekeepingProgressPanel = createHousekeepingProgressPanel(createElement);
