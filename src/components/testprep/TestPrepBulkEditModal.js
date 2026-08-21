import React, { useState } from 'react';
import '../shared/BulkEditModal.css';

const MODULE_SUGGESTIONS = ['PB', 'CD', 'CBT', 'Academic', 'General', 'Speaking', 'Online'];
const VOUCHER_OPTIONS = ['Voucher', 'Bonus Voucher'];

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

export default function TestPrepBulkEditModal({ count, testTypeName, suggestions = {}, customFieldDefs = [], paymentStatusOptions, moduleOptions, onSave, onClose }) {
  const isDuolingo = /^duolingo$/i.test((testTypeName || '').trim());

  const [fields, setFields] = useState({
    date: '', associates: '', module: '', place: '',
    bookingDate: '', examDate: '',
    paymentStatus: '', paymentMadeBy: '',
    paymentDate: '', paymentAmount: '', margin: '', paymentDateToBC: '', paidAmountToBC: '',
    remarks: '',
    referenceNumber: '', receivedAmount: '', cost: '', voucher: '', duolingoVoucher: '', expiryDate: '',
  });
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
          <div className="be-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Only checked fields will be updated. Unchecked fields remain unchanged.
          </div>

          <div className="be-fields">
            <Field label="Date" fieldKey="date" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.date} onChange={e => set('date', e.target.value)} />
            </Field>

            <Field label="Associates" fieldKey="associates" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" list="tp-be-associates" placeholder="Referring associate"
                value={fields.associates} onChange={e => set('associates', e.target.value)} />
              <datalist id="tp-be-associates">{(suggestions.associates || []).map(a => <option key={a} value={a} />)}</datalist>
            </Field>

            <Field label="Module" fieldKey="module" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" list="tp-be-module" placeholder="PB / CD / CBT…"
                value={fields.module} onChange={e => set('module', e.target.value)} />
              <datalist id="tp-be-module">{[...(moduleOptions || MODULE_SUGGESTIONS), ...(suggestions.module || [])].map(m => <option key={m} value={m} />)}</datalist>
            </Field>

            <Field label="Place" fieldKey="place" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" list="tp-be-place" placeholder="Exam center / city"
                value={fields.place} onChange={e => set('place', e.target.value)} />
              <datalist id="tp-be-place">{(suggestions.place || []).map(p => <option key={p} value={p} />)}</datalist>
            </Field>

            <Field label="Booking Date" fieldKey="bookingDate" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.bookingDate} onChange={e => set('bookingDate', e.target.value)} />
            </Field>

            <Field label="Exam Date" fieldKey="examDate" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.examDate} onChange={e => set('examDate', e.target.value)} />
            </Field>

            <Field label="Payment Status" fieldKey="paymentStatus" enabled={enabled} toggle={toggle}>
              <select className="be-input" value={fields.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                <option value="">Choose status…</option>
                {(paymentStatusOptions || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>

            <Field label="Payment Made By" fieldKey="paymentMadeBy" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" list="tp-be-paidby" placeholder="Who paid"
                value={fields.paymentMadeBy} onChange={e => set('paymentMadeBy', e.target.value)} />
              <datalist id="tp-be-paidby">{(suggestions.paymentMadeBy || []).map(p => <option key={p} value={p} />)}</datalist>
            </Field>

            <Field label="Payment Date" fieldKey="paymentDate" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.paymentDate} onChange={e => set('paymentDate', e.target.value)} />
            </Field>

            <Field label="Payment Amount" fieldKey="paymentAmount" enabled={enabled} toggle={toggle}>
              <input type="number" step="0.01" className="be-input" placeholder="0.00"
                value={fields.paymentAmount} onChange={e => set('paymentAmount', e.target.value)} />
            </Field>

            <Field label="Margin" fieldKey="margin" enabled={enabled} toggle={toggle}>
              <input type="number" step="0.01" className="be-input" placeholder="0.00"
                value={fields.margin} onChange={e => set('margin', e.target.value)} />
            </Field>

            <Field label="Payment Date to BC" fieldKey="paymentDateToBC" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.paymentDateToBC} onChange={e => set('paymentDateToBC', e.target.value)} />
            </Field>

            <Field label="Paid Amount to BC" fieldKey="paidAmountToBC" enabled={enabled} toggle={toggle}>
              <input type="number" step="0.01" className="be-input" placeholder="0.00"
                value={fields.paidAmountToBC} onChange={e => set('paidAmountToBC', e.target.value)} />
            </Field>

            <Field label="Reference Number" fieldKey="referenceNumber" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Reference number"
                value={fields.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} />
            </Field>

            <Field label="Received Amount" fieldKey="receivedAmount" enabled={enabled} toggle={toggle}>
              <input type="number" step="0.01" className="be-input" placeholder="0.00"
                value={fields.receivedAmount} onChange={e => set('receivedAmount', e.target.value)} />
            </Field>

            <Field label="Cost" fieldKey="cost" enabled={enabled} toggle={toggle}>
              <input type="number" step="0.01" className="be-input" placeholder="0.00"
                value={fields.cost} onChange={e => set('cost', e.target.value)} />
            </Field>

            {!isDuolingo && (
              <Field label="Voucher" fieldKey="voucher" enabled={enabled} toggle={toggle}>
                <select className="be-input" value={fields.voucher} onChange={e => set('voucher', e.target.value)}>
                  <option value="">Choose…</option>
                  {VOUCHER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </Field>
            )}

            {isDuolingo && (
              <Field label="Duolingo Voucher" fieldKey="duolingoVoucher" enabled={enabled} toggle={toggle}>
                <input type="text" className="be-input" placeholder="Voucher code"
                  value={fields.duolingoVoucher} onChange={e => set('duolingoVoucher', e.target.value)} />
              </Field>
            )}

            <Field label="Expiry Date" fieldKey="expiryDate" enabled={enabled} toggle={toggle}>
              <input type="date" className="be-input" value={fields.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </Field>

            <Field label="Remarks" fieldKey="remarks" enabled={enabled} toggle={toggle}>
              <input type="text" className="be-input" placeholder="Remark / note"
                value={fields.remarks} onChange={e => set('remarks', e.target.value)} />
            </Field>

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
