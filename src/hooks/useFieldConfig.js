import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const FIELD_CONFIG_EVENT = 'ums:fieldConfigChanged';
const EMPTY_FIELDS = [];

export const DEFAULT_OPTIONS = {
  level: ['UG', 'PG', 'PGD', 'PhD', 'Diploma', 'Research/PhD', 'MRes', 'Advance Diploma', 'PG-Certificate'],
  gsSubmission: ['Incompleted', 'Ongoing', 'Completed'],
  olRequest: ['Requested', 'Not Requested'],
  offerLetter: ['Received', 'Not Received', 'Rejected'],
  withdraw: ['Yes', 'No'],
  payment: ['Complete', 'Incomplete'],
  coeCas: ['Requested', 'Received', 'Not Received'],
  savisFee: ['Paid', 'Unpaid'],
  refund: ['Processing', 'Received'],
  visaOutcome: ['Grant', 'Waiting', 'Withdraw', 'Rejected'],
  visaWithdraw: ['Yes', 'No'],
  olType: ['Conditional', 'Unconditional'],
  precasDeposit: ['Complete', 'N/A'],
  interview: ['Passed', 'Failed'],
  financialDocument: ['Received', 'Not Received'],
  tbCertificate: ['Received', 'Not Received'],
  eVisa: ['Applied', 'Not Applied'],
  studentIdCard: ['Received', 'Not Received'],
  applicationFee: ['Paid', 'Unpaid'],
  visaKit: ['Received', 'Not Received'],
};

export const FIELD_LABELS = {
  level: 'Level',
  gsSubmission: 'GS/WIP/Financial',
  olRequest: 'OL Request',
  offerLetter: 'OL Received',
  withdraw: 'Withdraw',
  payment: 'Payment Status',
  coeCas: 'COE/CAS',
  savisFee: 'Savis Fee',
  refund: 'Refund',
  visaOutcome: 'Visa Outcome',
  visaWithdraw: 'Visa Withdraw',
  olType: 'OL Type',
  precasDeposit: 'Precas Deposit',
  interview: 'Interview',
  financialDocument: 'Financial Document',
  tbCertificate: 'TB Certificate',
  eVisa: 'E-Visa',
  studentIdCard: 'Student ID Card',
  applicationFee: 'Application Fee',
  visaKit: 'Visa Kit',
};

const store = { fields: null, promise: null, at: 0, listeners: new Set() };

function loadFields(force) {
  if (!force && store.fields) return Promise.resolve();
  if (store.promise) return store.promise;
  store.promise = axios.get('/fields')
    .then(res => { store.fields = res.data.fields || []; store.at = Date.now(); })
    .catch(() => { if (!store.fields) store.fields = []; })
    .finally(() => {
      store.promise = null;
      store.listeners.forEach(fn => fn());
    });
  return store.promise;
}

if (typeof window !== 'undefined') {
  window.addEventListener(FIELD_CONFIG_EVENT, () => { loadFields(true); });
}

export function useFieldConfig() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick(n => n + 1);
    store.listeners.add(fn);
    if (!store.fields || Date.now() - store.at > 30000) loadFields(true);
    return () => { store.listeners.delete(fn); };
  }, []);

  const rawFields = store.fields || EMPTY_FIELDS;
  const loading = store.fields === null;

  const refetch = useCallback(() => loadFields(true), []);

  const broadcastChange = useCallback(() => {
    window.dispatchEvent(new window.Event(FIELD_CONFIG_EVENT));
  }, []);

  const optionsByField = useMemo(() => {
    const result = {};
    Object.entries(DEFAULT_OPTIONS).forEach(([key, defaults]) => {
      const adminConfig = rawFields.find(f => f.kind === 'options' && f.fieldKey === key);
      const removedDefaults = adminConfig?.removedDefaults || [];
      const visibleDefaults = defaults.filter(
        d => !removedDefaults.some(r => r.toLowerCase() === d.toLowerCase())
      );
      const extra = (adminConfig?.options || []).filter(
        o => !defaults.some(d => d.toLowerCase() === o.toLowerCase())
      );
      result[key] = [...visibleDefaults, ...extra];
    });
    return result;
  }, [rawFields]);

  const customFields = useMemo(() => {
    return rawFields
      .filter(f => f.kind === 'custom' && f.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [rawFields]);

  const customFieldsBySection = useMemo(() => {
    const grouped = {};
    customFields.forEach(f => {
      const section = f.section || 'Additional Information';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(f);
    });
    return grouped;
  }, [customFields]);

  return { optionsByField, customFields, customFieldsBySection, loading, refetch, broadcastChange, rawFields };
}

export function toSelectOptions(values) {
  return values.map(v => ({ value: v, label: v }));
}
