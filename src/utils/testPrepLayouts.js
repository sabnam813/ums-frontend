import { TEST_PREP_COLUMNS } from './testPrepColumns';

export const FIELD_DEFS = {
  date: { type: 'date', input: 'date', width: 110 },
  bookingDate: { type: 'date', input: 'date', width: 110, aliases: ['booking', 'dateofbooking'] },
  candidateName: { type: 'text', input: 'text', width: 160, required: true, aliases: ['name', 'candidate', 'studentname', 'fullname'] },
  associates: { type: 'text', input: 'associate', width: 150, aliases: ['associate', 'agent', 'referredby'] },
  examDate: { type: 'date', input: 'date', width: 110, aliases: ['exam', 'testdate', 'dateofexam'] },
  place: { type: 'text', input: 'suggest', width: 130, suggest: 'place', aliases: ['place', 'center', 'centre', 'location', 'testlocation', 'city', 'venue'] },
  module: { type: 'text', input: 'suggest', width: 120, optionsKey: 'module', suggest: 'module', aliases: ['testtype', 'type', 'examtype'] },
  ieltsModule: { type: 'text', input: 'select', width: 230, optionsKey: 'ieltsModule', aliases: ['module', 'ieltsmodule', 'mode'] },
  paymentStatus: { type: 'badge', input: 'select', width: 120, optionsKey: 'paymentStatus', aliases: ['payment', 'paymentstatus', 'paid', 'status'] },
  paymentMadeBy: { type: 'text', input: 'suggest', width: 140, suggest: 'paymentMadeBy', aliases: ['paidby', 'paymentby'] },
  paymentDate: { type: 'date', input: 'date', width: 110, aliases: ['dateofpayment'] },
  paymentAmount: { type: 'currency', input: 'number', width: 120, aliases: ['receivedamount', 'amount', 'fee', 'examfee', 'paymentamount', 'costamount'] },
  margin: { type: 'currency', input: 'number', width: 100, aliases: ['profit', 'commission'] },
  accountsDate: { type: 'date', input: 'date', width: 120, aliases: ['accountdate', 'accountsdate', 'receiptdate'] },
  receivedAmount: { type: 'currency', input: 'number', width: 120, aliases: ['received', 'amountreceived', 'receivedamount'] },
  cost: { type: 'currency', input: 'number', width: 100, aliases: ['examcost', 'totalcost'] },
  referenceNumber: { type: 'text', input: 'text', width: 150, aliases: ['reference', 'refno', 'refnumber', 'referencenumber'] },
  passportNo: { type: 'text', input: 'text', width: 140, aliases: ['passport', 'passportno', 'passportnumber'] },
  expiryDate: { type: 'date', input: 'date', width: 110, aliases: ['expiry', 'expirydate', 'validuntil'] },
  duolingoVoucher: { type: 'text', input: 'text', width: 140, aliases: ['voucher', 'duolingovoucher', 'vouchercode', 'coupon'] },
  remarks: { type: 'text', input: 'textarea', width: 180, aliases: ['notes', 'comment', 'comments', 'remarks'] },
};

