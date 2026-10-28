
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

export const INTAKE_OPTIONS = YEARS.flatMap(y =>
  MONTHS.map(m => ({ value: `${m} ${y}`, label: `${m} ${y}` }))
);

export const INTAKE_VALUES = INTAKE_OPTIONS.map(o => o.value);
