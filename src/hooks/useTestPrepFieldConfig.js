import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const FIELD_CONFIG_EVENT = 'ums:testPrepFieldConfigChanged';

export const DEFAULT_OPTIONS = {
  paymentStatus: ['Paid', 'Direct Paid', 'Not Paid', 'Pending'],
  module: ['PB', 'CD', 'CBT', 'Academic', 'General', 'Speaking', 'Online'],
  voucher: ['Voucher', 'Bonus Voucher'],
};

export const FIELD_LABELS = {
  paymentStatus: 'Payment Status',
  module: 'Module',
  voucher: 'Voucher',
};

export function useTestPrepFieldConfig() {
  const [rawFields, setRawFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await axios.get('/test-prep-fields');
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
      if (key === 'voucher') {
        result[key] = [...defaults];
        return;
      }
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

  return { optionsByField, customFields, loading, refetch, broadcastChange, rawFields };
}
