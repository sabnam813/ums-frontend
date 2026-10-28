import React, { useState } from 'react';
import { PAYMENT_STATUSES } from './unicommissionColumns';
import useLevelOptions from '../../hooks/useLevelOptions';
import '../admin/HallBooking/HallBooking.css';
import '../admin/AssociateDetails/AssociateDetails.css';
import './Unicommission.css';

const FIELDS = [
  { key: 'paymentStatus', label: 'Payment Status', type: 'status' },
  { key: 'commissionProvider', label: 'Commission Provider', type: 'text' },
  { key: 'feeAmount', label: 'Fee Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'commissionType', label: 'Commission Type', type: 'ctype' },
  { key: 'commissionValue', label: 'Commission Rate / Amount', type: 'number' },
  { key: 'associate', label: 'Associates', type: 'text' },
  { key: 'intake', label: 'Intake', type: 'intake' },
  { key: 'university', label: 'University', type: 'text' },
  { key: 'level', label: 'Level', type: 'level' },
  { key: 'course', label: 'Course', type: 'text' },
  { key: 'visaGrantedDate', label: 'Visa Granted Date', type: 'date' },
  { key: 'studentIdNo', label: 'Student ID No', type: 'text' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

export default function UnicommissionBulkEditModal({ count, intakeOptions = [], onSave, onClose }) {
  const LEVEL_SUGGESTIONS = useLevelOptions();
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = k => setEnabled(e => ({ ...e, [k]: !e[k] }));
  const enabledKeys = FIELDS.filter(f => enabled[f.key]).map(f => f.key);

  const handleSave = async () => {
    if (!enabledKeys.length) return;
    const updates = {};
    enabledKeys.forEach(k => {
      const f = FIELDS.find(x => x.key === k);
      updates[k] = values[k] ?? (f.type === 'status' ? 'Pending' : '');
    });
    setSaving(true);
    try { await onSave(updates); } finally { setSaving(false); }
  };

  const renderInput = (f) => {
    const v = values[f.key] ?? (f.type === 'status' ? 'Pending' : '');
    const change = e => setValues(prev => ({ ...prev, [f.key]: e.target.value }));
    if (f.type === 'status') {
      return <select className="hb-be-input ad-be-input" value={v} onChange={change}>{PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>;
    }
    if (f.type === 'ctype') {
      return (
        <select className="hb-be-input ad-be-input" value={v} onChange={change}>
          <option value="">Country default</option>
          <option value="fixed">Fixed amount</option>
          <option value="percentage">Percentage of fee</option>
        </select>
      );
    }
    if (f.type === 'intake') {
      return (
        <select className="hb-be-input ad-be-input" value={v} onChange={change}>
          <option value="">Clear intake</option>
          {intakeOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === 'level') {
      return (
        <>
          <input type="text" list="uc-be-level" className="hb-be-input ad-be-input" value={v} onChange={change} />
          <datalist id="uc-be-level">{LEVEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}</datalist>
        </>
      );
    }
    return <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} step="any" className="hb-be-input ad-be-input" value={v} onChange={change} />;
  };

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal hb-modal-sm animate-fade">
        <div className="hb-modal-header">
          <div>
            <h3>Bulk Edit Records</h3>
            <p>Updating <strong>{count}</strong> row{count > 1 ? 's' : ''}. Tick a field to overwrite it on all of them. An empty value clears the field.</p>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="hb-modal-body ad-be-body">
          {FIELDS.map(f => (
            <div key={f.key} className="ad-be-item">
              <label className="hb-be-row">
                <input type="checkbox" checked={!!enabled[f.key]} onChange={() => toggle(f.key)} />
                <span className="hb-be-label">{f.label}</span>
              </label>
              {enabled[f.key] && renderInput(f)}
            </div>
          ))}
        </div>
        <div className="hb-modal-footer">
          <span className="hb-be-enabled-count">{enabledKeys.length ? `${enabledKeys.length} field${enabledKeys.length > 1 ? 's' : ''} to update` : 'No fields selected'}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="hb-btn-save" onClick={handleSave} disabled={saving || !enabledKeys.length}>{saving ? 'Applying…' : `Apply to ${count}`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
