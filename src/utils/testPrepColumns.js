
export const TEST_PREP_COLUMNS = [
  { key: 'date', label: 'Date', width: 110, type: 'date', sortable: true },
  { key: 'candidateName', label: 'Candidate Name', width: 150, type: 'text', searchable: true, sortable: true, required: true },
  { key: 'associates', label: 'Associates', width: 120, type: 'text', searchable: true, sortable: true },
  { key: 'bookingDate', label: 'Booking Date', width: 110, type: 'date', sortable: true },
  { key: 'examDate', label: 'Exam Date', width: 110, type: 'date', sortable: true },
  { key: 'testTypeName', label: 'Test Type', width: 100, type: 'text', computed: true, sortable: false },
  { key: 'module', label: 'Module', width: 90, type: 'text', searchable: false, sortable: true },
  { key: 'place', label: 'Place', width: 110, type: 'text', searchable: true, sortable: true },
  { key: 'paymentStatus', label: 'Payment', width: 100, type: 'badge', sortable: true },
  { key: 'paymentMadeBy', label: 'Payment Made By', width: 130, type: 'text', searchable: true, sortable: true },
  { key: 'paymentDate', label: 'Payment Date', width: 110, type: 'date', sortable: true },
  { key: 'paymentAmount', label: 'Payment Amount', width: 120, type: 'currency', sortable: true },
  { key: 'margin', label: 'Margin', width: 100, type: 'currency', sortable: true },
  { key: 'paymentDateToBC', label: 'Payment Date to BC', width: 130, type: 'date', sortable: true },
  { key: 'paidAmountToBC', label: 'Paid Amount to BC', width: 130, type: 'currency', sortable: true },
  { key: 'referenceNumber', label: 'Reference Number', width: 130, type: 'text', searchable: true, sortable: true },
  { key: 'receivedAmount', label: 'Received Amount', width: 120, type: 'currency', sortable: true },
  { key: 'cost', label: 'Cost', width: 100, type: 'currency', sortable: true },
  { key: 'voucher', label: 'Voucher', width: 120, type: 'text', searchable: true, sortable: true },
  { key: 'duolingoVoucher', label: 'Duolingo Voucher', width: 140, type: 'text', searchable: true, sortable: true },
  { key: 'expiryDate', label: 'Expiry Date', width: 110, type: 'date', sortable: true },
  { key: 'remarks', label: 'Remarks', width: 180, type: 'text', searchable: true, sortable: true },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS = TEST_PREP_COLUMNS.map(c => c.key);

export const SEARCHABLE_COLUMN_KEYS = TEST_PREP_COLUMNS.filter(c => c.searchable).map(c => c.key);

export function getColumnByKey(key) {
  return TEST_PREP_COLUMNS.find(c => c.key === key) || null;
}

export const COLUMN_SELECTION_STORAGE_KEY = 'ums_testprep_export_columns';

export function customFieldToColumn(def) {
  const typeMap = { text: 'text', date: 'date', dropdown: 'text' };
  return {
    key: `custom:${def.key}`,
    label: def.label,
    width: 130,
    type: typeMap[def.type] || 'text',
    searchable: def.type === 'text' || def.type === 'dropdown',
    sortable: true,
    custom: true,
    fieldType: def.type,
    options: def.options || [],
    required: !!def.required,
  };
}

export function getAllColumns(customFieldDefs = []) {
  return [...TEST_PREP_COLUMNS, ...customFieldDefs.map(customFieldToColumn)];
}

export function loadRememberedColumns(allColumns = TEST_PREP_COLUMNS) {
  try {
    const raw = window.sessionStorage.getItem(COLUMN_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const validKeys = new Set(allColumns.map(c => c.key));
    const filtered = parsed.filter(k => validKeys.has(k));
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
}

export function saveRememberedColumns(keys) {
  try {
    window.sessionStorage.setItem(COLUMN_SELECTION_STORAGE_KEY, JSON.stringify(keys));
  } catch {
  }
}
