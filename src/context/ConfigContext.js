import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useFiscalYear } from './FiscalYearContext';
import { FISCAL_YEARS, setFiscalYears, getDefaultAchFiscalYear } from '../utils/fiscalYear';

const ConfigContext = createContext(null);

const EMPTY = { lists: {}, modules: {}, fiscalYears: null };

export function ConfigProvider({ children }) {
  const { user } = useAuth();
  const { achFiscalYear, setAchFiscalYear } = useFiscalYear();
  const [config, setConfig] = useState(EMPTY);
  const [version, setVersion] = useState(0);
  const userId = user?._id || user?.id || null;

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/config/public');
      const next = { lists: res.data.lists || {}, modules: res.data.modules || {}, fiscalYears: res.data.fiscalYears || null };
      const before = JSON.stringify(FISCAL_YEARS);
      setFiscalYears(next.fiscalYears);
      const changed = before !== JSON.stringify(FISCAL_YEARS);
      setConfig(next);
      if (changed) {
        if (!FISCAL_YEARS.some(f => f.label === achFiscalYear)) setAchFiscalYear(getDefaultAchFiscalYear());
        setVersion(v => v + 1);
      }
    } catch {
      setConfig(c => c);
    }
  }, [achFiscalYear, setAchFiscalYear]);

  useEffect(() => {
    if (userId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const value = useMemo(() => ({ config, refresh }), [config, refresh]);

  return (
    <ConfigContext.Provider value={value}>
      <React.Fragment key={version}>{children}</React.Fragment>
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  return ctx || { config: EMPTY, refresh: async () => {} };
}

export function useConfigList(key, fallback) {
  const { config } = useConfig();
  const list = config.lists?.[key];
  return Array.isArray(list) && list.length ? list : fallback;
}
