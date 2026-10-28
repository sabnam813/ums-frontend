import React, { useState } from 'react';
import { COLUMNS, fmtDate, STATUS_OPTIONS, normalizeStatus, ownersOf } from './associateColumns';
import '../HallBooking/HallBooking.css';
import './AssociateDetails.css';

const LONG_FIELDS = ['address', 'association', 'emailOthers', 'aliases'];
const OWNER_KEYS = ['ownerName', 'designation', 'ownerContact'];
const blankOwner = () => ({ name: '', designation: '', contact: '' });

function initial(row) {
  const f = {};
  const owners = ownersOf(row).map(o => ({ name: o.name || '', designation: o.designation || '', contact: o.contact || '' }));
  f.owners = owners.length ? owners : [blankOwner()];
  COLUMNS.forEach(c => {
    if (OWNER_KEYS.includes(c.key) || c.key === 'sno') return;
    if (c.key === 'dateOfOnboarding') f[c.key] = fmtDate(row?.dateOfOnboarding) || row?.dateOfOnboardingText || '';
    else if (c.key === 'status') f.status = normalizeStatus(row?.status);
    else if (c.key === 'aliases') f.aliases = Array.isArray(row?.aliases) ? row.aliases.join(', ') : '';
    else f[c.key] = row?.[c.key] ?? '';
  });
  return f;
}

export default function AssociateDetailForm({ row, onSave, onClose }) {
  const isEdit = !!row;
  const [form, setForm] = useState(() => initial(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setOwner = (i, k, v) => setForm(f => ({ ...f, owners: f.owners.map((o, idx) => (idx === i ? { ...o, [k]: v } : o)) }));
  const addOwner = () => setForm(f => ({ ...f, owners: [...f.owners, blankOwner()] }));
  const removeOwner = (i) => setForm(f => ({ ...f, owners: f.owners.length > 1 ? f.owners.filter((_, idx) => idx !== i) : [blankOwner()] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!String(form.consultancyName).trim()) { setError('Name of consultancy is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const dateIsText = form.dateOfOnboarding && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfOnboarding);

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal ad-modal animate-fade">
        <div className="hb-modal-header">
          <div className="hb-title-group">
            <div className="hb-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Associate' : 'Add Associate'}</h3>
              <p>Consultancy, owner, manager and contact details</p>
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
            <div className="ad-form-grid">
              {COLUMNS.map(c => {
                if (c.key === 'sno' || (OWNER_KEYS.includes(c.key) && c.key !== 'ownerName')) return null;
                if (c.key === 'ownerName') {
                  return (
                    <div key="owners" className="hb-field ad-span-2">
                      <label>Owners / Directors</label>
                      <div className="ad-owners">
                        {form.owners.map((o, i) => (
                          <div key={i} className="ad-owner-row">
                            <input type="text" placeholder="Name" value={o.name} onChange={e => setOwner(i, 'name', e.target.value)} />
                            <input type="text" placeholder="Designation" value={o.designation} onChange={e => setOwner(i, 'designation', e.target.value)} />
                            <input type="text" placeholder="Contact no." value={o.contact} onChange={e => setOwner(i, 'contact', e.target.value)} />
                            <button type="button" className="ad-owner-remove" onClick={() => removeOwner(i)} title="Remove owner" aria-label="Remove owner">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        ))}
                        <button type="button" className="ad-owner-add" onClick={addOwner}>+ Add owner</button>
                      </div>
                    </div>
                  );
                }
                const long = LONG_FIELDS.includes(c.key);
                return (
                  <div key={c.key} className={`hb-field ${long ? 'ad-span-2' : ''}`}>
                    <label>{c.label}{c.required ? ' *' : ''}</label>
                    {c.key === 'dateOfOnboarding' ? (
                      dateIsText ? (
                        <input type="text" value={form.dateOfOnboarding} onChange={e => set(c.key, e.target.value)} placeholder="YYYY-MM-DD" />
                      ) : (
                        <input type="date" value={form.dateOfOnboarding} onChange={e => set(c.key, e.target.value)} />
                      )
                    ) : c.key === 'status' ? (
                      <select value={form.status} onChange={e => set(c.key, e.target.value)}>
                        {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : c.key === 'aliases' ? (
                      <textarea rows={2} value={form.aliases} onChange={e => set(c.key, e.target.value)} placeholder="Short names used before, comma separated" />
                    ) : long ? (
                      <textarea rows={2} value={form[c.key]} onChange={e => set(c.key, e.target.value)} />
                    ) : (
                      <input type="text" value={form[c.key]} onChange={e => set(c.key, e.target.value)} autoFocus={c.key === 'consultancyName'} />
                    )}
                  </div>
                );
              })}
            </div>
            <span className="hb-hint">Several phone numbers or emails in one box are fine — separate them with commas or new lines.</span>
          </div>
          <div className="hb-modal-footer">
            <span />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="hb-btn-save" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Associate'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
