import React, { useState } from 'react';
import { DIRECT_INDIRECT_OPTIONS } from '../../utils/commission';

export default function CommissionRowFormModal({ section, row, onSave, onClose }) {
  const isDept = section === 'department';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    university: row?.university || '',
    partner: row?.partner || '',
    undergraduate: row?.undergraduate || '',
    postgraduate: row?.postgraduate || '',
    remarks: row?.remarks || '',
    channelPartner: row?.channelPartner || '',
    directIndirect: row?.directIndirect || 'Direct',
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.university.trim()) { return; }
    setSaving(true);
    try {
      if (isDept) {
        await onSave({
          university: form.university,
          channelPartner: form.channelPartner,
          directIndirect: form.directIndirect,
        });
      } else {
        await onSave({
          university: form.university,
          ...(section === 'shareholder' ? { partner: form.partner } : {}),
          undergraduate: form.undergraduate,
          postgraduate: form.postgraduate,
          remarks: form.remarks,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cms-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="cms-modal" onClick={e => e.stopPropagation()}>
        <h3>{row ? 'Edit' : 'Add'} {isDept ? 'Department' : section === 'shareholder' ? 'Shareholder' : 'Associate'} Row</h3>

        <label className="cms-field">
          <span>Name *</span>
          <input
            type="text"
            autoFocus
            value={form.university}
            onChange={e => set('university', e.target.value)}
            placeholder="Any name: university, college, school, agent, partner…"
          />
        </label>

        {isDept ? (
          <>
            <label className="cms-field">
              <span>Channel Partner</span>
              <input
                type="text"
                value={form.channelPartner}
                onChange={e => set('channelPartner', e.target.value)}
                placeholder="e.g. GUS(INUNI), Direct, Slate"
              />
            </label>
            <label className="cms-field">
              <span>Direct / Indirect</span>
              <select value={form.directIndirect} onChange={e => set('directIndirect', e.target.value)}>
                {DIRECT_INDIRECT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="cms-field">
              <span>Undergraduate</span>
              <textarea
                rows={2}
                value={form.undergraduate}
                onChange={e => set('undergraduate', e.target.value)}
                placeholder="e.g. 12% net tuition per year"
              />
            </label>
            <label className="cms-field">
              <span>Postgraduate</span>
              <textarea
                rows={2}
                value={form.postgraduate}
                onChange={e => set('postgraduate', e.target.value)}
                placeholder="e.g. 12% net tuition per year"
              />
            </label>
            {section === 'shareholder' && (
              <label className="cms-field">
                <span>Admission Partner</span>
                <input
                  type="text"
                  value={form.partner}
                  onChange={e => set('partner', e.target.value)}
                />
              </label>
            )}
            <label className="cms-field">
              <span>Remarks</span>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={e => set('remarks', e.target.value)}
                placeholder="e.g. Gross fee, first year only"
              />
            </label>
          </>
        )}

        <div className="cms-modal-actions">
          <button className="cms-btn cms-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="cms-btn cms-btn-primary" onClick={handleSubmit} disabled={saving || !form.university.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
