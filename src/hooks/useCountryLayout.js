import { useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { resolveProfileId, resolveLayout } from '../utils/countryLayouts';

export default function useCountryLayout(country, optionsByField) {
  const { config } = useConfig();
  const profiles = config.profiles;
  const assign = config.profileAssign;
  return useMemo(() => {
    const pid = resolveProfileId(country, assign);
    return resolveLayout(pid, profiles && profiles[pid], optionsByField);
  }, [country, assign, profiles, optionsByField]);
}
