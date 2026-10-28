import React, { useState } from 'react';

export default function CommissionNoteModal({ initialNote, onSave, onClose }) {
  const [saving, setSaving] = useState(false);
  const [headerNote, setHeaderNote] = useState(initialNote?.headerNote || '');
  const [footerNote, setFooterNote] = useState(initialNote?.footerNote || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ headerNote, footerNote });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cms-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="cms-modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Note</h3>
        <p className="cms-muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Shown above/below the table exactly as typed here — in the app, and in Excel, PDF and print output.
        </p>

        <label className="cms-field">
          <span>Header note (shown above the table)</span>
          <textarea
            rows={3}
            value={headerNote}
            onChange={e => setHeaderNote(e.target.value)}
            placeholder="e.g. Commission payable to the Promoters/Shareholders shall be 90% of the rates specified in the table below, in accordance with the company policy."
          />
        </label>

        <label className="cms-field">
          <span>Footer note (shown below the table)</span>
          <textarea
            rows={3}
            value={footerNote}
            onChange={e => setFooterNote(e.target.value)}
            placeholder="Optional closing note for this country's table"
          />
        </label>

        <div className="cms-modal-actions">
          <button className="cms-btn cms-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
