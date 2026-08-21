import React, { useState } from 'react';
import './TestPrepForm.css';

const MODULE_SUGGESTIONS = ['PB', 'CD', 'CBT', 'Academic', 'General', 'Speaking', 'Online'];
const VOUCHER_OPTIONS = ['Voucher', 'Bonus Voucher'];

function TextOrSuggest({ id, value, onChange, options = [], placeholder }) {
  return (
    <>
      <input
        type="text"
        className="af-input"
        list={id}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      <datalist id={id}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}

function toDateInputValue(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  candidateName: '', associates: '', date: '', bookingDate: '', examDate: '',
  module: '', place: '', paymentStatus: '', paymentMadeBy: '',
  paymentDate: '', paymentAmount: '', margin: '', paymentDateToBC: '',
  paidAmountToBC: '', remarks: '',
  referenceNumber: '', receivedAmount: '', cost: '', voucher: '', duolingoVoucher: '', expiryDate: '',
};

export default function TestPrepForm({ row, testTypeName, suggestions = {}, customFieldDefs = [], paymentStatusOptions, moduleOptions, onSave, onClose }) {
  const isEdit = !!row;
  const isDuolingo = /^duolingo$/i.test((testTypeName || '').trim());

  const [form, setForm] = useState(() => row ? {
    ...emptyForm,
    ...row,
    date: toDateInputValue(row.date),
    bookingDate: toDateInputValue(row.bookingDate),
    examDate: toDateInputValue(row.examDate),
    paymentDate: toDateInputValue(row.paymentDate),
    paymentDateToBC: toDateInputValue(row.paymentDateToBC),
    expiryDate: toDateInputValue(row.expiryDate),
    paymentAmount: row.paymentAmount ?? '',
    margin: row.margin ?? '',
    paidAmountToBC: row.paidAmountToBC ?? '',
    receivedAmount: row.receivedAmount ?? '',
    cost: row.cost ?? '',
    voucher: row.voucher ?? '',
    duolingoVoucher: row.duolingoVoucher ?? '',
  } : { ...emptyForm, date: todayInputValue() });
  const [customValues, setCustomValues] = useState({ ...(row?.customFields || {}) });
  const [errors, setErrors] = useState({});

  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.candidateName.trim()) e.candidateName = 'Candidate name is required';
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
    onSave({
      ...form,
      candidateName: form.candidateName.trim(),
      paymentAmount: form.paymentAmount === '' ? 0 : Number(form.paymentAmount),
      margin: form.margin === '' ? 0 : Number(form.margin),
      paidAmountToBC: form.paidAmountToBC === '' ? 0 : Number(form.paidAmountToBC),
      receivedAmount: form.receivedAmount === '' ? 0 : Number(form.receivedAmount),
      cost: form.cost === '' ? 0 : Number(form.cost),
      date: form.date || null,
      bookingDate: form.bookingDate || null,
      examDate: form.examDate || null,
      paymentDate: form.paymentDate || null,
      paymentDateToBC: form.paymentDateToBC || null,
      expiryDate: form.expiryDate || null,
      customFields: customValues,
    });
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
              <p>{isEdit ? `Editing: ${row.candidateName}` : 'Fill in the candidate & exam details below'}</p>
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
            <div className="af-section-title"><span className="af-section-num">1</span>Candidate</div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Date</label>
                <input type="date" className="af-input" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className={`af-field ${errors.candidateName ? 'has-error' : ''}`}>
                <label>Candidate Name *</label>
                <input type="text" className="af-input" placeholder="Full name"
                  value={form.candidateName} onChange={e => set('candidateName', e.target.value)} />
                {errors.candidateName && <span className="af-error">{errors.candidateName}</span>}
              </div>
              <div className="af-field">
                <label>Associates</label>
                <TextOrSuggest id="tp-associates" value={form.associates} onChange={v => set('associates', v)}
                  options={suggestions.associates} placeholder="Referring associate" />
              </div>
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">2</span>Booking & Exam</div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Booking Date</label>
                <input type="date" className="af-input" value={form.bookingDate} onChange={e => set('bookingDate', e.target.value)} />
              </div>
              <div className="af-field">
                <label>Exam Date</label>
                <input type="date" className="af-input" value={form.examDate} onChange={e => set('examDate', e.target.value)} />
              </div>
            </div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Module</label>
                <TextOrSuggest id="tp-module" value={form.module} onChange={v => set('module', v)}
                  options={[...(moduleOptions || MODULE_SUGGESTIONS), ...(suggestions.module || [])]} placeholder="PB / CD / CBT…" />
              </div>
              <div className="af-field">
                <label>Place</label>
                <TextOrSuggest id="tp-place" value={form.place} onChange={v => set('place', v)}
                  options={suggestions.place} placeholder="Exam center / city" />
              </div>
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">3</span>Payment</div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Payment Status</label>
                <select className="af-input" value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                  <option value="">Select…</option>
                  {(paymentStatusOptions || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="af-field">
                <label>Payment Made By</label>
                <TextOrSuggest id="tp-paidby" value={form.paymentMadeBy} onChange={v => set('paymentMadeBy', v)}
                  options={suggestions.paymentMadeBy} placeholder="Who paid" />
              </div>
            </div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Payment Date</label>
                <input type="date" className="af-input" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} />
              </div>
              <div className="af-field">
                <label>Payment Amount</label>
                <input type="number" step="0.01" className="af-input" placeholder="0.00"
                  value={form.paymentAmount} onChange={e => set('paymentAmount', e.target.value)} />
              </div>
            </div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Margin</label>
                <input type="number" step="0.01" className="af-input" placeholder="0.00"
                  value={form.margin} onChange={e => set('margin', e.target.value)} />
              </div>
              <div className="af-field">
                <label>Payment Date to BC</label>
                <input type="date" className="af-input" value={form.paymentDateToBC} onChange={e => set('paymentDateToBC', e.target.value)} />
              </div>
            </div>
            <div className="af-field">
              <label>Paid Amount to BC</label>
              <input type="number" step="0.01" className="af-input" placeholder="0.00"
                value={form.paidAmountToBC} onChange={e => set('paidAmountToBC', e.target.value)} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">4</span>Remarks</div>
            <div className="af-field">
              <label>Remarks (optional)</label>
              <textarea className="af-textarea" rows={3} placeholder="Additional notes…"
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">5</span>Reference & Voucher</div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Reference Number</label>
                <input type="text" className="af-input" placeholder="Booking / transaction reference"
                  value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} />
              </div>
              <div className="af-field">
                <label>Received Amount</label>
                <input type="number" step="0.01" className="af-input" placeholder="0.00"
                  value={form.receivedAmount} onChange={e => set('receivedAmount', e.target.value)} />
              </div>
            </div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Cost</label>
                <input type="number" step="0.01" className="af-input" placeholder="0.00"
                  value={form.cost} onChange={e => set('cost', e.target.value)} />
              </div>
              {!isDuolingo && (
                <div className="af-field">
                  <label>Voucher</label>
                  <select className="af-input" value={form.voucher} onChange={e => set('voucher', e.target.value)}>
                    <option value="">Select…</option>
                    {VOUCHER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )}
              {isDuolingo && (
                <div className="af-field">
                  <label>Duolingo Voucher</label>
                  <input type="text" className="af-input" placeholder="Voucher code"
                    value={form.duolingoVoucher} onChange={e => set('duolingoVoucher', e.target.value)} />
                </div>
              )}
            </div>
            <div className="af-grid-2">
              <div className="af-field">
                <label>Expiry Date</label>
                <input type="date" className="af-input" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
              </div>
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <div className="af-section">
              <div className="af-section-title"><span className="af-section-num">6</span>Additional Fields</div>
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

          <div className="af-footer">
            <button type="button" className="af-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="af-submit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {isEdit
                  ? <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>
                  : <><path d="M12 5v14M5 12h14"/></>
                }
              </svg>
              {isEdit ? 'Save Changes' : 'Add Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
