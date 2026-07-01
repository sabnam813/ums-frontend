import React, { useState } from 'react';
import Select from 'react-select';
import './BulkEditModal.css';

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

const toOpts = (arr) => arr.map(v => ({ value: v, label: v }));


export default function InquiryBulkEditModal({ count, stageOptions = [], countryOptions = [], levelOptions = [], onSave, onClose }) {
  const [fields, setFields] = useState({
    stage: '', country: '', level: '', mode: '', respondedBy: '', emailType: '', referredBy: '', remarks: '',
  });
  const [enabled, setEnabled] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const updates = {};
    Object.keys(enabled).forEach(k => {
      if (enabled[k] && fields[k] !== '') updates[k] = fields[k];
    });
    if (Object.keys(updates).length === 0) {
      alert('Please enable and fill at least one field to update.');
      return;
    }
    setSaving(true);
    try {
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const Field = ({ label, fieldKey, children }) => (
    <div className={`be-field ${enabled[fieldKey] ? 'active' : ''}`}>
      <div className="be-field-header">
        <label className="be-checkbox">
          <input type="checkbox" checked={!!enabled[fieldKey]} onChange={() => toggle(fieldKey)} />
          <span className="be-check-box">
            {enabled[fieldKey] && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          {label}
        </label>
      </div>
      {enabled[fieldKey] && <div className="be-field-input">{children}</div>}
    </div>
  );

  return (
    <div className="be-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="be-modal animate-fade">
        <div className="be-header">
          <div className="be-title-group">
            <div className="be-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h3>Bulk Edit Inquiries</h3>
              <p>Updating <strong>{count} inquir{count > 1 ? 'ies' : 'y'}</strong> — check fields to edit</p>
            </div>
          </div>
          <button className="be-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="be-body">
          <div className="be-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Only checked fields will be updated. Unchecked fields remain unchanged.
          </div>

          <div className="be-fields">
            <Field label="Stage" fieldKey="stage">
              <Select className="custom-select" classNamePrefix="react-select" options={toOpts(stageOptions)}
                value={fields.stage ? { value: fields.stage, label: fields.stage } : null}
                onChange={opt => set('stage', opt?.value || '')} placeholder="Choose stage…" {...menuPortalProps} />
            </Field>

            <Field label="Country" fieldKey="country">
              <Select className="custom-select" classNamePrefix="react-select" options={toOpts(countryOptions)}
                value={fields.country ? { value: fields.country, label: fields.country } : null}
                onChange={opt => set('country', opt?.value || '')} placeholder="Choose country…" {...menuPortalProps} />
            </Field>

            <Field label="Level" fieldKey="level">
              <Select className="custom-select" classNamePrefix="react-select" options={toOpts(levelOptions)}
                value={fields.level ? { value: fields.level, label: fields.level } : null}
                onChange={opt => set('level', opt?.value || '')} placeholder="Choose level…" {...menuPortalProps} />
            </Field>

            <Field label="Mode / Channel" fieldKey="mode">
              <input type="text" className="be-input" placeholder="Phone, Email, Walk-in…"
                value={fields.mode} onChange={e => set('mode', e.target.value)} />
            </Field>

            <Field label="Responded By" fieldKey="respondedBy">
              <input type="text" className="be-input" placeholder="Staff name"
                value={fields.respondedBy} onChange={e => set('respondedBy', e.target.value)} />
            </Field>

            <Field label="Email Type" fieldKey="emailType">
              <input type="text" className="be-input" placeholder="Email type"
                value={fields.emailType} onChange={e => set('emailType', e.target.value)} />
            </Field>

            <Field label="Referred By" fieldKey="referredBy">
              <input type="text" className="be-input" placeholder="Agent / source"
                value={fields.referredBy} onChange={e => set('referredBy', e.target.value)} />
            </Field>

            <Field label="Remarks" fieldKey="remarks">
              <input type="text" className="be-input" placeholder="Remark / note"
                value={fields.remarks} onChange={e => set('remarks', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="be-footer">
          <span className="be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="be-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="be-save" onClick={handleSave} disabled={enabledCount === 0 || saving}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? 'Applying…' : `Apply to ${count} inquir${count > 1 ? 'ies' : 'y'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
