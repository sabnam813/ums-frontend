export const INQUIRY_COLUMNS = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'referredBy', label: 'Referred By', type: 'text' },
  { key: 'applicantName', label: 'Name of Applicant', type: 'text', required: true },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'level', label: 'Level', type: 'text' },
  { key: 'stage', label: 'Stage', type: 'text' },
  { key: 'mode', label: 'Mode / Channel', type: 'text' },
  { key: 'respondedBy', label: 'Responded By', type: 'text' },
  { key: 'emailType', label: 'Email Type', type: 'text' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

export const DEFAULT_VISIBLE_INQUIRY_COLUMN_KEYS = INQUIRY_COLUMNS.map(c => c.key);

export const INQUIRY_COLUMN_SELECTION_STORAGE_KEY = 'ums_inquiries_export_columns';
