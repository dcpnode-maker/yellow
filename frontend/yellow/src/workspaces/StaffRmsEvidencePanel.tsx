import { createElement } from 'react';
import { createStaffRmsEvidencePanel } from './StaffRmsEvidencePanel.mjs';
import './rms-evidence.css';
export const StaffRmsEvidencePanel = createStaffRmsEvidencePanel(createElement);
export type { StaffRmsEvidencePanelProps } from './StaffRmsEvidencePanel.mjs';
