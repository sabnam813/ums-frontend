import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEFAULT_FISCAL_YEAR, DEFAULT_ACH_FISCAL_YEAR, getFiscalYearRange, FY_ALL } from '../utils/fiscalYear';
import { ensureFreshToken } from './AuthContext';

const STORAGE_KEY     = 'ums_fiscal_year';
const ACH_STORAGE_KEY = 'ums_ach_fiscal_year';

function getInitialFY() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  return DEFAULT_FISCAL_YEAR;
}

function getInitialAchFY() {
  try {
    const stored = localStorage.getItem(ACH_STORAGE_KEY);
    if (stored) return stored;
  } catch {}
  return DEFAULT_ACH_FISCAL_YEAR;
}

const FiscalYearContext = createContext(null);

export function FiscalYearProvider({ children }) {
  const [fiscalYear, setFiscalYearState] = useState(getInitialFY);
  const [achFiscalYear, setAchFiscalYearState] = useState(getInitialAchFY);

  const range = getFiscalYearRange(fiscalYear);

  const setFiscalYear = useCallback(async (fy) => {
    await ensureFreshToken();
    setFiscalYearState(fy);
    try { localStorage.setItem(STORAGE_KEY, fy); } catch {}
  }, []);

  const setAchFiscalYear = useCallback((fy) => {
    setAchFiscalYearState(fy);
    try { localStorage.setItem(ACH_STORAGE_KEY, fy); } catch {}
  }, []);

  return (
    <FiscalYearContext.Provider value={{
      fiscalYear, setFiscalYear,
      dateFrom: range.from, dateTo: range.to,
      achFiscalYear, setAchFiscalYear,
      FY_ALL,
    }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  const ctx = useContext(FiscalYearContext);
  if (!ctx) throw new Error('useFiscalYear must be used inside FiscalYearProvider');
  return ctx;
}
