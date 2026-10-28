import { useMemo } from 'react';
import { useFieldConfig } from './useFieldConfig';

export default function useLevelOptions(extra = []) {
  const { optionsByField } = useFieldConfig();
  const base = optionsByField.level;
  return useMemo(() => {
    const seen = new Map();
    [...(base || []), ...(extra || [])].forEach(v => {
      const t = String(v || '').trim();
      if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    });
    return [...seen.values()];
  }, [base, extra]);
}
