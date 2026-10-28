import React, { useState } from 'react';
import { CURRENCY_SUGGESTIONS } from './unicommissionColumns';
import { useConfigList } from '../../context/ConfigContext';
import '../admin/HallBooking/HallBooking.css';
import './Unicommission.css';

export default function UnicommissionSettingsModal({ countryName, setting, onSave, onClose }) {
  const currencyList = useConfigList('currency', CURRENCY_SUGGESTIONS);
  const [currency, setCurrency] = useState(setting?.currency || '');
  const [type, setType] = useState(setting?.commissionType === 'fixed' ? 'fixed' : 'percentage');
  const [value, setValue] = useState(setting?.commissionValue ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const n = value === '' ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setError('Enter a valid, positive number'); return; }
    if (type === 'percentage' && n !== null && n > 100) { setError('A percentage cannot be more than 100'); return; }
    setSaving(true);
    try {
      await onSave({ currency: currency.trim().toUpperCase(), commissionType: type, commissionValue: n });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal hb-modal-sm animate-fade">
        <div className="hb-modal-header">
          <div>
            <h3>{countryName} — currency and commission</h3>
            <p>Used for every student in this country unless a row sets its own.</p>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="hb-modal-body">
            {error && <div className="hb-error">{error}</div>}
            <div className="hb-field">
              <label>Currency</label>
              <input type="text" list="uc-set-cur" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={6} placeholder="e.g. CAD" autoFocus />
              <datalist id="uc-set-cur">{currencyList.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="hb-field">
              <label>Commission is</label>
              <div className="uc-radio-row">
                <label className="uc-radio"><input type="radio" name="uc-type" checked={type === 'percentage'} onChange={() => setType('percentage')} /> Percentage of fee</label>
                <label className="uc-radio"><input type="radio" name="uc-type" checked={type === 'fixed'} onChange={() => setType('fixed')} /> Fixed amount per student</label>
              </div>
            </div>
            <div className="hb-field">
              <label>{type === 'percentage' ? 'Default rate (%)' : `Default amount${currency ? ` (${currency})` : ''}`}</label>
              <input type="number" min="0" step="any" value={value} onChange={e => setValue(e.target.value)} placeholder="Leave empty to enter it per student" />
              <span className="hb-hint">Individual students can still override the type and value from the Edit or Bulk Edit screens.</span>
            </div>
          </div>
          <div className="hb-modal-footer">
            <span />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="hb-btn-save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
