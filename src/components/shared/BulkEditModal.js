import React, { useState } from 'react';
import Select from 'react-select';
import AssociateSelect from './AssociateSelect';
import './BulkEditModal.css';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';
import { FORM_FIELD_KEYS } from '../../utils/countryLayouts';

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

const NOT_SET = '__NOT_SET__';
const NOT_SET_OPTION = { value: NOT_SET, label: 'Clear field' };

function selectValueFor(value) {
  if (value === NOT_SET) return NOT_SET_OPTION;
  if (value) return { value, label: value };
  return null;
}

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

export default function BulkEditModal({ count, onSave, onClose, layout }) {
  const dropdownFields = layout.bulkFields;
  const dateFields = layout.bulkDateFields;
  const { customFields } = useFieldConfig();

  const [fields, setFields] = useState(() => {
    const base = {};
    FORM_FIELD_KEYS.forEach(k => { base[k] = ''; });
    return base;
  });
  const [customValues, setCustomValues] = useState({});
  const [enabled, setEnabled] = useState({});

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));

  const handleSave = () => {
    const updates = {};
    Object.keys(enabled).forEach(k => {
      if (!enabled[k]) return;
      if (k.startsWith('custom:')) {
        const ck = k.slice('custom:'.length);
        if (customValues[ck] !== undefined && customValues[ck] !== '') {
          updates.customFields = updates.customFields || {};
          updates.customFields[ck] = customValues[ck];
        }
      } else if (fields[k] !== '') {
        updates[k] = fields[k] === NOT_SET ? '' : fields[k];
      }
    });
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
              <p>Updating <strong>{count} record{count > 1 ? 's' : ''}</strong>. Check the fields below to edit them.</p>
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
            <Field label="Level" fieldKey="level" enabled={enabled} toggle={toggle}>
              <Select className="custom-select" classNamePrefix="react-select" options={[NOT_SET_OPTION, ...toSelectOptions(layout.optionsFor('level'))]}
                value={selectValueFor(fields.level)}
                onChange={opt => set('level', opt?.value || '')} placeholder="Choose level…" {...menuPortalProps} />
            </Field>

            {dropdownFields.map(df => (
              <Field key={df.key} label={df.label} fieldKey={df.key} enabled={enabled} toggle={toggle}>
                <Select className="custom-select" classNamePrefix="react-select" options={[NOT_SET_OPTION, ...toSelectOptions(layout.optionsFor(df.key))]}
                  value={selectValueFor(fields[df.key])}
                  onChange={opt => set(df.key, opt?.value || '')} placeholder="Choose…" {...menuPortalProps} />
              </Field>
            ))}

            {dateFields.map(df => (
              <Field key={df.key} label={df.label} fieldKey={df.key} enabled={enabled} toggle={toggle}>
                <input type="date" className="be-input" value={fields[df.key] || ''} onChange={e => set(df.key, e.target.value)} />
              </Field>
            ))}

            <Field label="Referred By" fieldKey="referredBy" enabled={enabled} toggle={toggle}>
              <AssociateSelect value={fields.referredBy} onChange={v => set('referredBy', v)} placeholder="Select associate…" />
            </Field>

            <Field label="Provider Name" fieldKey="providerName" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="University / College"
                value={fields.providerName} onChange={e => set('providerName', e.target.value)} />
            </Field>

            <Field label="Course" fieldKey="course" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Course name"
                value={fields.course} onChange={e => set('course', e.target.value)} />
            </Field>

            <Field label="Initial Intake" fieldKey="initialIntake" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="e.g. Feb 2026"
                value={fields.initialIntake} onChange={e => set('initialIntake', e.target.value)} />
            </Field>

            <Field label="Remarks" fieldKey="remarks" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Remark / note"
                value={fields.remarks} onChange={e => set('remarks', e.target.value)} />
            </Field>

            <Field label="Other" fieldKey="other" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Any other info"
                value={fields.other || ''} onChange={e => set('other', e.target.value)} />
            </Field>

            <Field label="Through" fieldKey="through" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Channel / sub-agent"
                value={fields.through || ''} onChange={e => set('through', e.target.value)} />
            </Field>

                        {customFields.map(f => (
              <Field key={f.key} label={f.label} fieldKey={`custom:${f.key}`} enabled={enabled} toggle={toggle}>
                {f.type === 'dropdown' ? (
                  <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(f.options || [])}
                    value={customValues[f.key] ? { value: customValues[f.key], label: customValues[f.key] } : null}
                    onChange={opt => setCustom(f.key, opt?.value || '')} placeholder={`Choose ${f.label.toLowerCase()}…`} {...menuPortalProps} />
                ) : f.type === 'textarea' ? (
                  <textarea className="be-input" placeholder={f.label} rows={2}
                    value={customValues[f.key] || ''} onChange={e => setCustom(f.key, e.target.value)} />
                ) : (
                  <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} className="be-input" placeholder={f.label}
                    value={customValues[f.key] || ''} onChange={e => setCustom(f.key, e.target.value)} />
                )}
              </Field>
            ))}
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
