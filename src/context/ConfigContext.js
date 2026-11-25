import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useFiscalYear } from './FiscalYearContext';
import { FISCAL_YEARS, setFiscalYears, getDefaultAchFiscalYear } from '../utils/fiscalYear';

const ConfigContext = createContext(null);

const EMPTY = { lists: {}, modules: {}, fiscalYears: null, profiles: {}, profileAssign: { countries: {}, groups: {} } };

export function ConfigProvider({ children }) {
  const { user } = useAuth();
  const { achFiscalYear, setAchFiscalYear } = useFiscalYear();
  const [config, setConfig] = useState(EMPTY);
  const [version, setVersion] = useState(0);
  const [readyFor, setReadyFor] = useState(null);
  const readyRef = useRef(false);
  const userId = user?._id || user?.id || null;

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/config/public');
      const next = {
        lists: res.data.lists || {},
        modules: res.data.modules || {},
        fiscalYears: res.data.fiscalYears || null,
        profiles: res.data.profiles || {},
        profileAssign: res.data.profileAssign || { countries: {}, groups: {} },
      };
      const before = JSON.stringify(FISCAL_YEARS);
      setFiscalYears(next.fiscalYears);
      const changed = before !== JSON.stringify(FISCAL_YEARS);
      setConfig(next);
      if (changed) {
        if (!FISCAL_YEARS.some(f => f.label === achFiscalYear)) setAchFiscalYear(getDefaultAchFiscalYear());
        if (readyRef.current) setVersion(v => v + 1);
      }
    } catch {
      setConfig(c => c);
    }
  }, [achFiscalYear, setAchFiscalYear]);

  useEffect(() => {
    if (!userId) { readyRef.current = false; return undefined; }
    let alive = true;
    readyRef.current = false;
    refresh().finally(() => {
      readyRef.current = true;
      if (alive) setReadyFor(userId);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const value = useMemo(() => ({ config, refresh }), [config, refresh]);

  const ready = !userId || readyFor === userId;

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--gray-50)' }}>
        <div style={{ width: 44, height: 44, border: '3px solid var(--gray-200)', borderTopColor: 'var(--uca-blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Loading UMS…</p>
      </div>
    );
  }

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
