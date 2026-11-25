import React, { useState } from 'react';
import FieldInput from './FieldInput';
import '../shared/ApplicationForm.css';
import './TestPrepForm.css';

const NUMBER_KEYS = ['paymentAmount', 'margin', 'paidAmountToBC', 'receivedAmount', 'cost'];
const DATE_KEYS = ['date', 'bookingDate', 'examDate', 'paymentDate', 'paymentDateToBC', 'expiryDate', 'accountsDate'];

function toDateInputValue(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function TestPrepForm({ row, testTypeName, fields = [], suggestions = {}, customFieldDefs = [], optionsByField = {}, onSave, onClose }) {
  const isEdit = !!row;

  const [form, setForm] = useState(() => {
    const base = {};
    fields.forEach(f => {
      let v = row ? row[f.key] : '';
      if (f.type === 'date') v = toDateInputValue(v);
      if (NUMBER_KEYS.includes(f.key)) v = v ?? '';
      base[f.key] = v ?? '';
    });
    return base;
  });
  const [customValues, setCustomValues] = useState({ ...(row?.customFields || {}) });
  const [errors, setErrors] = useState({});

  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const nameField = fields.find(f => f.key === 'candidateName');
  const otherFields = fields.filter(f => f.key !== 'candidateName');

  const validate = () => {
    const e = {};
    if (!String(form.candidateName || '').trim()) e.candidateName = `${nameField?.label || 'Candidate name'} is required`;
    customFieldDefs.forEach(def => {
      if (def.required && !String(customValues[def.key] ?? '').trim()) {
        e[`custom_${def.key}`] = `${def.label} is required`;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload = { ...(row || {}) };
    fields.forEach(f => {
      const v = form[f.key];
      if (NUMBER_KEYS.includes(f.key)) payload[f.key] = v === '' || v === null ? 0 : Number(v);
      else if (DATE_KEYS.includes(f.key)) payload[f.key] = v || null;
      else payload[f.key] = v;
    });
    payload.candidateName = String(form.candidateName).trim();
    if (!isEdit) payload.date = form.bookingDate || todayInputValue();
    else payload.date = row.date ? toDateInputValue(row.date) : (form.bookingDate || todayInputValue());
    payload.customFields = customValues;
    onSave(payload);
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
              <h3>{isEdit ? 'Edit Booking' : `New ${testTypeName} Booking`}</h3>
              <p>{isEdit ? `Editing: ${row.candidateName}` : 'Fill in the booking details below'}</p>
            </div>
          </div>
          <div className="af-header-actions">
            <button className="af-close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="af-form">
          <div className="af-section">
            <div className="af-grid-2">
              {nameField && (
                <div className={`af-field ${errors.candidateName ? 'has-error' : ''}`}>
                  <label>{nameField.label} *</label>
                  <input type="text" className="af-input" placeholder="Full name"
                    value={form.candidateName} onChange={e => set('candidateName', e.target.value)} />
                  {errors.candidateName && <span className="af-error">{errors.candidateName}</span>}
                </div>
              )}
              {otherFields.filter(f => f.key !== 'remarks').map(f => (
                <div className="af-field" key={f.key}>
                  <label>{f.label}</label>
                  <FieldInput
                    field={f} value={form[f.key]} onChange={v => set(f.key, v)}
                    optionsByField={optionsByField} suggestions={suggestions} idPrefix="tp-form"
                  />
                </div>
              ))}
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <div className="af-section">
              <div className="af-section-title"><span className="af-section-num">+</span>Additional Fields</div>
              <div className="af-grid-2">
                {customFieldDefs.map(def => (
                  <div className={`af-field ${errors[`custom_${def.key}`] ? 'has-error' : ''}`} key={def.key}>
                    <label>{def.label}{def.required ? ' *' : ''}</label>
                    {def.type === 'dropdown' ? (
                      <select className="af-input" value={customValues[def.key] || ''} onChange={e => setCustom(def.key, e.target.value)}>
                        <option value="">Select…</option>
                        {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={def.type === 'date' ? 'date' : 'text'}
                        className="af-input"
                        value={customValues[def.key] || ''}
                        onChange={e => setCustom(def.key, e.target.value)}
                      />
                    )}
                    {errors[`custom_${def.key}`] && <span className="af-error">{errors[`custom_${def.key}`]}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherFields.some(f => f.key === 'remarks') && (
            <div className="af-section">
              <div className="af-grid-2">
                {otherFields.filter(f => f.key === 'remarks').map(f => (
                  <div className="af-field" key={f.key} style={{ gridColumn: '1 / -1' }}>
                    <label>{f.label}</label>
                    <FieldInput
                      field={f} value={form[f.key]} onChange={v => set(f.key, v)}
                      optionsByField={optionsByField} suggestions={suggestions} idPrefix="tp-form"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="af-footer">
            <button type="button" className="af-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="af-submit">
              {isEdit ? 'Save Changes' : 'Add Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