export const LAYOUTS = {
  ielts: {
    columns: [
      ['bookingDate'], ['candidateName', 'Student Name'], ['associates', 'Associates'], ['examDate'], ['place', 'Test Location'],
      ['module', 'Test Type'], ['ieltsModule', 'Module'], ['paymentStatus', 'Payment Status'], ['paymentMadeBy', 'Payment Made By'],
      ['paymentAmount', 'Received Amount'], ['margin', 'Margin'], ['accountsDate', 'Accounts Date'], ['remarks', 'Remarks'],
    ],
    formOnly: [['referenceNumber', 'Reference Number'], ['passportNo', 'Passport No.']],
    totals: [['paymentAmount', 'Total Received'], ['margin', 'Total Margin']],
    multiFilters: ['paymentStatus', 'module', 'ieltsModule'],
    defaultSort: { key: 'bookingDate', dir: 'desc' },
  },
  duolingo: {
    columns: [
      ['bookingDate'], ['candidateName', 'Student Name'], ['associates', 'Associates'], ['receivedAmount', 'Received Amount'],
      ['paymentDate', 'Payment Date'], ['paymentStatus', 'Payment Status'], ['cost', 'Cost'], ['margin', 'Margin'], ['duolingoVoucher', 'Voucher'], ['remarks', 'Remarks'],
    ],
    formOnly: [],
    totals: [['receivedAmount', 'Total Received'], ['cost', 'Total Cost'], ['margin', 'Total Margin']],
    multiFilters: ['paymentStatus', 'duolingoVoucher'],
    defaultSort: { key: 'bookingDate', dir: 'desc' },
  },
  pte: {
    columns: [
      ['bookingDate'], ['candidateName', 'Student Name'], ['associates', 'Associate'], ['examDate'], ['place', 'Test Location'],
      ['referenceNumber', 'Reference Number'], ['paymentStatus', 'Payment Status'], ['expiryDate', 'Expiry Date'], ['paymentAmount', 'Cost Amount'],
      ['paymentDate', 'Payment Date'], ['receivedAmount', 'Received Amount'], ['margin', 'Margin'], ['remarks', 'Remarks'],
    ],
    formOnly: [],
    totals: [['paymentAmount', 'Total Amount'], ['receivedAmount', 'Total Received'], ['margin', 'Total Margin']],
    multiFilters: ['paymentStatus'],
    defaultSort: { key: 'bookingDate', dir: 'desc' },
  },
  default: {
    columns: [
      ['bookingDate'], ['candidateName', 'Candidate Name'], ['associates', 'Associates'], ['examDate'], ['module', 'Module'], ['place', 'Place'],
      ['paymentStatus', 'Payment Status'], ['paymentMadeBy', 'Payment Made By'], ['paymentDate', 'Payment Date'],
      ['paymentAmount', 'Payment Amount'], ['margin', 'Margin'], ['referenceNumber', 'Reference Number'], ['receivedAmount', 'Received Amount'],
      ['cost', 'Cost'], ['expiryDate', 'Expiry Date'], ['remarks', 'Remarks'],
    ],
    formOnly: [],
    totals: [['paymentAmount', 'Total Payment'], ['margin', 'Total Margin'], ['receivedAmount', 'Total Received'], ['cost', 'Total Cost']],
    multiFilters: ['paymentStatus', 'module'],
    defaultSort: { key: 'bookingDate', dir: 'desc' },
  },
};

export function layoutKeyFor(testTypeName) {
  const n = String(testTypeName || '').trim().toLowerCase();
  if (/ielts/.test(n)) return 'ielts';
  if (/duolingo/.test(n)) return 'duolingo';
  if (/pte/.test(n)) return 'pte';
  return 'default';
}

export function layoutFor(testTypeName) {
  const key = layoutKeyFor(testTypeName);
  return { key, ...LAYOUTS[key] };
}

const BASE_LABELS = Object.fromEntries(TEST_PREP_COLUMNS.map(c => [c.key, c.label]));

function build(entry) {
  const [key, label] = entry;
  const def = FIELD_DEFS[key] || { type: 'text', input: 'text', width: 120 };
  return {
    key,
    label: label || BASE_LABELS[key] || key,
    type: def.type,
    input: def.input,
    width: def.width,
    sortable: true,
    required: !!def.required,
    optionsKey: def.optionsKey,
    suggest: def.suggest,
    aliases: def.aliases || [],
  };
}

export function layoutColumns(layout) {
  return layout.columns.map(build);
}

export function layoutFormFields(layout) {
  const all = [...layout.columns, ...(layout.formOnly || [])];
  return [...all.filter(e => e[0] !== 'remarks'), ...all.filter(e => e[0] === 'remarks')].map(build);
}

export function layoutImportFields(layout) {
  return layoutFormFields(layout).map(f => ({ key: f.key, label: f.label, aliases: f.aliases }));
}

export function layoutDateKeys(layout) {
  return layoutFormFields(layout).filter(f => f.type === 'date').map(f => f.key).concat(['date']);
}
