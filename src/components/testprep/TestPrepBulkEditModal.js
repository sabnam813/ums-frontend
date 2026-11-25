import React, { useState } from 'react';
import FieldInput from './FieldInput';
import '../shared/BulkEditModal.css';

function Field({ label, fieldKey, enabled, toggle, children }) {
  return (
    <div className={`be-field ${enabled[fieldKey] ? 'active' : ''}`}>
      <div className="be-field-header">
        <label className="be-checkbox">
          <input type="checkbox" checked={!!enabled[fieldKey]} onChange={() => toggle(fieldKey)} />
          <span className="be-check-box">
            {enabled[fieldKey] && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
          {label}
        </label>
      </div>
      {enabled[fieldKey] && <div className="be-field-input">{children}</div>}
    </div>
  );
}

export default function TestPrepBulkEditModal({ count, fields: layoutFields = [], suggestions = {}, customFieldDefs = [], optionsByField = {}, onSave, onClose }) {
  const editable = layoutFields.filter(f => f.key !== 'candidateName');
  const [fields, setFields] = useState(() => Object.fromEntries(editable.map(f => [f.key, ''])));
  const [customValues, setCustomValues] = useState({});
  const [enabled, setEnabled] = useState({});

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));

  const handleSave = () => {
    const updates = {};
    Object.keys(enabled).forEach(k => {
      if (!enabled[k] || k.startsWith('custom:')) return;
      if (fields[k] !== '') updates[k] = fields[k];
    });

    const customUpdates = {};
    customFieldDefs.forEach(def => {
      const key = `custom:${def.key}`;
      if (enabled[key] && customValues[def.key] !== undefined && customValues[def.key] !== '') {
        customUpdates[def.key] = customValues[def.key];
      }
    });
    if (Object.keys(customUpdates).length) updates.customFields = customUpdates;

    if (Object.keys(updates).length === 0) {
      alert('Please enable and fill at least one field to update.');
      return;
    }
    onSave(updates);
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="be-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="be-modal animate-fade">
        <div className="be-header">
          <div className="be-title-group">
            <div className="be-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h3>Bulk Edit</h3>
              <p>Updating <strong>{count} record{count > 1 ? 's' : ''}</strong>. Check the fields to edit.</p>
            </div>
          </div>
          <button className="be-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="be-body">

          <div className="be-fields">
            {editable.map(f => (
              <Field label={f.label} fieldKey={f.key} enabled={enabled} toggle={toggle} key={f.key}>
                <FieldInput
                  field={f} value={fields[f.key]} onChange={v => set(f.key, v)}
                  optionsByField={optionsByField} suggestions={suggestions} idPrefix="tp-be" className="be-input"
                />
              </Field>
            ))}

            {customFieldDefs.map(def => {
              const key = `custom:${def.key}`;
              return (
                <Field label={def.label} fieldKey={key} enabled={enabled} toggle={toggle} key={key}>
                  {def.type === 'dropdown' ? (
                    <select className="be-input" value={customValues[def.key] || ''} onChange={e => setCustom(def.key, e.target.value)}>
                      <option value="">Choose…</option>
                      {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={def.type === 'date' ? 'date' : 'text'}
                      className="be-input"
                      value={customValues[def.key] || ''}
                      onChange={e => setCustom(def.key, e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </div>

        <div className="be-footer">
          <span className="be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="be-cancel" onClick={onClose}>Cancel</button>
            <button className="be-save" onClick={handleSave} disabled={enabledCount === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Apply to {count} record{count > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
