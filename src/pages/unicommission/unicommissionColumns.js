export const COLUMNS = [
  { key: 'sn', label: 'SN', type: 'number', width: 60, sticky: true, virtual: true },
  { key: 'studentName', label: 'Students Name', type: 'text', width: 220, sticky: true, required: true },
  { key: 'country', label: 'Country', type: 'text', width: 110, virtual: true },
  { key: 'associate', label: 'Associates', type: 'text', width: 150 },
  { key: 'intake', label: 'Intake', type: 'intake', width: 100 },
  { key: 'university', label: 'University', type: 'text', width: 230 },
  { key: 'level', label: 'Level', type: 'text', width: 90 },
  { key: 'course', label: 'Course', type: 'text', width: 240 },
  { key: 'commissionProvider', label: 'Commission Provider', type: 'text', width: 150 },
  { key: 'feeAmount', label: 'Fee Amount', type: 'amount', width: 120 },
  { key: 'studentIdNo', label: 'Student ID No', type: 'text', width: 140 },
  { key: 'visaGrantedDate', label: 'Visa Granted Date', type: 'date', width: 130 },
  { key: 'commissionRule', label: 'Commission Rate', type: 'text', width: 130, virtual: true },
  { key: 'commissionAmount', label: 'Commission', type: 'amount', width: 120, virtual: true },
  { key: 'paymentStatus', label: 'Payment Status', type: 'text', width: 120 },
  { key: 'remarks', label: 'Remarks', type: 'text', width: 200 },
  { key: 'source', label: 'Source', type: 'text', width: 150, virtual: true },
];

export const STICKY_COLUMNS = COLUMNS.filter(c => c.sticky);
export const CHECK_COL_WIDTH = 42;

export function stickyOffsets() {
  const out = {};
  let left = CHECK_COL_WIDTH;
  STICKY_COLUMNS.forEach(c => { out[c.key] = left; left += c.width; });
  return out;
}

export const PAYMENT_STATUSES = ['Pending', 'Partial', 'Received'];
export const LEVEL_SUGGESTIONS = ['UG', 'PG', 'Diploma', 'Certificate', 'PhD'];
export const CURRENCY_SUGGESTIONS = ['USD', 'GBP', 'AUD', 'CAD', 'NZD', 'EUR', 'NPR', 'INR', 'AED', 'SGD', 'JPY', 'CHF', 'MYR'];

export const IMPORT_FIELDS = [
  { key: 'sn', label: 'SN (not imported)', aliases: ['sn', 'sno', 'srno', 'serialno', 'no', 's.n'] },
  { key: 'studentName', label: 'Students Name', aliases: ['studentsname', 'studentname', 'nameofstudent', 'name', 'student', 'students'] },
  { key: 'associate', label: 'Associates', aliases: ['associates', 'associate', 'agent', 'referredby', 'consultancy'] },
  { key: 'intake', label: 'Intake', aliases: ['intake', 'intakedate', 'intakemonth'] },
  { key: 'university', label: 'University', aliases: ['university', 'universityname', 'college', 'institution'] },
  { key: 'level', label: 'Level', aliases: ['level', 'ugpg', 'ug/pg', 'studylevel'] },
  { key: 'course', label: 'Course', aliases: ['course', 'program', 'programme', 'coursename'] },
  { key: 'commissionProvider', label: 'Commission Provider', aliases: ['commissionprovider', 'provider', 'commissionfrom', 'payer'] },
  { key: 'feeAmount', label: 'Fee Amount', aliases: ['feeamount', 'fee', 'fees', 'tuitionfee', 'amount'] },
  { key: 'studentIdNo', label: 'Student ID No', aliases: ['studentidno', 'studentid', 'studentno', 'idno', 'id'] },
  { key: 'visaGrantedDate', label: 'Visa Granted Date', aliases: ['visagranteddate', 'visadate', 'visagranted', 'granteddate'] },
  { key: 'currency', label: 'Currency', aliases: ['currency', 'cur'] },
  { key: 'commissionType', label: 'Commission Type', aliases: ['commissiontype', 'ratetype'] },
  { key: 'commissionValue', label: 'Commission Rate / Value', aliases: ['commissionrate', 'commissionvalue', 'rate', 'commissionpercent', 'commission'] },
  { key: 'paymentStatus', label: 'Payment Status', aliases: ['paymentstatus', 'status', 'receivestatus', 'received'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'remark', 'notes', 'note', 'comment', 'comments'] },
];

export const EXPORT_COLUMNS = COLUMNS.map(c => ({ key: c.key, label: c.label, required: c.key === 'studentName' }));
export const DEFAULT_EXPORT_KEYS = COLUMNS.filter(c => c.key !== 'source').map(c => c.key);

export function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function fmtNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function fmtMoney(amount, currency) {
  const n = fmtNumber(amount);
  if (!n) return '';
  return currency ? `${currency} ${n}` : n;
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function intakeSortValue(s) {
  const m = String(s || '').trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (!m) return 0;
  const mon = MON.indexOf(m[1].toLowerCase());
  return mon < 0 ? 0 : Number(m[2]) * 12 + mon;
}

export function sourceLabel(row) {
  if (row.sourceFlag === 'not_granted') return 'Visa no longer granted';
  if (row.sourceFlag === 'application_deleted') return 'Application deleted';
  return row.isManual ? 'Manual' : 'From application';
}

export function ruleLabel(type, value, currency) {
  if (value === null || value === undefined || value === '') return '';
  return type === 'percentage' ? `${fmtNumber(value)}%` : fmtMoney(value, currency) || fmtNumber(value);
}

export function cellValue(row, key, ctx = {}) {
  switch (key) {
    case 'sn': return ctx.index ?? '';
    case 'country': return ctx.countryName || '';
    case 'feeAmount': return fmtMoney(row.feeAmount, row.currencyEff);
    case 'visaGrantedDate': return fmtDate(row.visaGrantedDate) || row.visaGrantedDateText || '';
    case 'commissionRule': return ruleLabel(row.commissionTypeEff, row.commissionValueEff, row.currencyEff);
    case 'commissionAmount': return fmtMoney(row.commissionAmount, row.currencyEff);
    case 'source': return sourceLabel(row);
    default: {
      const v = row[key];
      return v === undefined || v === null ? '' : String(v);
    }
  }
}

export function sortValue(row, col, ctx = {}) {
  switch (col.key) {
    case 'sn': return ctx.position ?? 0;
    case 'feeAmount': return Number(row.feeAmount) || 0;
    case 'commissionAmount': return Number(row.commissionAmount) || 0;
    case 'visaGrantedDate': return row.visaGrantedDate ? new Date(row.visaGrantedDate).getTime() : 0;
    case 'intake': return intakeSortValue(row.intake);
    default: return cellValue(row, col.key, ctx).toLowerCase();
  }
}

export function totalsByCurrency(rows) {
  const out = {};
  rows.forEach(r => {
    const cur = r.currencyEff || '—';
    if (!out[cur]) out[cur] = { fee: 0, commission: 0 };
    out[cur].fee += Number(r.feeAmount) || 0;
    out[cur].commission += Number(r.commissionAmount) || 0;
  });
  return out;
}

export function totalsText(rows) {
  const t = totalsByCurrency(rows);
  const parts = Object.entries(t).map(([cur, v]) => {
    const c = cur === '—' ? '' : cur;
    return `Fee ${fmtMoney(v.fee, c) || '0'} · Commission ${fmtMoney(v.commission, c) || '0'}`;
  });
  return parts.join('   |   ');
}
