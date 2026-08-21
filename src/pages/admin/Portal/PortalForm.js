import React, { useState } from 'react';
import './Portal.css';

const EYE_OPEN = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EYE_OFF = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

function isSafeUrlClient(raw) {
  if (!raw) return true; // empty is allowed
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function PortalForm({ portal, departments, onSave, onClose }) {
  const isEdit = !!portal;
  const [form, setForm] = useState({
    name: portal?.name || '',
    username: portal?.username || '',
    password: '', // never pre-filled; blank = "leave unchanged" on edit
    url: portal?.url || '',
    category: portal?.category || '',
    notes: portal?.notes || '',
    departments: portal?.departments || [],
    allDepartments: portal?.allDepartments || false,
    status: portal?.status || 'active',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleDept = (name) => {
    setForm(f => {
      const has = f.departments.includes(name);
      return { ...f, departments: has ? f.departments.filter(d => d !== name) : [...f.departments, name] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Portal name is required');
      return;
    }
    if (form.url && !isSafeUrlClient(form.url)) {
      setError('Site link must be a valid http:// or https:// URL');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit && form.password === '') delete payload.password; // leave credential unchanged
      await onSave(payload);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save portal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="pt-modal animate-fade">
        <div className="pt-modal-header">
          <div className="pt-title-group">
            <div className="pt-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Portal' : 'Add New Portal'}</h3>
              <p>Portal credentials &amp; department visibility</p>
            </div>
          </div>
          <button type="button" className="pt-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pt-modal-body">
            {error && <div className="pt-error">{error}</div>}

            <div className="pt-grid-2">
              <div className="pt-field">
                <label>Portal Name *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Regent College" maxLength={150} required />
              </div>
              <div className="pt-field">
                <label>Category</label>
                <input type="text" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. University Portal" maxLength={100} />
              </div>
            </div>

            <div className="pt-grid-2">
              <div className="pt-field">
                <label>Username</label>
                <input type="text" value={form.username} onChange={e => set('username', e.target.value)} placeholder="Login username / email" maxLength={200} autoComplete="off" />
              </div>
              <div className="pt-field">
                <label>Password {isEdit && <span className="pt-hint">(leave blank to keep current)</span>}</label>
                <div className="pt-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder={isEdit ? '••••••••' : 'Login password'}
                    maxLength={500}
                    autoComplete="new-password"
                  />
                  <button type="button" className="pt-eye-btn" onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                    {showPassword ? EYE_OFF : EYE_OPEN}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-field">
              <label>Site Link</label>
              <input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://example.com/agent/login" maxLength={2000} />
              <span className="pt-hint">Only http:// and https:// links are accepted — this is what opens when staff click the portal link.</span>
            </div>

            <div className="pt-field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} maxLength={1000} placeholder="Optional internal notes" />
            </div>

            <div className="pt-field">
              <label>Status</label>
              <div className="pt-status-toggle">
                <button type="button" className={`pt-status-opt ${form.status === 'active' ? 'active' : ''}`} onClick={() => set('status', 'active')}>Active</button>
                <button type="button" className={`pt-status-opt ${form.status === 'inactive' ? 'active' : ''}`} onClick={() => set('status', 'inactive')}>Inactive</button>
              </div>
            </div>

            <div className="pt-field">
              <div className="pt-dept-header">
                <label>Who can see this portal?</label>
                <label className="pt-all-dept-toggle">
                  <input type="checkbox" checked={form.allDepartments} onChange={e => set('allDepartments', e.target.checked)} />
                  All Departments
                </label>
              </div>
              {!form.allDepartments && (
                departments.length === 0 ? (
                  <p className="pt-hint">No departments created yet. Create one under Departments first.</p>
                ) : (
                  <div className="pt-dept-list">
                    {departments.map(d => (
                      <label key={d._id} className={`pt-dept-chip ${form.departments.includes(d.name) ? 'checked' : ''}`}>
                        <input type="checkbox" checked={form.departments.includes(d.name)} onChange={() => toggleDept(d.name)} />
                        {d.name}
                      </label>
                    ))}
                  </div>
                )
              )}
              <span className="pt-hint">
                {form.allDepartments
                  ? 'Every department with Portal access will see this entry.'
                  : form.departments.length === 0
                    ? 'No department checked — only Admin and Super Admin will see this entry.'
                    : 'Only the checked departments will see this entry in their Portal datatable.'}
              </span>
            </div>
          </div>

          <div className="pt-modal-footer">
            <button type="button" className="pt-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="pt-btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Portal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
