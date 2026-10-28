
export const FISCAL_YEARS = [
  { label: '2081/82', from: '2024-07-16', to: '2025-07-15' },
  { label: '2082/83', from: '2025-07-16', to: '2026-07-16' },
  { label: '2083/84', from: '2026-07-17', to: '2027-07-15' },
  { label: '2084/85', from: '2027-07-16', to: '2028-07-15' },
];

export const FY_ALL = 'all';

export const DEFAULT_FISCAL_YEARS = FISCAL_YEARS.map(f => ({ ...f }));

export function setFiscalYears(list) {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_FISCAL_YEARS;
  FISCAL_YEARS.splice(0, FISCAL_YEARS.length, ...src.map(f => ({ label: f.label, from: f.from, to: f.to })));
}

export function getDefaultAchFiscalYear() {
  if (FISCAL_YEARS.some(f => f.label === '2083/84')) return '2083/84';
  const today = new Date().toISOString().slice(0, 10);
  const cur = FISCAL_YEARS.find(f => today >= f.from && today <= f.to);
  return cur ? cur.label : (FISCAL_YEARS[FISCAL_YEARS.length - 1]?.label || '2083/84');
}


export function detectFiscalYear(dateStr) {
  const FALLBACK_FISCAL_YEAR = getDefaultAchFiscalYear();
  if (!dateStr) return FALLBACK_FISCAL_YEAR;
  for (const fy of FISCAL_YEARS) {
    if (dateStr >= fy.from && dateStr <= fy.to) return fy.label;
  }
  return FALLBACK_FISCAL_YEAR;
}

export const DEFAULT_FISCAL_YEAR = FY_ALL;

export const DEFAULT_ACH_FISCAL_YEAR = '2083/84';

export function getFiscalYearRange(label) {
  if (!label || label === FY_ALL) return { from: '', to: '' };
  const fy = FISCAL_YEARS.find(f => f.label === label);
  if (!fy) return { from: '', to: '' };
  return { from: fy.from, to: fy.to };
}
