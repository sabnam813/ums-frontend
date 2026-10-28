import React, { useState } from 'react';
import { DIRECT_INDIRECT_OPTIONS } from '../../utils/commission';

export default function CommissionBulkEditModal({ section, count, onSave, onClose }) {
  const isDept = section === 'department';
  const [saving, setSaving] = useState(false);
  const [apply, setApply] = useState({});
  const [values, setValues] = useState({
    partner: '', undergraduate: '', postgraduate: '', remarks: '', channelPartner: '', directIndirect: 'Direct',
  });

  const toggle = (key) => setApply(a => ({ ...a, [key]: !a[key] }));
  const setVal = (key, v) => setValues(val => ({ ...val, [key]: v }));

  const handleSubmit = async () => {
    const updates = {};
    Object.keys(apply).forEach(k => { if (apply[k]) updates[k] = values[k]; });
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    try {
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  const fields = isDept
    ? [
        { key: 'channelPartner', label: 'Channel Partner', type: 'text', placeholder: 'e.g. Direct' },
        { key: 'directIndirect', label: 'Direct / Indirect', type: 'select', options: DIRECT_INDIRECT_OPTIONS },
      ]
    : [
        { key: 'undergraduate', label: 'Undergraduate', type: 'textarea' },
        { key: 'postgraduate', label: 'Postgraduate', type: 'textarea' },
        ...(section === 'shareholder' ? [{ key: 'partner', label: 'Admission Partner', type: 'text' }] : []),
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
      ];

  const anyApplied = Object.values(apply).some(Boolean);

  return (
    <div className="cms-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="cms-modal" onClick={e => e.stopPropagation()}>
        <h3>Bulk Edit — {count} row{count !== 1 ? 's' : ''}</h3>
        <p className="cms-muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Check a field to overwrite it on every selected row. Unchecked fields are left as-is.
        </p>

        {fields.map(f => (
          <div key={f.key} className="cms-bulk-field">
            <label className="cms-check-row">
              <input type="checkbox" checked={!!apply[f.key]} onChange={() => toggle(f.key)} />
              <span>{f.label}</span>
            </label>
            {apply[f.key] && (
              f.type === 'select' ? (
                <select value={values[f.key]} onChange={e => setVal(f.key, e.target.value)}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={2} value={values[f.key]} onChange={e => setVal(f.key, e.target.value)} placeholder={f.placeholder} />
              ) : (
                <input type="text" value={values[f.key]} onChange={e => setVal(f.key, e.target.value)} placeholder={f.placeholder} />
              )
            )}
          </div>
        ))}

        <div className="cms-modal-actions">
          <button className="cms-btn cms-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="cms-btn cms-btn-primary" onClick={handleSubmit} disabled={saving || !anyApplied}>
            {saving ? 'Saving…' : `Apply to ${count} row${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
