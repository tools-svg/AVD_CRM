import { WorkPriority, WorkStatus } from '../types';

export const THEME_COLORS = {
  background: '#EBE5E5',
  card: '#E8E4E4',
  surface: '#F5F3F4',
  white: '#FFFFFF',
  primaryButton: '#0A0A0A',
  progressBar: '#333333',
  primaryText: '#333333',
  secondaryText: '#888888',
  border: '#E1DCDC',
};

export const STATUS_CONFIG: Record<WorkStatus, { bg: string; text: string; label: string }> = {
  'Not Started': { bg: '#E8E8E8', text: '#666666', label: 'Not Started' },
  'In Progress': { bg: '#DCE4FA', text: '#5269A8', label: 'In Progress' },
  'Review':      { bg: '#F4E9D2', text: '#A78645', label: 'Review' },
  'On Hold':     { bg: '#F3E4D1', text: '#A87945', label: 'On Hold' },
  'Closed':      { bg: '#D9EEE5', text: '#43866B', label: 'Closed' },
  'Cancelled':   { bg: '#F5DEDE', text: '#B65F65', label: 'Cancelled' },
};

export const PRIORITY_CONFIG: Record<WorkPriority, { bg: string; text: string; label: string }> = {
  'Low':    { bg: '#E4E9E5', text: '#6B8674', label: 'Low' },
  'Medium': { bg: '#F4E9D2', text: '#A78645', label: 'Medium' },
  'High':   { bg: '#F2DADA', text: '#B65F65', label: 'High' },
  'Urgent': { bg: '#F5D5D5', text: '#A93232', label: 'Urgent' },
};

export const RADIUS_TOKENS = {
  card: '14px',      // Cards & structured containers
  modal: '18px',     // Modals & overlay dialogs
  button: '10px',    // Action buttons & pills
  input: '10px',     // Form inputs & selects
  popover: '12px',   // Dropdowns & popover menus
  preview: '14px',   // Dual preview panels
  logo: '2%',        // Main company logo container (Section 2.1)
  badge: '9999px',   // Badges & pill indicators
};

export const STICKY_COLORS = [
  '#F4E9D2', // Peach/amber
  '#DCE4FA', // Soft Blue
  '#D9EEE5', // Soft Sage Green
  '#F5DEDE', // Soft Rose Pink
  '#EBE5E5', // Soft Slate
  '#EDE9FE', // Soft Lavender
];

