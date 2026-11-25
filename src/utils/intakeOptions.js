
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

export const INTAKE_OPTIONS = YEARS.flatMap(y =>
  MONTHS.map(m => ({ value: `${m} ${y}`, label: `${m} ${y}` }))
);

export const INTAKE_VALUES = INTAKE_OPTIONS.map(o => o.value);

const MONTH_KEYS = MONTHS.map(m => m.toLowerCase());
export const STANDARD_INTAKE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

export function normalizeIntake(v) {
  const t = String(v || '').trim();
  const m = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(t);
  if (!m) return t;
  const idx = MONTH_KEYS.indexOf(m[1].slice(0, 3).toLowerCase());
  return idx < 0 ? t : `${MONTHS[idx]} ${m[2]}`;
}

export function sortIntakes(values) {
  const key = v => {
    const m = /^([A-Za-z]{3}) (\d{4})$/.exec(v);
    return m ? Number(m[2]) * 12 + MONTH_KEYS.indexOf(m[1].toLowerCase()) : Infinity;
  };
  return [...values].sort((a, b) => key(a) - key(b));
}
