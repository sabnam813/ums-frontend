import React, { useState, useMemo } from 'react';
import useAssociateOptions from '../../hooks/useAssociateOptions';
import useIntakeOptions from '../../hooks/useIntakeOptions';
import useLevelOptions from '../../hooks/useLevelOptions';
import { useConfigList } from '../../context/ConfigContext';
import { PAYMENT_STATUSES, CURRENCY_SUGGESTIONS, fmtDate, fmtMoney, fmtNumber } from './unicommissionColumns';
import '../admin/HallBooking/HallBooking.css';
import '../admin/AssociateDetails/AssociateDetails.css';
import './Unicommission.css';

function initial(row) {
  return {
    studentName: row?.studentName ?? '',
    associate: row?.associate ?? '',
    intake: row?.intake ?? '',
    university: row?.university ?? '',
    level: row?.level ?? '',
    course: row?.course ?? '',
    commissionProvider: row?.commissionProvider ?? '',
    feeAmount: row?.feeAmount ?? '',
    currency: row?.currency ?? '',
    studentIdNo: row?.studentIdNo ?? '',
    visaGrantedDate: fmtDate(row?.visaGrantedDate) || row?.visaGrantedDateText || '',
    commissionType: row?.commissionType ?? '',
    commissionValue: row?.commissionValue ?? '',
    paymentStatus: row?.paymentStatus ?? 'Pending',
    remarks: row?.remarks ?? '',
  };
}

export default function UnicommissionForm({ row, countryName, setting, onSave, onClose }) {
  const LEVEL_SUGGESTIONS = useLevelOptions();
  const currencyList = useConfigList('currency', CURRENCY_SUGGESTIONS);
  const isEdit = !!row;
  const intakeValues = useIntakeOptions();
  const associates = useAssociateOptions();
  const [form, setForm] = useState(() => initial(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const countryCurrency = setting?.currency || '';
  const currency = (form.currency || countryCurrency || '').toUpperCase();
  const type = form.commissionType || setting?.commissionType || 'percentage';
  const valueRaw = form.commissionType ? form.commissionValue : (form.commissionValue !== '' ? form.commissionValue : (setting?.commissionValue ?? ''));
  const preview = useMemo(() => {
    const value = Number(valueRaw);
    if (valueRaw === '' || valueRaw === null || !Number.isFinite(value)) return '';
    if (type === 'percentage') {
      const fee = Number(form.feeAmount);
      if (form.feeAmount === '' || !Number.isFinite(fee)) return '';
      return fmtMoney(Math.round(fee * value) / 100, currency);
    }
    return fmtMoney(value, currency);
  }, [valueRaw, type, form.feeAmount, currency]);

  const dateIsText = form.visaGrantedDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.visaGrantedDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!String(form.studentName).trim()) { setError('Student name is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal ad-modal animate-fade">
        <div className="hb-modal-header">
          <div className="hb-title-group">
            <div className="hb-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Record' : 'Add Record'}</h3>
              <p>{countryName} · visa-granted student, fee and commission</p>
            </div>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="hb-modal-body">
            {error && <div className="hb-error">{error}</div>}
            {row && !row.isManual && (
              <div className="uc-note">This record came from an application. Student, associate, intake, university, level, course and visa date stay exactly as you set them here — they are no longer overwritten by the application.</div>
            )}
            <div className="ad-form-grid">
              <div className="hb-field">
                <label>Students Name *</label>
                <input type="text" value={form.studentName} onChange={e => set('studentName', e.target.value)} autoFocus />
              </div>
              <div className="hb-field">
                <label>Associates</label>
                <input type="text" list="uc-assoc-list" value={form.associate} onChange={e => set('associate', e.target.value)} />
                <datalist id="uc-assoc-list">{associates.map(a => <option key={a.id} value={a.name} />)}</datalist>
              </div>
              <div className="hb-field">
                <label>Intake</label>
                <input type="text" list="uc-intake-list" value={form.intake} onChange={e => set('intake', e.target.value)} placeholder="e.g. Sep 2025" />
                <datalist id="uc-intake-list">{intakeValues.map(v => <option key={v} value={v} />)}</datalist>
              </div>
              <div className="hb-field">
                <label>University</label>
                <input type="text" value={form.university} onChange={e => set('university', e.target.value)} />
              </div>
              <div className="hb-field">
                <label>Level</label>
                <input type="text" list="uc-level-list" value={form.level} onChange={e => set('level', e.target.value)} placeholder="UG / PG" />
                <datalist id="uc-level-list">{LEVEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}</datalist>
              </div>
              <div className="hb-field">
                <label>Course</label>
                <input type="text" value={form.course} onChange={e => set('course', e.target.value)} />
              </div>
              <div className="hb-field">
                <label>Commission Provider</label>
                <input type="text" value={form.commissionProvider} onChange={e => set('commissionProvider', e.target.value)} />
              </div>
              <div className="hb-field">
                <label>Student ID No</label>
                <input type="text" value={form.studentIdNo} onChange={e => set('studentIdNo', e.target.value)} />
              </div>
              <div className="hb-field">
                <label>Visa Granted Date</label>
                {dateIsText ? (
                  <input type="text" value={form.visaGrantedDate} onChange={e => set('visaGrantedDate', e.target.value)} placeholder="YYYY-MM-DD" />
                ) : (
                  <input type="date" value={form.visaGrantedDate} onChange={e => set('visaGrantedDate', e.target.value)} />
                )}
              </div>
              <div className="hb-field">
                <label>Payment Status</label>
                <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                  {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="uc-section-title">Fee and commission</div>
            <div className="ad-form-grid">
              <div className="hb-field">
                <label>Fee Amount {currency ? `(${currency})` : ''}</label>
                <input type="number" min="0" step="any" value={form.feeAmount} onChange={e => set('feeAmount', e.target.value)} />
              </div>
              <div className="hb-field">
                <label>Currency {countryCurrency ? `(blank = ${countryCurrency})` : ''}</label>
                <input type="text" list="uc-cur-list" value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} maxLength={6} placeholder={countryCurrency || 'e.g. GBP'} />
                <datalist id="uc-cur-list">{currencyList.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="hb-field">
                <label>Commission Type</label>
                <select value={form.commissionType} onChange={e => set('commissionType', e.target.value)}>
                  <option value="">{`Country default (${setting?.commissionType === 'fixed' ? 'fixed amount' : 'percentage'})`}</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage of fee</option>
                </select>
              </div>
              <div className="hb-field">
                <label>{type === 'percentage' ? 'Rate (%)' : `Amount ${currency ? `(${currency})` : ''}`}</label>
                <input
                  type="number" min="0" step="any" value={form.commissionValue}
                  onChange={e => set('commissionValue', e.target.value)}
                  placeholder={!form.commissionType && setting?.commissionValue != null ? `Default ${fmtNumber(setting.commissionValue)}` : ''}
                />
              </div>
              <div className="hb-field ad-span-2">
                <div className="uc-preview">Commission for this student: <strong>{preview || '—'}</strong></div>
              </div>
              <div className="hb-field ad-span-2">
                <label>Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="hb-modal-footer">
            <span />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="hb-btn-save" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
