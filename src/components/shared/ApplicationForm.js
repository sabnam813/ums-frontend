import React, { useState } from 'react';
import Select from 'react-select';
import './ApplicationForm.css';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

const INTAKE_OPTIONS = YEARS.flatMap(y =>
  MONTHS.map(m => ({ value: `${m} ${y}`, label: `${m} ${y}` }))
);

function IntakePicker({ value, onChange, placeholder }) {
  const [manualMode, setManualMode] = useState(false);
  if (manualMode) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          className="af-input"
          placeholder="e.g. Jan 2026"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" className="af-mode-btn" onClick={() => setManualMode(false)} title="Use dropdown">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1 }}>
        <Select
          className="custom-select"
          classNamePrefix="react-select"
          options={INTAKE_OPTIONS}
          value={value ? { value, label: value } : null}
          onChange={opt => onChange(opt?.value || '')}
          placeholder={placeholder}
          isClearable
        />
      </div>
      <button type="button" className="af-mode-btn" onClick={() => setManualMode(true)} title="Type manually">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  );
}

function CustomFieldInput({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className="af-textarea"
          placeholder={field.label}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className="af-input"
          placeholder={field.label}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="af-input"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'dropdown':
      return (
        <Select
          className="custom-select"
          classNamePrefix="react-select"
          options={toSelectOptions(field.options || [])}
          value={value ? { value, label: value } : null}
          onChange={opt => onChange(opt?.value || '')}
          placeholder={`Select ${field.label.toLowerCase()}…`}
          isClearable
        />
      );
    default: {
      
      const handleChange = (e) => {
        const v = e.target.value;
        if (field.validationType === 'number_only' && v !== '' && !/^[0-9]*$/.test(v)) return;
        if (field.validationType === 'word_only' && v !== '' && /[0-9]/.test(v)) return;
        onChange(v);
      };
      return (
        <input
          type="text"
          className="af-input"
          placeholder={
            field.validationType === 'number_only' ? `${field.label} (numbers only)` :
            field.validationType === 'word_only' ? `${field.label} (text only)` :
            field.label
          }
          value={value}
          onChange={handleChange}
        />
      );
    }
  }
}

