import React, { useState } from 'react';
import './Diary.css';

export default function DiaryForm({ entry, onSave, onClose }) {
  const isEdit = !!entry;
  const [form, setForm] = useState({
    name: entry?.name || '',
    post: entry?.post || '',
    mobile: entry?.mobile || '',
    remarks: entry?.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save diary entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dy-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="dy-modal animate-fade">
        <div className="dy-modal-header">
          <div className="dy-title-group">
            <div className="dy-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Diary Entry' : 'Add Diary Entry'}</h3>
              <p>Name, post, mobile number &amp; remarks</p>
            </div>
          </div>
          <button type="button" className="dy-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dy-modal-body">
            {error && <div className="dy-error">{error}</div>}

            <div className="dy-field">
              <label>Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ram Sharma" maxLength={150} required />
            </div>

            <div className="dy-grid-2">
              <div className="dy-field">
                <label>Post</label>
                <input type="text" value={form.post} onChange={e => set('post', e.target.value)} placeholder="e.g. Marketing Officer" maxLength={150} />
              </div>
              <div className="dy-field">
                <label>Mobile No</label>
                <input type="text" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="e.g. 98XXXXXXXX" maxLength={40} />
              </div>
            </div>

            <div className="dy-field">
              <label>Remarks</label>
              <textarea rows={4} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Any notes about this contact…" maxLength={2000} />
            </div>
          </div>

          <div className="dy-modal-footer">
            <button type="button" className="dy-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="dy-btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
