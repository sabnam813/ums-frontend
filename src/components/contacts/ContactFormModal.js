import React, { useState } from 'react';

export default function ContactFormModal({ group, contact, onSave, onClose }) {
  const isEdit = !!contact;
  const fields = [...(group.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach(f => { initial[f.key] = contact?.data?.[f.key] || ''; });
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setValue = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    for (const f of fields) {
      const val = (values[f.key] || '').trim();
      if (f.required && !val) {
        nextErrors[f.key] = `${f.label} is required`;
        continue;
      }
      if (val && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        nextErrors[f.key] = 'Enter a valid email address';
      }
      if (val && f.type === 'number' && isNaN(Number(val))) {
        nextErrors[f.key] = 'Enter a valid number';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  const inputType = (type) => (type === 'number' ? 'number' : type === 'email' ? 'email' : 'text');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Contact' : 'Add Contact'}</h3>
              <p>{group.name}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {fields.length === 0 && (
            <p className="ffm-empty-hint">
              This group has no fields yet. Ask an admin to add fields via "Manage Fields" before adding contacts.
            </p>
          )}

          {fields.map(f => (
            <div className={`field ${errors[f.key] ? 'has-error' : ''}`} key={f._id || f.key}>
              <label>{f.label}{f.required ? ' *' : ''}</label>
              <div className="field-wrap">
                <input
                  type={inputType(f.type)}
                  value={values[f.key] || ''}
                  onChange={e => setValue(f.key, e.target.value)}
                  placeholder={f.label}
                />
              </div>
              {errors[f.key] && <span className="field-error">{errors[f.key]}</span>}
            </div>
          ))}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving || fields.length === 0}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {isEdit
                  ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                  : <><path d="M12 5v14M5 12h14"/></>
                }
              </svg>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
