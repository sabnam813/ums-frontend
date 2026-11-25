import React, { useState } from 'react';
import { COLUMNS, STATUS_OPTIONS } from './associateColumns';
import '../HallBooking/HallBooking.css';
import './AssociateDetails.css';

const EDITABLE = COLUMNS.filter(c => !['consultancyName', 'sno', 'aliases'].includes(c.key));

export default function AssociateDetailBulkEditModal({ count, onSave, onClose }) {
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = k => setEnabled(e => ({ ...e, [k]: !e[k] }));
  const enabledKeys = EDITABLE.filter(c => enabled[c.key]).map(c => c.key);

  const handleSave = async () => {
    const updates = {};
    enabledKeys.forEach(k => { updates[k] = k === 'status' ? (values.status || 'Associate') : (values[k] ?? ''); });
    if (!enabledKeys.length) return;
    setSaving(true);
    try { await onSave(updates); } finally { setSaving(false); }
  };

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal hb-modal-sm animate-fade">
        <div className="hb-modal-header">
          <div>
            <h3>Bulk Edit Associates</h3>
            <p>Updating <strong>{count}</strong> row{count > 1 ? 's' : ''}. Tick a field to overwrite it on all of them.</p>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="hb-modal-body ad-be-body">
          {EDITABLE.map(c => (
            <div key={c.key} className="ad-be-item">
              <label className="hb-be-row">
                <input type="checkbox" checked={!!enabled[c.key]} onChange={() => toggle(c.key)} />
                <span className="hb-be-label">{c.label}</span>
              </label>
              {enabled[c.key] && (
                c.key === 'status' ? (
                  <select className="hb-be-input ad-be-input" value={values.status || 'Associate'} onChange={e => setValues(v => ({ ...v, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                <input
                  type={c.type === 'date' ? 'date' : 'text'}
                  className="hb-be-input ad-be-input"
                  value={values[c.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [c.key]: e.target.value }))}
                />
                )
              )}
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
