import React, { useState } from 'react';
import Select from 'react-select';
import './BulkEditModal.css';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

export default function BulkEditModal({ count, onSave, onClose }) {
  const { optionsByField, customFields } = useFieldConfig();

  const [fields, setFields] = useState({
    level: '', gsSubmission: '', olRequest: '', offerLetter: '', withdraw: '',
    payment: '', coeCas: '', savisFee: '', refund: '',
    visaOutcome: '', visaWithdraw: '',
    referredBy: '', providerName: '', course: '', initialIntake: '',
    remarks: '', other: '', through: '',
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
        updates[k] = fields[k];
      }
    });
    if (Object.keys(updates).length === 0) {
      alert('Please enable and fill at least one field to update.');
      return;
    }
    onSave(updates);
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
              <p>Updating <strong>{count} record{count > 1 ? 's' : ''}</strong> — check fields to edit</p>
            </div>
          </div>
          <button className="be-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="be-body">
          <div className="be-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Only checked fields will be updated. Unchecked fields remain unchanged.
          </div>

          <div className="be-fields">
            <Field label="Level" fieldKey="level">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.level || [])}
                value={fields.level ? { value: fields.level, label: fields.level } : null}
                onChange={opt => set('level', opt?.value || '')} placeholder="Choose level…" {...menuPortalProps} />
            </Field>

            <Field label="GS Submission" fieldKey="gsSubmission">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.gsSubmission || [])}
                value={fields.gsSubmission ? { value: fields.gsSubmission, label: fields.gsSubmission } : null}
                onChange={opt => set('gsSubmission', opt?.value || '')} placeholder="Choose status…" {...menuPortalProps} />
            </Field>

            <Field label="OL Request" fieldKey="olRequest">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.olRequest || [])}
                value={fields.olRequest ? { value: fields.olRequest, label: fields.olRequest } : null}
                onChange={opt => set('olRequest', opt?.value || '')} placeholder="Choose status…" {...menuPortalProps} />
            </Field>

            <Field label="OL Received" fieldKey="offerLetter">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.offerLetter || [])}
                value={fields.offerLetter ? { value: fields.offerLetter, label: fields.offerLetter } : null}
                onChange={opt => set('offerLetter', opt?.value || '')} placeholder="Choose status…" {...menuPortalProps} />
            </Field>

            <Field label="Withdraw" fieldKey="withdraw">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.withdraw || [])}
                value={fields.withdraw ? { value: fields.withdraw, label: fields.withdraw } : null}
                onChange={opt => set('withdraw', opt?.value || '')} placeholder="Choose…" {...menuPortalProps} />
            </Field>

            <Field label="Payment" fieldKey="payment">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.payment || [])}
                value={fields.payment ? { value: fields.payment, label: fields.payment } : null}
                onChange={opt => set('payment', opt?.value || '')} placeholder="Choose status…" {...menuPortalProps} />
            </Field>

            <Field label="COE/CAS" fieldKey="coeCas">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.coeCas || [])}
                value={fields.coeCas ? { value: fields.coeCas, label: fields.coeCas } : null}
                onChange={opt => set('coeCas', opt?.value || '')} placeholder="Choose status…" {...menuPortalProps} />
            </Field>

            <Field label="Savis Fee" fieldKey="savisFee">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.savisFee || [])}
                value={fields.savisFee ? { value: fields.savisFee, label: fields.savisFee } : null}
                onChange={opt => set('savisFee', opt?.value || '')} placeholder="Choose…" {...menuPortalProps} />
            </Field>

            <Field label="Refund" fieldKey="refund">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.refund || [])}
                value={fields.refund ? { value: fields.refund, label: fields.refund } : null}
                onChange={opt => set('refund', opt?.value || '')} placeholder="Choose…" {...menuPortalProps} />
            </Field>

            <Field label="Visa Outcome" fieldKey="visaOutcome">
              <Select className="custom-select" classNamePrefix="react-select" options={[{ value: '', label: 'Not Set' }, ...toSelectOptions(optionsByField.visaOutcome || [])]}
                value={fields.visaOutcome ? { value: fields.visaOutcome, label: fields.visaOutcome } : null}
                onChange={opt => set('visaOutcome', opt?.value ?? '')} placeholder="Choose outcome…" {...menuPortalProps} />
            </Field>

            <Field label="Visa Withdraw" fieldKey="visaWithdraw">
              <Select className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.visaWithdraw || [])}
                value={fields.visaWithdraw ? { value: fields.visaWithdraw, label: fields.visaWithdraw } : null}
                onChange={opt => set('visaWithdraw', opt?.value || '')} placeholder="Choose…" {...menuPortalProps} />
            </Field>

            <Field label="Referred By" fieldKey="referredBy">
              <input type="text" className="be-input" placeholder="Agent / source"
                value={fields.referredBy} onChange={e => set('referredBy', e.target.value)} />
            </Field>

            <Field label="Provider Name" fieldKey="providerName">
              <input type="text" className="be-input" placeholder="University / College"
                value={fields.providerName} onChange={e => set('providerName', e.target.value)} />
            </Field>

            <Field label="Course" fieldKey="course">
              <input type="text" className="be-input" placeholder="Course name"
                value={fields.course} onChange={e => set('course', e.target.value)} />
            </Field>

            <Field label="Initial Intake" fieldKey="initialIntake">
              <input type="text" className="be-input" placeholder="e.g. Feb 2026"
                value={fields.initialIntake} onChange={e => set('initialIntake', e.target.value)} />
            </Field>

            <Field label="Remarks" fieldKey="remarks">
              <input type="text" className="be-input" placeholder="Remark / note"
                value={fields.remarks} onChange={e => set('remarks', e.target.value)} />
            </Field>

            <Field label="Other" fieldKey="other">
              <input type="text" className="be-input" placeholder="Any other info"
                value={fields.other || ''} onChange={e => set('other', e.target.value)} />
            </Field>

            <Field label="Through" fieldKey="through">
              <input type="text" className="be-input" placeholder="Channel / sub-agent"
                value={fields.through || ''} onChange={e => set('through', e.target.value)} />
            </Field>

                        {customFields.map(f => (
              <Field key={f.key} label={f.label} fieldKey={`custom:${f.key}`}>
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