export default function ApplicationForm({ row, onSave, onClose }) {
  const isEdit = !!row?._id;
  const today = new Date().toISOString().split('T')[0];
  const { optionsByField, customFieldsBySection, loading: fieldsLoading } = useFieldConfig();

  const [form, setForm] = useState({
    date: row?.date || today,
    referredBy: row?.referredBy || '',
    name: row?.name || '',
    level: row?.level || '',
    course: row?.course || '',
    providerName: row?.providerName || '',
    initialIntake: row?.initialIntake || '',
    deferredIntake: row?.deferredIntake || '',
    gsSubmission: row?.gsSubmission || 'Not Submitted',
    payment: row?.payment || 'Incomplete',
    coeCas: row?.coeCas || 'Not Received',
    savisFee: row?.savisFee || 'Unpaid',
    refund: row?.refund || 'Non-Refunded',
    visaLodgement: row?.visaLodgement || '',
    visaOutcome: row?.visaOutcome || '',
    visaWithdraw: row?.visaWithdraw || 'No',
    olRequest: row?.olRequest || 'Not Requested',
    offerLetter: row?.offerLetter || 'Not Received',
    withdraw: row?.withdraw || 'No',
    other: row?.other || '',
    remarks: row?.remarks || '',
    through: row?.through || '',
  });
  const [customValues, setCustomValues] = useState({ ...(row?.customFields || {}) });

  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Applicant name is required';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...row, ...form, customFields: customValues });
  };

  // Built-in section names — custom fields whose `section` matches one of these
  // render INSIDE that built-in section (at the position chosen when the field was
  // created) instead of as a separate appended section.
  const BUILTIN_SECTIONS = ['Basic Information', 'Intakes', 'Offer', 'Financial', 'Visa', 'Additional Information'];
  const customSections = Object.entries(customFieldsBySection).filter(
    ([sectionName]) => !BUILTIN_SECTIONS.includes(sectionName)
  );

  // Renders any custom fields slotted at a given position within a built-in section.
  // position: 'first' | 'last' | the _id of the built-in-section field to render after
  const InlineCustomFields = ({ sectionName, position }) => {
    const fields = (customFieldsBySection[sectionName] || []).filter(f => (f.afterFieldId || 'last') === position);
    if (fields.length === 0) return null;
    return (
      <>
        {fields.map(field => (
          <div className="af-field" key={field._id}>
            <label>{field.label}{field.required ? ' *' : ''}</label>
            <CustomFieldInput
              field={field}
              value={customValues[field.key] || ''}
              onChange={v => setCustom(field.key, v)}
            />
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-modal animate-slide-right">
        <div className="af-header">
          <div className="af-header-left">
            <div className="af-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Application' : 'New Application'}</h3>
              <p>{isEdit ? `Editing: ${row.name}` : 'Fill in the applicant details below'}</p>
            </div>
          </div>
          <button className="af-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="af-form">
                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">1</span>
              Basic Information
            </div>

            <InlineCustomFields sectionName="Basic Information" position="first" />

            <div className="af-grid-2">
              <div className={`af-field ${errors.date ? 'has-error' : ''}`}>
                <label>Date *</label>
                <input
                  type="date"
                  className="af-input"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                />
                {errors.date && <span className="af-error">{errors.date}</span>}
              </div>
              <div className="af-field">
                <label>Referred By</label>
                <input
                  type="text"
                  className="af-input"
                  placeholder="Agent or referral source"
                  value={form.referredBy}
                  onChange={e => set('referredBy', e.target.value)}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Basic Information" position="referredBy" />

            <div className={`af-field ${errors.name ? 'has-error' : ''}`}>
              <label>Applicant Name *</label>
              <input
                type="text"
                className="af-input"
                placeholder="Full name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <span className="af-error">{errors.name}</span>}
            </div>
            <InlineCustomFields sectionName="Basic Information" position="name" />

            <div className="af-grid-2">
              <div className="af-field">
                <label>Level</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.level || [])}
                  value={form.level ? { value: form.level, label: form.level } : null}
                  onChange={opt => set('level', opt?.value || '')}
                  placeholder="Select level…"
                  isClearable
                  isLoading={fieldsLoading}
                />
              </div>
              <div className="af-field">
                <label>Course</label>
                <input
                  type="text"
                  className="af-input"
                  placeholder="e.g. Computer Science"
                  value={form.course}
                  onChange={e => set('course', e.target.value)}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Basic Information" position="course" />

            <div className="af-field">
              <label>Provider Name</label>
              <input
                type="text"
                className="af-input"
                placeholder="University / College name"
                value={form.providerName}
                onChange={e => set('providerName', e.target.value)}
              />
            </div>
            <InlineCustomFields sectionName="Basic Information" position="last" />
          </div>

                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">2</span>
              Intakes
            </div>
            <InlineCustomFields sectionName="Intakes" position="first" />
            <div className="af-grid-2">
              <div className="af-field">
                <label>Initial Intake</label>
                <IntakePicker value={form.initialIntake} onChange={v => set('initialIntake', v)} placeholder="Month Year…"/>
              </div>
              <div className="af-field">
                <label>Deferred Intake</label>
                <IntakePicker value={form.deferredIntake} onChange={v => set('deferredIntake', v)} placeholder="If deferred…"/>
              </div>
            </div>
            <InlineCustomFields sectionName="Intakes" position="deferredIntake" />

            <div className="af-field">
              <label>GS Submission</label>
              <Select
                className="custom-select"
                classNamePrefix="react-select"
                options={toSelectOptions(optionsByField.gsSubmission || [])}
                value={form.gsSubmission ? { value: form.gsSubmission, label: form.gsSubmission } : null}
                onChange={opt => set('gsSubmission', opt?.value || 'Not Submitted')}
                isLoading={fieldsLoading}
              />
            </div>
            <InlineCustomFields sectionName="Intakes" position="last" />
          </div>

                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">3</span>
              Offer
            </div>
            <InlineCustomFields sectionName="Offer" position="first" />

            <div className="af-grid-2">
              <div className="af-field">
                <label>OL Request</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.olRequest || [])}
                  value={form.olRequest ? { value: form.olRequest, label: form.olRequest } : null}
                  onChange={opt => set('olRequest', opt?.value || 'Not Requested')}
                  isLoading={fieldsLoading}
                />
              </div>
              <div className="af-field">
                <label>OL Received</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.offerLetter || [])}
                  value={form.offerLetter ? { value: form.offerLetter, label: form.offerLetter } : null}
                  onChange={opt => set('offerLetter', opt?.value || 'Not Received')}
                  isLoading={fieldsLoading}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Offer" position="offerLetter" />

            <div className="af-field">
              <label>Withdraw</label>
              <Select
                className="custom-select"
                classNamePrefix="react-select"
                options={toSelectOptions(optionsByField.withdraw || [])}
                value={form.withdraw ? { value: form.withdraw, label: form.withdraw } : null}
                onChange={opt => set('withdraw', opt?.value || 'No')}
                isLoading={fieldsLoading}
              />
            </div>
            <InlineCustomFields sectionName="Offer" position="last" />
          </div>

                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">4</span>
              Financial
            </div>
            <InlineCustomFields sectionName="Financial" position="first" />

            <div className="af-grid-2">
              <div className="af-field">
                <label>Payment Status</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.payment || [])}
                  value={form.payment ? { value: form.payment, label: form.payment } : null}
                  onChange={opt => set('payment', opt?.value || 'Incomplete')}
                  isLoading={fieldsLoading}
                />
              </div>
              <div className="af-field">
                <label>COE/CAS</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.coeCas || [])}
                  value={form.coeCas ? { value: form.coeCas, label: form.coeCas } : null}
                  onChange={opt => set('coeCas', opt?.value || 'Not Received')}
                  isLoading={fieldsLoading}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Financial" position="coeCas" />

            <div className="af-grid-2">
              <div className="af-field">
                <label>Sevis Fee</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.savisFee || [])}
                  value={form.savisFee ? { value: form.savisFee, label: form.savisFee } : null}
                  onChange={opt => set('savisFee', opt?.value || 'Unpaid')}
                  isLoading={fieldsLoading}
                />
              </div>
              <div className="af-field">
                <label>Refund</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={toSelectOptions(optionsByField.refund || [])}
                  value={form.refund ? { value: form.refund, label: form.refund } : null}
                  onChange={opt => set('refund', opt?.value || 'Non-Refunded')}
                  isLoading={fieldsLoading}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Financial" position="last" />
          </div>

                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">5</span>
              Visa
            </div>
            <InlineCustomFields sectionName="Visa" position="first" />

            <div className="af-grid-2">
              <div className="af-field">
                <label>Visa Date</label>
                <input
                  type="date"
                  className="af-input"
                  value={form.visaLodgement}
                  onChange={e => set('visaLodgement', e.target.value)}
                />
              </div>
              <div className="af-field">
                <label>Visa Outcome</label>
                <Select
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={[{ value: '', label: 'Not Set' }, ...toSelectOptions(optionsByField.visaOutcome || [])]}
                  value={form.visaOutcome ? { value: form.visaOutcome, label: form.visaOutcome } : { value: '', label: 'Not Set' }}
                  onChange={opt => set('visaOutcome', opt?.value || '')}
                  isLoading={fieldsLoading}
                />
              </div>
            </div>
            <InlineCustomFields sectionName="Visa" position="visaOutcome" />

            <div className="af-field">
              <label>Visa Withdraw</label>
              <Select
                className="custom-select"
                classNamePrefix="react-select"
                options={toSelectOptions(optionsByField.visaWithdraw || [])}
                value={form.visaWithdraw ? { value: form.visaWithdraw, label: form.visaWithdraw } : null}
                onChange={opt => set('visaWithdraw', opt?.value || 'No')}
                isLoading={fieldsLoading}
              />
            </div>
            <InlineCustomFields sectionName="Visa" position="last" />
          </div>

                    <div className="af-section">
            <div className="af-section-title">
              <span className="af-section-num">6</span>
              Additional Information
            </div>
            <InlineCustomFields sectionName="Additional Information" position="first" />
            <div className="af-field">
              <label>Other</label>
              <input
                type="text"
                className="af-input"
                placeholder="Any other info"
                value={form.other}
                onChange={e => set('other', e.target.value)}
              />
            </div>
            <InlineCustomFields sectionName="Additional Information" position="other" />
            <div className="af-field">
              <label>Remarks</label>
              <textarea
                className="af-textarea"
                placeholder="Additional remarks, follow-up notes…"
                value={form.remarks}
                onChange={e => set('remarks', e.target.value)}
                rows={3}
              />
            </div>
            <InlineCustomFields sectionName="Additional Information" position="remarks" />
            <div className="af-field">
              <label>Through</label>
              <input
                type="text"
                className="af-input"
                placeholder="Channel / sub-agent this came through"
                value={form.through}
                onChange={e => set('through', e.target.value)}
              />
            </div>
            <InlineCustomFields sectionName="Additional Information" position="last" />
          </div>

                    {customSections.map(([sectionName, fields], idx) => (
            <div className="af-section" key={sectionName}>
              <div className="af-section-title">
                <span className="af-section-num">{7 + idx}</span>
                {sectionName}
              </div>
              {fields.map(field => (
                <div className="af-field" key={field._id}>
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                  <CustomFieldInput
                    field={field}
                    value={customValues[field.key] || ''}
                    onChange={v => setCustom(field.key, v)}
                  />
                </div>
              ))}
            </div>
          ))}

          <div className="af-footer">
            <button type="button" className="af-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="af-submit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {isEdit
                  ? <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>
                  : <><path d="M12 5v14M5 12h14"/></>
                }
              </svg>
              {isEdit ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
