import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const FIELD_CONFIG_EVENT = 'ums:fieldConfigChanged';

export const DEFAULT_OPTIONS = {
  level: ['UG', 'PG', 'PhD', 'Diploma'],
  gsSubmission: ['Submitted', 'Not Submitted', 'Pending'],
  olRequest: ['Requested', 'Not Requested'],
  offerLetter: ['Received', 'Not Received', 'Withdraw'],
  withdraw: ['Yes', 'No'],
  payment: ['Complete', 'Incomplete'],
  coeCas: ['Received', 'Not Received'],
  savisFee: ['Paid', 'Unpaid'],
  refund: ['Refunded', 'Non-Refunded'],
  visaOutcome: ['Grant', 'Withdraw', 'Rejected'],
  visaWithdraw: ['Yes', 'No'],
};

export const FIELD_LABELS = {
  level: 'Level',
  gsSubmission: 'GS Submission',
  olRequest: 'OL Request',
  offerLetter: 'OL Received',
  withdraw: 'Withdraw',
  payment: 'Payment Status',
  coeCas: 'COE/CAS',
  savisFee: 'Savis Fee',
  refund: 'Refund',
  visaOutcome: 'Visa Outcome',
  visaWithdraw: 'Visa Withdraw',
};

export function useFieldConfig() {
  const [rawFields, setRawFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await axios.get('/fields');
      setRawFields(res.data.fields || []);
    } catch {
      setRawFields([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    const handler = () => { refetch(); };
    window.addEventListener(FIELD_CONFIG_EVENT, handler);
    return () => window.removeEventListener(FIELD_CONFIG_EVENT, handler);
  }, [refetch]);

  const broadcastChange = useCallback(() => {
    window.dispatchEvent(new window.Event(FIELD_CONFIG_EVENT));
  }, []);

  const optionsByField = useMemo(() => {
    const result = {};
    Object.entries(DEFAULT_OPTIONS).forEach(([key, defaults]) => {
      const adminConfig = rawFields.find(f => f.kind === 'options' && f.fieldKey === key);
      const extra = (adminConfig?.options || []).filter(
        o => !defaults.some(d => d.toLowerCase() === o.toLowerCase())
      );
      result[key] = [...defaults, ...extra];
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
